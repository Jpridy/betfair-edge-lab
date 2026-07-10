// ============================================================================
// Race Pack Builder
//
// Builds a comprehensive RacePack object for a single event/race cluster.
// The RacePack contains ALL available data for a race: markets, runners,
// prices, external research, bot context, and settings.
//
// This is sent to Featherless AI so it can assess the ENTIRE race before
// any opportunity is selected or ranked locally.
//
// No API keys or secrets are included.
// ============================================================================

import { detectMarketType, extractPlaceTerms, getAllMarketsInCluster } from './marketClusterer';
import { matchRunnerToMarket } from './marketIdMatcher';
import { calculateSpreadTicks } from './tickLadder';

/**
 * Build a full RacePack for a single event cluster.
 *
 * @param {object} eventCluster - Cluster from marketClusterer
 * @param {Array} allRunners - All runners in the app
 * @param {Array} allMarkets - All markets in the app (for cross-reference)
 * @param {object} settings - AppSettings
 * @param {object} featherlessSettings - FeatherlessSettings
 * @param {object} bankrollStats - Current bankroll/exposure stats
 * @param {Array} paperOrders - Existing paper orders (for risk context)
 * @param {object} externalResearch - Optional OpenAI web search result
 * @param {object} opts - { paperMode, paperProofMode }
 * @returns {object} RacePack object
 */
export function buildRacePack(eventCluster, allRunners, allMarkets, settings, featherlessSettings, bankrollStats, paperOrders, externalResearch, opts = {}) {
  if (!eventCluster) return null;

  const allClusterMarkets = getAllMarketsInCluster(eventCluster);
  const maxMarkets = featherlessSettings?.maxMarketsPerRacePack || 10;
  const maxRunners = featherlessSettings?.maxRunnersPerRacePack || 30;
  const includeRiskContext = featherlessSettings?.includeRiskContextInRacePack !== false;
  const includeOpenAIResearch = featherlessSettings?.includeOpenAIResearchInRacePack !== false;

  // ── Build per-market objects with runners and prices ──
  const marketObjects = [];
  const seenSelectionIds = new Set();
  const runnerMap = new Map(); // selectionId → aggregated runner info

  for (const market of allClusterMarkets.slice(0, maxMarkets)) {
    const marketType = detectMarketType(market);
    if (marketType === 'OTHER') continue;

    const marketRunners = allRunners.filter(r =>
      matchRunnerToMarket(r, market) && r.status === 'ACTIVE'
    ).slice(0, maxRunners);

    const runnerObjects = marketRunners.map((r, idx) => {
      const selectionId = String(r.betfairSelectionId || r.selectionId || '');
      const bestBack = r.bestBackPrice || 0;
      const bestLay = r.bestLayPrice || 0;
      const spreadTicks = calculateSpreadTicks(bestBack, bestLay);
      const tradedVol = r.tradedVolumeAmount || r.totalMatched || 0;

      const runnerObj = {
        selectionId,
        runnerName: r.runnerName || '',
        status: r.status || 'ACTIVE',
        sortPriority: r.favouriteRank || idx + 1,
        bestBackPrice: bestBack,
        bestBackSize: r.bestBackSize || 0,
        bestLayPrice: bestLay,
        bestLaySize: r.bestLaySize || 0,
        lastPriceTraded: r.lastPriceTraded || r.lastTradedPrice || 0,
        tradedVolume: tradedVol,
        spreadTicks,
        impliedBackProbability: bestBack > 0 ? (1 / bestBack) : 0,
        impliedLayProbability: bestLay > 0 ? (1 / bestLay) : 0,
        liquidityScore: Math.min(1, (r.bestBackSize || 0) / Math.max(50, 1)),
      };

      // Aggregate into runner map for the top-level runners array
      if (!seenSelectionIds.has(selectionId)) {
        seenSelectionIds.add(selectionId);
        const formProfile = r.raceFormProfile || null;
        runnerMap.set(selectionId, {
          selectionId,
          runnerName: r.runnerName || '',
          status: r.status || 'ACTIVE',
          barrier: formProfile?.stallDraw ?? formProfile?.externalFormData?.barrier ?? null,
          jockey: formProfile?.jockeyName ?? null,
          trainer: formProfile?.trainerName ?? null,
          weight: formProfile?.weightValue ?? null,
          age: formProfile?.age ?? null,
          sex: formProfile?.sex ?? null,
          form: formProfile?.recentForm ?? formProfile?.externalFormData?.previousStarts ?? null,
          winMarketPrice: bestBack,
          placeMarketPrice: null, // filled below if PLACE market found
          h2hPrices: [],
          totalMatched: tradedVol,
          bestBackPrice: bestBack,
          bestLayPrice: bestLay,
          spreadTicks,
          liquidity: Math.min(1, ((r.bestBackSize || 0) + (r.bestLaySize || 0)) / Math.max(100, 1)),
          publicResearch: formProfile?.externalFormData ?? null,
          positiveSignals: [],
          negativeSignals: [],
          notes: '',
        });
      }

      return runnerObj;
    });

    marketObjects.push({
      marketId: market.betfairMarketId || market.id,
      marketName: market.marketName || '',
      marketType,
      marketTypeCode: market.marketTypeCode || market.marketType || '',
      status: market.status || 'OPEN',
      inPlay: market.inPlay || false,
      totalMatched: market.totalMatched || 0,
      numberOfWinners: market.numberOfWinners || 0,
      marketBaseRate: market.marketBaseRate ?? null,
      runners: runnerObjects,
    });
  }

  // ── Fill in cross-market prices in the runner map ──
  for (const mkt of marketObjects) {
    for (const r of mkt.runners) {
      const agg = runnerMap.get(r.selectionId);
      if (!agg) continue;
      if (mkt.marketType === 'PLACE') {
        agg.placeMarketPrice = r.bestBackPrice || agg.placeMarketPrice;
      } else if (mkt.marketType === 'H2H') {
        agg.h2hPrices.push({ marketId: mkt.marketId, bestBackPrice: r.bestBackPrice, bestLayPrice: r.bestLayPrice });
      }
    }
  }

  // ── Apply external research to runners ──
  if (includeOpenAIResearch && externalResearch && externalResearch.runnerResearch) {
    for (const research of externalResearch.runnerResearch) {
      const selId = String(research.selectionId || '');
      const agg = runnerMap.get(selId);
      if (agg) {
        agg.positiveSignals = research.positiveSignals || [];
        agg.negativeSignals = research.negativeSignals || [];
        const posCount = (research.positiveSignals || []).length;
        const negCount = (research.negativeSignals || []).length;
        agg.notes = (posCount || negCount)
          ? `${posCount} positive, ${negCount} negative signals from external search`
          : '';
      }
    }
  }

  // ── Market summary ──
  const winMarket = marketObjects.find(m => m.marketType === 'WIN') || null;
  const placeMarket = marketObjects.find(m => m.marketType === 'PLACE') || null;
  const h2hMarkets = marketObjects.filter(m => m.marketType === 'H2H');
  const totalMatched = marketObjects.reduce((s, m) => s + (m.totalMatched || 0), 0);
  const primaryMarket = winMarket || placeMarket || h2hMarkets[0] || marketObjects[0];

  // ── Race context ──
  const startTime = eventCluster.startTime || primaryMarket?.marketStartTime || null;
  const secondsToJump = startTime ? Math.round((new Date(startTime).getTime() - Date.now()) / 1000) : null;

  // ── Risk context ──
  const clusterMarketIds = allClusterMarkets.map(m => m.betfairMarketId || m.id);
  const openOrdersInRace = paperOrders.filter(o =>
    clusterMarketIds.includes(o.betfairMarketId || o.marketId) &&
    ['pending', 'executable', 'matched', 'unmatched', 'partially_matched'].includes(o.status)
  );
  const commissionRate = primaryMarket?.marketBaseRate ?? settings.defaultCommissionRate ?? 0.05;

  const racePack = {
    raceId: eventCluster.eventId,
    eventId: eventCluster.eventId,
    eventName: eventCluster.eventName || '',
    venue: eventCluster.venue || '',
    countryCode: null,
    raceNumber: eventCluster.raceNumber || 0,
    startTime: startTime,
    secondsToJump,
    trackCondition: null,
    distance: null,
    raceClass: null,
    numberOfRunners: runnerMap.size,
    numberOfActiveRunners: runnerMap.size,

    marketSummary: {
      winMarket: winMarket ? { marketId: winMarket.marketId, totalMatched: winMarket.totalMatched } : null,
      placeMarket: placeMarket ? { marketId: placeMarket.marketId, totalMatched: placeMarket.totalMatched } : null,
      h2hMarkets: h2hMarkets.map(m => ({ marketId: m.marketId, marketName: m.marketName })),
      totalMatched,
      marketBaseRate: primaryMarket?.marketBaseRate ?? null,
      inPlay: primaryMarket?.inPlay ?? false,
      status: primaryMarket?.status ?? 'OPEN',
    },

    markets: marketObjects,
    runners: Array.from(runnerMap.values()),

    externalResearch: includeOpenAIResearch ? {
      openAiSearchUsed: !!externalResearch,
      searchStatus: externalResearch?.searchStatus || 'not_called',
      sourceCount: externalResearch?.sourceCount || 0,
      sources: (externalResearch?.sources || []).slice(0, 10),
      raceSummary: externalResearch?.raceLevelNotes || '',
      runnerResearch: (externalResearch?.runnerResearch || []).slice(0, maxRunners).map(rr => {
        const posCount = (rr.positiveSignals || []).length;
        const negCount = (rr.negativeSignals || []).length;
        const summary = (posCount || negCount)
          ? `${posCount} positive, ${negCount} negative signals from external search`
          : '';
        return {
          selectionId: rr.selectionId,
          runnerName: rr.runnerName,
          positiveSignals: rr.positiveSignals || [],
          negativeSignals: rr.negativeSignals || [],
          summary,
        };
      }),
    } : {
      openAiSearchUsed: false,
      searchStatus: 'disabled',
      sourceCount: 0,
      sources: [],
      raceSummary: '',
      runnerResearch: [],
    },

    settingsUsed: {
      enabledMarketTypes: ['WIN', 'PLACE', 'H2H'],
      minOdds: featherlessSettings?.minOdds ?? 1.5,
      maxOdds: featherlessSettings?.maxOdds ?? 50,
      minLiquidity: featherlessSettings?.minLiquidity ?? 20,
      maxSpreadTicks: featherlessSettings?.maxSpread ?? 7,
      minEdge: featherlessSettings?.minEdge ?? 3,
      minROI: featherlessSettings?.minExpectedROI ?? 1,
      minConfidence: featherlessSettings?.minConfidence ?? 50,
      maxStake: settings?.maxStake ?? 500,
      maxLayLiability: settings?.maxLayLiability ?? 1500,
      timeWindow: {
        startSeconds: featherlessSettings?.timeWindowStart ?? 500,
        endSeconds: featherlessSettings?.timeWindowEnd ?? 30,
      },
    },
  };

  if (includeRiskContext) {
    racePack.botContext = {
      paperMode: opts.paperMode !== false,
      paperProofMode: opts.paperProofMode === true,
      bankroll: bankrollStats?.bankroll ?? settings?.paperBankroll ?? settings?.bankroll ?? 10000,
      currentExposure: bankrollStats?.openPaperExposure ?? 0,
      dailyPnL: bankrollStats?.todayPL ?? 0,
      weeklyPnL: bankrollStats?.weeklyPL ?? 0,
      openOrdersInRace: openOrdersInRace.length,
      previousBetsOnRace: openOrdersInRace.length,
      commissionRate,
      delayedApiMode: true,
      dataFreshness: opts.dataFresh || 'live',
      riskLimits: {
        dailyLossLimit: settings?.dailyLossLimit ?? 500,
        weeklyLossLimit: settings?.weeklyLossLimit ?? 2500,
        maxMarketExposure: settings?.maxMarketExposure ?? 1000,
        maxOpenOrders: settings?.maxOpenOrders ?? 10,
        maxLayLiability: settings?.maxLayLiability ?? 1500,
      },
    };
  }

  return racePack;
}

/**
 * Create a compact summary of the race pack for diagnostics/logging.
 */
export function summarizeRacePack(racePack) {
  if (!racePack) return null;
  return {
    raceId: racePack.raceId,
    eventName: racePack.eventName,
    venue: racePack.venue,
    secondsToJump: racePack.secondsToJump,
    marketCount: racePack.markets?.length || 0,
    runnerCount: racePack.runners?.length || 0,
    winMarketPresent: !!racePack.marketSummary?.winMarket,
    placeMarketPresent: !!racePack.marketSummary?.placeMarket,
    h2hMarketCount: racePack.marketSummary?.h2hMarkets?.length || 0,
    externalResearchUsed: racePack.externalResearch?.openAiSearchUsed || false,
    riskContextIncluded: !!racePack.botContext,
    totalMatched: racePack.marketSummary?.totalMatched || 0,
  };
}