// ============================================================================
// Exchange Opportunity Engine
//
// Orchestrates the full bot cycle:
//   1. Scan all open pre-race markets
//   2. Group by race/event
//   3. Sort by nearest start time, scan only the first N (default 1)
//   4. Fetch/enrich public form data (via AI callback)
//   5. Call AI for probabilities (pWin, pPlace, pBeatsOpponent)
//   6. Generate BACK and LAY opportunities for WIN, PLACE, H2H
//   7. Run exchange EV maths (deterministic — no AI bypass)
//   8. Run safety gates
//   9. Rank all positive-EV opportunities
//  10. Choose best opportunity
//  11. Return best opportunity + all opportunities + diagnostics
//
// The AI call is delegated to a callback so this engine stays pure.
// ============================================================================

import { clusterMarketsByEvent, getPrimaryMarket, getAllMarketsInCluster, detectMarketType } from './marketClusterer';
import { generateOpportunitiesForEvent, rankOpportunities, getBestByCategory } from './crossMarketValueScanner';
import { resolveMarketTypeThresholds, MARKET_TYPE_THRESHOLDS } from './crossMarketValueScanner';
import { getCachedAIResult, setCachedAIResult, getCacheStats } from './exchangeEngineCache';
import { getCachedExternalSearch, setCachedExternalSearch, getExternalSearchCacheStats } from './externalSearchCache';
import { isPaperProofModeActive } from './paperProofDefaults';
import { buildProofOpportunity, getProofFallbackHardGate } from './paperProofScanner';
import { matchRunnerToMarket } from './marketIdMatcher';
import { buildRacePack, summarizeRacePack } from './racePackBuilder';
import { checkMarketEligibility } from './marketEligibility';
import { buildFavouriteValueDiagnostics, generateSpecificNoBetReason } from './favouriteValueContext';
import { groupRaceDayData } from './raceDayLoader';
import { getRaceDayCache, loadRaceDayCache, setRacePacks, updateRaceDayDynamic, pruneRaceDayCache, markRaceScanned } from './raceDayCache';
import { buildRacePackCache, hydrateCachedRacePack, getRaceAiCache, setRaceAiCache } from './racePackCache';
import { scheduleRaceScan, consumeForcedRaceScan } from './raceScanScheduler';
import { DECISION_SOURCES, strategyForDecisionSource, dataSourceForDecisionSource } from './decisionProvenance';
import { beginAiTrace, completeAiTrace, cacheAiTrace, unusedAiTrace } from './aiObservability';
import { buildSideSelectionDiagnostics } from './opportunityRanking';
import { activeRaceOrders, exposureBlock, normalizedMarketId } from './raceExposure';
import { marketCoverage, rejectedRelatedMarkets } from './marketClusterer';
import { calculatePriceFeedStatus } from './marketFreshness';
import { validateCompleteMarketBook } from './marketBookValidation';
import { applyRaceOrderLock, buildRaceMonitoringDiagnostics } from './raceMonitoringDiagnostics';

const OPEN_ORDER_STATUSES = ['pending', 'executable', 'matched', 'unmatched', 'partially_matched'];
const STRATEGY_NAME = 'Featherless AI Value Decision Engine';

// ── Runner-by-market lookup map ──
// Pre-builds a Map<marketIdString, runner[]> in a single O(runners) pass.
// Replaces N×M filter calls (runners.filter(r => matchRunnerToMarket(r, m)))
// with O(1) lookups — massive speedup when markets=400, runners=1000+.
function buildRunnerByMarketMap(runners) {
  const map = new Map();
  for (const r of runners) {
    if (r.status !== 'ACTIVE') continue;
    const ids = [r.marketId, r.betfairMarketId, r.market_id].filter(Boolean).map(String);
    for (const id of ids) {
      let arr = map.get(id);
      if (!arr) { arr = []; map.set(id, arr); }
      arr.push(r);
    }
  }
  return map;
}

function getRunnersForMarket(market, runnersByMarket) {
  if (!market) return [];
  const ids = [market.id, market.marketId, market.betfairMarketId].filter(Boolean).map(String);
  if (ids.length === 0) return [];
  const seen = new Set();
  const result = [];
  for (const id of ids) {
    const arr = runnersByMarket.get(id);
    if (arr) {
      for (const r of arr) {
        if (!seen.has(r)) { seen.add(r); result.push(r); }
      }
    }
  }
  return result;
}

/**
 * Scan all eligible pre-race markets.
 * @returns {Array} Eligible markets (OPEN, not in-play, 2+ runners, in time window)
 */
export function scanEligibleMarkets(markets, runners, settings, debugScanMode = false, runnersByMarket = null) {
  const rMap = runnersByMarket || buildRunnerByMarketMap(runners);

  return markets.filter(m => {
    const marketRunners = getRunnersForMarket(m, rMap);
    const check = checkMarketEligibility(m, marketRunners, settings, { debugScanMode });
    return check.eligible;
  });
}

/**
 * Build pre-filter market feed diagnostics from ALL loaded markets.
 */
function buildMarketFeedDiagnostics(markets, runners, connectionState, runnersByMarket) {
  const nowMs = Date.now();
  let open = 0, closed = 0, suspended = 0, inPlay = 0, notInPlay = 0;
  let withStartTime = 0, withoutStartTime = 0;
  let withRunners = 0, withPriceData = 0, missingPriceData = 0;
  let streamCount = 0, catalogueCount = 0, mergedCount = 0;
  let runnersWithBackPrice = 0, runnersWithLayPrice = 0, runnersWithBackOrLay = 0;

  for (const m of markets) {
    const src = m.source || 'cached';
    if (src === 'stream') streamCount++;
    else if (src === 'catalogue') catalogueCount++;
    else if (src === 'merged') { mergedCount++; streamCount++; catalogueCount++; }
  }

  for (const r of runners) {
    const hasBack = r.bestBackPrice && r.bestBackPrice > 0;
    const hasLay = r.bestLayPrice && r.bestLayPrice > 0;
    if (hasBack) runnersWithBackPrice++;
    if (hasLay) runnersWithLayPrice++;
    if (hasBack || hasLay) runnersWithBackOrLay++;
  }

  for (const m of markets) {
    if (m.status === 'OPEN') open++;
    else if (m.status === 'CLOSED' || m.status === 'SETTLED') closed++;
    else if (m.status === 'SUSPENDED') suspended++;
    if (m.inPlay) inPlay++; else notInPlay++;
    if (m.startTime || m.marketStartTime) withStartTime++; else withoutStartTime++;

    const marketRunners = getRunnersForMarket(m, runnersByMarket);
    const runnerCount = Math.max(m.numberOfRunners || 0, m.numberOfActiveRunners || 0, marketRunners.length);
    if (runnerCount >= 2) withRunners++;

    const hasPriceData = marketRunners.some(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0));
    if (hasPriceData) withPriceData++; else missingPriceData++;
  }

  const lastStreamUpdateAt = connectionState?.lastStreamUpdateAt ?? null;
  const lastCatalogueRefreshAt = connectionState?.lastCatalogueRefreshAt ?? null;
  const streamConnected = connectionState?.streamConnected ?? false;
  const apiConnected = connectionState?.apiConnected ?? false;

  let priceFeedStale = false;
  let marketDataSource = 'none';

  if (markets.length === 0) marketDataSource = 'none';
  else if (streamConnected && mergedCount > 0) marketDataSource = 'merged';
  else if (streamCount > 0 && !catalogueCount) marketDataSource = 'stream_live';
  else if (catalogueCount > 0 && !streamCount) marketDataSource = 'rest_catalogue';
  else if (mergedCount > 0) marketDataSource = 'merged';
  else marketDataSource = 'cached_stale';

  if (apiConnected && withPriceData === 0) priceFeedStale = true;
  if (lastStreamUpdateAt && streamConnected) {
    const ageMs = nowMs - new Date(lastStreamUpdateAt).getTime();
    if (ageMs > 60000) priceFeedStale = true;
  }

  return {
    marketsInMemory: markets.length,
    streamMarketsCount: streamCount,
    catalogueMarketsCount: catalogueCount,
    mergedMarketsCount: mergedCount,
    marketsWithStartTime: withStartTime,
    marketsWithoutStartTime: withoutStartTime,
    marketsOpen: open,
    marketsClosed: closed,
    marketsSuspended: suspended,
    marketsInPlay: inPlay,
    marketsNotInPlay: notInPlay,
    marketsWithRunners: withRunners,
    marketsWithPriceData: withPriceData,
    marketsMissingPriceData: missingPriceData,
    runnersInMemory: runners.length,
    runnersWithBackPrice,
    runnersWithLayPrice,
    runnersWithBackOrLay,
    lastStreamUpdateAt,
    lastCatalogueRefreshAt,
    priceFeedStale,
    marketDataSource,
  };
}

/**
 * Build market filter funnel — full rejection breakdown.
 */
function buildMarketFilterFunnel(markets, runners, settings, debugScanMode, runnersByMarket) {
  let open = 0, closed = 0, suspended = 0;
  let inPlay = 0, notInPlay = 0;
  let withStartTime = 0, withoutStartTime = 0;
  let insideTimeWindow = 0;
  let withTwoRunners = 0, withPriceData = 0;
  let eligible = 0;
  let rejClosed = 0, rejInPlay = 0, rejNoStart = 0, rejTooEarly = 0, rejTooLate = 0, rejNoRunners = 0, rejNoPrices = 0;

  for (const m of markets) {
    if (m.status !== 'OPEN') { if (m.status === 'SUSPENDED') suspended++; else closed++; rejClosed++; continue; }
    open++;
    if (m.inPlay && !settings.allowInPlay) { inPlay++; rejInPlay++; continue; }
    notInPlay++;

    const start = m.startTime ? new Date(m.startTime).getTime() : (m.marketStartTime ? new Date(m.marketStartTime).getTime() : NaN);
    if (isNaN(start)) { withoutStartTime++; rejNoStart++; continue; }
    withStartTime++;

    // Use shared eligibility check for the time-window gate
    const marketRunners = getRunnersForMarket(m, runnersByMarket);
    const check = checkMarketEligibility(m, marketRunners, settings, { debugScanMode });
    if (!check.eligible) {
      const reason = check.reason || '';
      if (reason.includes('Too early')) { rejTooEarly++; continue; }
      if (reason.includes('Too late')) { rejTooLate++; continue; }
      if (reason.includes('Fewer than 2')) { rejNoRunners++; continue; }
    }
    insideTimeWindow++;

    const runnerCount = Math.max(m.numberOfRunners || 0, m.numberOfActiveRunners || 0, marketRunners.length);
    if (runnerCount < 2) { rejNoRunners++; continue; }
    withTwoRunners++;

    const hasPrice = marketRunners.some(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0));
    if (!hasPrice) { rejNoPrices++; continue; }
    withPriceData++;
    eligible++;
  }

  return {
    totalCurrentMarkets: markets.length,
    openMarkets: open,
    suspendedMarkets: suspended,
    closedMarkets: closed,
    nonInPlayMarkets: notInPlay,
    marketsWithStartTime: withStartTime,
    marketsInsideTimeWindow: insideTimeWindow,
    marketsWithTwoActiveRunners: withTwoRunners,
    marketsWithPriceData: withPriceData,
    eligibleMarkets: eligible,
    rejectedBecauseClosed: rejClosed,
    rejectedBecauseInPlay: rejInPlay,
    rejectedBecauseNoStartTime: rejNoStart,
    rejectedBecauseTooEarly: rejTooEarly,
    rejectedBecauseTooLate: rejTooLate,
    rejectedBecauseNoRunners: rejNoRunners,
    rejectedBecauseNoPrices: rejNoPrices,
  };
}

/**
 * Build time-window funnel for all OPEN non-inplay markets.
 */
function buildTimeWindowFunnel(markets, settings, debugScanMode) {
  const windowStart = settings.defaultTimeWindowStartSeconds || 500;
  const windowEnd = settings.defaultTimeWindowEndSeconds || 30;
  const nowMs = Date.now();

  const openNonInPlay = markets.filter(m => m.status === 'OPEN' && !m.inPlay);

  let tooEarly = 0, insideWindow = 0, tooLate = 0, noStartTime = 0;
  const nearestMarkets = [];

  for (const m of openNonInPlay) {
    const start = m.startTime ? new Date(m.startTime).getTime() : (m.marketStartTime ? new Date(m.marketStartTime).getTime() : NaN);
    if (isNaN(start)) {
      noStartTime++;
      nearestMarkets.push({
        marketId: m.betfairMarketId || m.id,
        eventName: m.eventName || '',
        marketName: m.marketName || '',
        marketTypeCode: m.marketTypeCode || m.marketType || '',
        status: m.status,
        inPlay: m.inPlay,
        marketStartTime: m.startTime || m.marketStartTime || null,
        secondsToJump: null,
        timeWindowCategory: 'no_start_time',
      });
      continue;
    }
    const secsBefore = Math.round((start - nowMs) / 1000);
    let category;
    // Use the same single window check as checkMarketEligibility:
    // eligible when windowEnd < secsBefore <= windowStart
    if (debugScanMode) {
      insideWindow++; category = 'inside_window';
    } else if (secsBefore <= windowEnd) { tooLate++; category = 'too_late'; }
    else if (secsBefore > windowStart) { tooEarly++; category = 'too_early'; }
    else { insideWindow++; category = 'inside_window'; }

    nearestMarkets.push({
      marketId: m.betfairMarketId || m.id,
      eventName: m.eventName || '',
      marketName: m.marketName || '',
      marketTypeCode: m.marketTypeCode || m.marketType || '',
      status: m.status,
      inPlay: m.inPlay,
      marketStartTime: m.startTime || m.marketStartTime || null,
      secondsToJump: secsBefore,
      timeWindowCategory: category,
    });
  }

  nearestMarkets.sort((a, b) => {
    if (a.secondsToJump === null && b.secondsToJump === null) return 0;
    if (a.secondsToJump === null) return 1;
    if (b.secondsToJump === null) return -1;
    return a.secondsToJump - b.secondsToJump;
  });

  return {
    tooEarlyMarkets: tooEarly,
    insideWindowMarkets: insideWindow,
    tooLateMarkets: tooLate,
    noStartTimeMarkets: noStartTime,
    windowStartSeconds: windowStart,
    windowEndSeconds: windowEnd,
    debugScanMode,
    nearestMarkets: nearestMarkets.slice(0, 20),
  };
}

/**
 * Build a debug table of the first 50 loaded markets with full details.
 */
function buildLoadedMarketsTable(markets, runnersByMarket) {
  const nowMs = Date.now();
  return markets.slice(0, 50).map(m => {
    const marketRunners = getRunnersForMarket(m, runnersByMarket);
    const runnerCount = Math.max(m.numberOfRunners || 0, m.numberOfActiveRunners || 0, marketRunners.length);
    const hasPriceData = marketRunners.some(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0));
    const start = m.startTime ? new Date(m.startTime).getTime() : (m.marketStartTime ? new Date(m.marketStartTime).getTime() : NaN);
    const secondsToJump = isNaN(start) ? null : Math.round((start - nowMs) / 1000);
    const runnerCountByMarketId = runnersByMarket.get(String(m.id || ''))?.length || 0;
    const runnerCountByBetfairMarketId = runnersByMarket.get(String(m.betfairMarketId || ''))?.length || 0;
    return {
      marketId: m.betfairMarketId || m.id,
      eventName: m.eventName || '',
      marketName: m.marketName || '',
      marketTypeCode: m.marketTypeCode || m.marketType || '',
      detectedMarketType: detectMarketType(m),
      status: m.status,
      inPlay: m.inPlay,
      marketStartTime: m.startTime || m.marketStartTime || null,
      secondsToJump,
      runnerCount,
      runnerCountByMarketId,
      runnerCountByBetfairMarketId,
      hasPriceData,
      totalMatched: m.totalMatched || 0,
    };
  });
}

/**
 * Build a market-only AI result when Featherless AI is disabled.
 */
function buildMarketOnlyAIResult(cluster, marketRunners) {
  const runnerProbabilities = [];
  for (const runner of marketRunners) {
    const backPrice = runner.bestBackPrice || 0;
    const layPrice = runner.bestLayPrice || 0;
    const lastTraded = runner.lastTradedPrice || 0;
    const midPrice = (backPrice + layPrice) / 2 || backPrice || layPrice || lastTraded;
    if (midPrice > 1) {
      runnerProbabilities.push({
        selectionId: String(runner.betfairSelectionId || runner.selectionId || ''),
        runnerName: runner.runnerName || '',
        pWin: 1 / midPrice,
        pPlace: Math.min(0.95, (1 / midPrice) * 1.5),
        confidence: 25,
      });
    }
  }
  const totalP = runnerProbabilities.reduce((s, r) => s + r.pWin, 0);
  if (totalP > 0) {
    for (const r of runnerProbabilities) {
      r.pWin = r.pWin / totalP;
      r.pPlace = Math.min(0.95, r.pPlace / totalP);
    }
  }
  return {
    runnerProbabilities,
    h2hProbabilities: [],
    dataQuality: 30,
    confidence: 25,
    decisionSource: DECISION_SOURCES.DETERMINISTIC_MARKET_ONLY,
    raceSummary: 'Probabilities derived deterministically from Betfair implied odds',
  };
}

/**
 * Run the full exchange opportunity cycle.
 *
 * @param {object} params
 * @param {Array} params.markets - All markets
 * @param {Array} params.runners - All runners
 * @param {object} params.settings - App settings
 * @param {object} params.featherlessSettings - Featherless AI settings
 * @param {object} params.bankrollStats - Current bankroll stats
 * @param {Array} params.paperOrders - Existing paper orders
 * @param {boolean} params.emergencyStop - Emergency stop active
 * @param {Function} params.callAI - async (cluster, primaryMarket, marketRunners) => aiResult
 * @param {object} params.connectionState - Betfair connection state
 * @param {number} params.maxEventsToScan - Max events to call AI for (default 1 — nearest race only)
 * @returns {object} { bestOpportunity, allOpportunities, eventClusters, diagnostics }
 */
export async function runExchangeCycle(params) {
  let {
    markets = [],
    runners = [],
    settings = {},
    botSettings = {},
    featherlessSettings = {},
    bankrollStats = {},
    paperOrders = [],
    emergencyStop = false,
    callAI = null,
    callExternalSearch = null,
    connectionState = {},
    maxEventsToScan = null, // overridden by maxRacesPerCycle from settings
    cycleNumber = null,
  } = params || {};

  // ── Safe argument defaults ──
  markets = Array.isArray(markets) ? markets : [];
  runners = Array.isArray(runners) ? runners : [];
  paperOrders = Array.isArray(paperOrders) ? paperOrders : [];
  settings = settings || {};
  botSettings = botSettings || {};
  featherlessSettings = featherlessSettings || {};
  bankrollStats = bankrollStats || {};
  connectionState = connectionState || {};
  const catalogueMarkets = [...markets];

  // ── Race-day cache: build static structures once, then merge dynamic books ──
  let raceCache = getRaceDayCache();
  const inputMarketIds = new Set(markets.map(m => String(m.betfairMarketId || m.id)));
  const cacheMatchesInput = [...inputMarketIds].some(id => raceCache.marketsById.has(id));
  if (markets.length && (!raceCache.loadedAt || !cacheMatchesInput)) {
    const grouped = groupRaceDayData(markets, runners);
    const packs = buildRacePackCache(grouped.racesByRaceKey, runners);
    raceCache = loadRaceDayCache({ markets, runners, racePacksByRaceKey: packs, fetchedAt: new Date().toISOString(), jurisdiction: 'AU' });
    setRacePacks(packs);
  } else if (raceCache.loadedAt) {
    updateRaceDayDynamic({ markets, runners, source: connectionState?.streamConnected ? 'stream' : 'rest_book', updatedAt: connectionState?.lastStreamUpdateAt || connectionState?.lastCatalogueRefreshAt || new Date().toISOString() });
  }
  pruneRaceDayCache({ orders: paperOrders, retentionHours: featherlessSettings?.completedRaceRetentionHours || 6 });

  // ── Pre-build runner-by-market lookup (single O(runners) pass) ──
  let runnersByMarket = buildRunnerByMarketMap(runners);

  // ── Build pre-filter diagnostics from ALL loaded markets ──
  const marketFeedDiagnostics = buildMarketFeedDiagnostics(markets, runners, connectionState, runnersByMarket);

  const debugScanMode = featherlessSettings?.debugScanMode === true;

  // ── Paper Proof Mode ──
  const paperProofMode = isPaperProofModeActive(settings, botSettings, featherlessSettings);

  // ── Build market filter funnel ──
  const marketFilterFunnel = buildMarketFilterFunnel(markets, runners, settings, debugScanMode, runnersByMarket);

  const timeWindowFunnel = buildTimeWindowFunnel(markets, settings, debugScanMode);

  // ── Build loaded markets debug table (first 50) ──
  const loadedMarketsTable = buildLoadedMarketsTable(markets, runnersByMarket);

  const authoritativePrice = calculatePriceFeedStatus(connectionState?.lastActualPriceUpdateAt, Date.now(), settings?.dataFreshnessLimit || 30, !!connectionState?.streamError);
  const connectionDiagnostics = {
    betfairApiConnected: connectionState?.apiConnected ?? false,
    streamConnected: connectionState?.streamConnected ?? false,
    lastStreamUpdateAt: connectionState?.lastStreamUpdateAt ?? null,
    lastCatalogueRefreshAt: connectionState?.lastCatalogueRefreshAt ?? null,
    marketCatalogueError: connectionState?.marketCatalogueError ?? null,
    streamError: connectionState?.streamError ?? null,
    priceFeedStatus: authoritativePrice.priceFeedStatus,
    priceAgeSeconds: authoritativePrice.priceAgeSeconds,
    staleThresholdSeconds: authoritativePrice.staleThresholdSeconds,
    authoritativePriceTimestamp: authoritativePrice.authoritativePriceTimestamp,
    priceFeedStale: authoritativePrice.priceFeedStale,
  };

  const forcedScan = consumeForcedRaceScan();
  const schedule = scheduleRaceScan(raceCache.racesByRaceKey, { windowStart: featherlessSettings?.timeWindowStart ?? settings.defaultTimeWindowStartSeconds ?? 500, windowEnd: featherlessSettings?.timeWindowEnd ?? settings.defaultTimeWindowEndSeconds ?? 30, forceNext: forcedScan || debugScanMode || paperProofMode });
  const selectedRace = schedule.selectedRaceForScan;
  let hydratedRacePack = null;
  if (selectedRace) {
    const ids = new Set(selectedRace.markets.map(m => String(m.betfairMarketId || m.id)));
    markets = selectedRace.markets.map(m => raceCache.marketsById.get(String(m.betfairMarketId || m.id)) || m);
    runners = [...ids].flatMap(id => raceCache.runnersByMarketId.get(id) || []);
    runnersByMarket = buildRunnerByMarketMap(runners);
    hydratedRacePack = hydrateCachedRacePack(raceCache.racePacksByRaceKey.get(selectedRace.raceKey), { markets, runners, settings, featherlessSettings, bankrollStats, paperOrders, opts: { paperMode: true, paperProofMode, dataFresh: selectedRace.freshnessStatus } });
    const trackedRace = markRaceScanned(selectedRace.raceKey, Date.now(), '', cycleNumber);
    if (trackedRace) Object.assign(selectedRace, { cyclesScannedOnThisRace:trackedRace.cyclesScannedOnThisRace, firstCycleSeenForRace:trackedRace.firstCycleSeenForRace, latestCycleSeenForRace:trackedRace.latestCycleSeenForRace });
  }
  let raceMonitoring = buildRaceMonitoringDiagnostics({ selectedRace:null, runners, orders:paperOrders, windowStart:featherlessSettings?.timeWindowStart ?? settings.defaultTimeWindowStartSeconds ?? 500, windowEnd:featherlessSettings?.timeWindowEnd ?? settings.defaultTimeWindowEndSeconds ?? 30 });

  if (!selectedRace && raceCache.loadedAt && !emergencyStop) {
    return { bestOpportunity: null, allOpportunities: [], eventClusters: [], diagnostics: { raceMonitoring, ...raceMonitoring, noBetReason: 'No cached race currently inside scan window', noScanReason: schedule.selectionReason, marketsScanned: 0, eventsScanned: 0, totalMarketsLoaded: raceCache.summary.totalMarketsLoaded || 0, marketsSentToExchangeEngine: 0, raceDayLoaded: true, raceDayLoadedAt: raceCache.loadedAt, totalDayRaces: raceCache.summary.totalRacesLoaded || 0, totalDayMarkets: raceCache.summary.totalMarketsLoaded || 0, cachedRacePacks: raceCache.racePacksByRaceKey.size, racesInsideWindow: schedule.racesInsideWindow, nextRaceWindowOpensAt: schedule.nextRaceWindowOpensAt, opportunityFunnel: { ...raceMonitoring, raceDayLoaded: true, raceDayLoadedAt: raceCache.loadedAt, totalDayRaces: raceCache.summary.totalRacesLoaded || 0, totalDayMarkets: raceCache.summary.totalMarketsLoaded || 0, cachedRacePacks: raceCache.racePacksByRaceKey.size, racesInsideWindow: schedule.racesInsideWindow, noScanReason: schedule.selectionReason, nextRaceWindowOpensAt: schedule.nextRaceWindowOpensAt }, nextRace: schedule.nextRace ? { raceKey: schedule.nextRace.raceKey, eventName: schedule.nextRace.eventName, startTime: schedule.nextRace.startTime, secondsToJump: schedule.nextRace.secondsToJump } : null, marketFeedDiagnostics, marketFilterFunnel, timeWindowFunnel, loadedMarketsTable, connectionDiagnostics, debugScanMode } };
  }

  const totalMarketsLoaded = markets.length;
  const openPreRaceMarkets = markets.filter(m => m.status === 'OPEN' && !m.inPlay).length;
  const marketsInsideTimeWindow = timeWindowFunnel.insideWindowMarkets;

  // 1. Scan all eligible pre-race markets
  const eligibleMarkets = scanEligibleMarkets(markets, runners, settings, debugScanMode, runnersByMarket);

  const eligibleAfterRunnerFilter = eligibleMarkets.length;
  const eligibleAfterPriceFilter = eligibleMarkets.filter(m => {
    const marketRunners = getRunnersForMarket(m, runnersByMarket);
    return marketRunners.some(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0));
  }).length;
  raceMonitoring = buildRaceMonitoringDiagnostics({ selectedRace, runners, orders:paperOrders, acceptedMarketIds:eligibleMarkets.map(normalizedMarketId), windowStart:featherlessSettings?.timeWindowStart ?? settings.defaultTimeWindowStartSeconds ?? 500, windowEnd:featherlessSettings?.timeWindowEnd ?? settings.defaultTimeWindowEndSeconds ?? 30 });

  if (emergencyStop) {
    return { bestOpportunity:null, allOpportunities:[], eventClusters:[], diagnostics:{ raceMonitoring, ...raceMonitoring, noBetReason:'Emergency stop active', marketsScanned:0, eventsScanned:0, marketFeedDiagnostics, timeWindowFunnel, loadedMarketsTable, connectionDiagnostics, debugScanMode } };
  }

  if (eligibleMarkets.length === 0) {
    let reason;
    if (totalMarketsLoaded === 0) {
      reason = 'No Betfair market data loaded — connect your Betfair session in Setup, then click Refresh Markets';
    } else if (debugScanMode) {
      reason = `No open pre-race markets with 2+ runners found (${totalMarketsLoaded} markets loaded, ${openPreRaceMarkets} open pre-race)`;
    } else {
      reason = `No eligible markets in time window — ${marketsInsideTimeWindow} inside window, ${timeWindowFunnel.tooEarlyMarkets} too early, ${timeWindowFunnel.tooLateMarkets} too late, ${timeWindowFunnel.noStartTimeMarkets} no start time (of ${openPreRaceMarkets} open pre-race markets)`;
    }
    return {
      bestOpportunity: null,
      allOpportunities: [],
      eventClusters: [],
      diagnostics: {
        raceMonitoring,
        ...raceMonitoring,
        noBetReason: reason,
        marketsScanned: 0,
        eventsScanned: 0,
        marketFeedDiagnostics,
        marketFilterFunnel,
        timeWindowFunnel,
        loadedMarketsTable,
        connectionDiagnostics,
        debugScanMode,
        totalMarketsLoaded,
        openPreRaceMarkets,
        marketsInsideTimeWindow,
        eligibleMarketsAfterRunnerFilter: eligibleAfterRunnerFilter,
        eligibleMarketsAfterPriceFilter: eligibleAfterPriceFilter,
        marketsSentToExchangeEngine: 0,
        marketDetectionLog: [],
      },
    };
  }

  // 2. Group by event/race
  const eventClusters = clusterMarketsByEvent(eligibleMarkets);

  // ── Sort clusters by nearest start time — scan the most imminent race first ──
  eventClusters.sort((a, b) => {
    const aStart = a.startTime ? new Date(a.startTime).getTime() : Infinity;
    const bStart = b.startTime ? new Date(b.startTime).getTime() : Infinity;
    return aStart - bStart;
  });

  // ── Only scan the first maxEventsToScan events (default 1) ──
  // This is the single biggest speedup: 1 AI call instead of N.
  // All clusters are still reported in diagnostics for transparency.
  const totalEventClusters = eventClusters.length;
  const effectiveMaxEvents = maxEventsToScan || featherlessSettings?.maxRacesPerCycle || 1;
  const clustersToScan = eventClusters.slice(0, effectiveMaxEvents);

  // ── Market detection log ──
  const marketDetectionLog = eligibleMarkets.map(m => {
    const detectedMarketType = detectMarketType(m);
    const marketRunners = getRunnersForMarket(m, runnersByMarket);
    return {
      marketId: m.betfairMarketId || m.id,
      marketName: m.marketName || '',
      marketTypeCode: m.marketTypeCode || m.marketType || '',
      eventId: m.eventId || '',
      detectedMarketType,
      numberOfWinners: m.numberOfWinners || 0,
      marketBaseRate: m.marketBaseRate ?? null,
      totalMatched: m.totalMatched || 0,
      runnerCount: Math.max(m.numberOfRunners || 0, m.numberOfActiveRunners || 0, marketRunners.length),
    };
  });

  // 3-4. For each event, call AI for probabilities and generate opportunities
  const allOpportunities = [];
  const aiDecisions = [];
  const aiStatusLog = [];
  const aiObservability = [];
  let aiRequiredFailures = 0;
  let eventsScanned = 0;
  let eventsWithAI = 0;
  let cacheHits = 0;
  let marketOnlyResultsCreated = 0;
  let clustersWithPrimaryMarket = 0;
  let clustersWithMatchedRunners = 0;
  let proofFallbackAttempted = false;
  let proofFallbackCreated = false;
  let proofFallbackBlockedReason = null;

  const externalSearchPerEvent = [];
  let extSearchCalls = 0;
  let extSearchCacheHits = 0;
  let extSearchCacheMisses = 0;
  let extSearchTimeouts = 0;
  let extSearchErrors = 0;
  let extSearchNoResults = 0;
  let extTotalSources = 0;
  let extRunnersAffected = 0;
  const extProbabilityChanges = [];
  const extDecisionChanges = [];
  let extLatestQuery = '';
  let extLatestSummary = '';
  let extLatestStatus = 'not_requested';
  let extNextRetryAt = null;
  let extErrorType = null;
  let extBackoffSeconds = null;
  const extSearchEnabled = featherlessSettings?.externalSearchEnabled === true;
  const extCacheTtlMs = (featherlessSettings?.externalSearchCacheTtlMinutes || 5) * 60 * 1000;

  // ── Race Assessment tracking ──
  const raceAssessments = [];
  let featherlessCalled = 0;
  let featherlessSucceeded = 0;
  let featherlessFailed = 0;
  let featherlessTimedOut = 0;
  let featherlessNotConfigured = 0;
  let marketOnlyFallbacksUsed = 0;
  let racePacksBuilt = 0;
  let totalRunnerProbabilitiesReturned = 0;
  let totalH2HProbabilitiesReturned = 0;
  let totalRecommendedOpportunitiesReturned = 0;
  let featherlessTotalLatencyMs = 0;
  let localEngineOverruledFeatherless = 0;
  const featherlessAlwaysRequired = featherlessSettings?.featherlessAlwaysRequired !== false;
  const allowDeterministicFallback = featherlessSettings?.allowDeterministicFallback === true;
  const selectedStrategies = botSettings?.selectedStrategies || [];
  const aiRequired = featherlessAlwaysRequired || selectedStrategies.includes('Featherless AI Value Decision Engine');

  const uniqueEligibleMarkets = [...new Map(eligibleMarkets.map(m => [normalizedMarketId(m), m])).values()];
  const marketTypeCounts = uniqueEligibleMarkets.reduce((acc, m) => {
    const type = detectMarketType(m);
    if (type === 'WIN') acc.winMarketsFound++;
    else if (type === 'PLACE') acc.placeMarketsFound++;
    else if (type === 'H2H') acc.h2hMarketsFound++;
    else acc.unknownMarketsFound++;
    return acc;
  }, { winMarketsFound: 0, placeMarketsFound: 0, h2hMarketsFound: 0, unknownMarketsFound: 0 });

  for (const cluster of clustersToScan) {
    eventsScanned++;
    const primaryMarket = getPrimaryMarket(cluster);
    if (!primaryMarket) continue;
    clustersWithPrimaryMarket++;

    const marketRunners = getRunnersForMarket(primaryMarket, runnersByMarket);

    if (marketRunners.length === 0) continue;
    clustersWithMatchedRunners++;

    // ══════════════════════════════════════════════════════════════════
    // RACE-FIRST FLOW: Build full race pack → Call Featherless → Generate
    // ══════════════════════════════════════════════════════════════════
    // The bot selects the race, builds a full race pack with ALL markets,
    // runners, prices, external research, and risk context — then sends
    // the entire pack to Featherless for a full race assessment.
    // Featherless sees the ENTIRE race before any opportunity is selected.

    // ── Step 1: External search (runs first so results go into the race pack) ──
    let externalSearchResult = null;
    if (extSearchEnabled && callExternalSearch) {
      const eventName = cluster.eventName || primaryMarket.eventName || '';
      const marketStartTime = primaryMarket.startTime || primaryMarket.marketStartTime || '';
      const cached = debugScanMode ? null : getCachedExternalSearch(cluster.eventId, eventName, marketStartTime, marketRunners);
      if (cached) {
        extSearchCacheHits++;
        externalSearchResult = { ...cached, searchStatus: 'success', operationStatus: cached.cacheStatus || 'cache_hit_success' };
        extLatestStatus = externalSearchResult.operationStatus;
        externalSearchPerEvent.push({ eventId: cluster.eventId, eventName, searchStatus: externalSearchResult.operationStatus || externalSearchResult.searchStatus, sourceCount: cached.sourceCount || 0, dataQuality: cached.dataQuality || 0, runnersResearched: (cached.runnerResearch || []).length, cacheHit: true });
      } else {
        extSearchCacheMisses++;
        extSearchCalls++;
        extLatestStatus = 'requested';
        try {
          externalSearchResult = await callExternalSearch(cluster, primaryMarket, marketRunners);
          if (externalSearchResult) {
            if (!debugScanMode && (externalSearchResult.searchStatus === 'success' || externalSearchResult.searchStatus === 'no_results')) {
              setCachedExternalSearch(cluster.eventId, eventName, marketStartTime, marketRunners, externalSearchResult, extCacheTtlMs);
            }
            extTotalSources += externalSearchResult.sourceCount || 0;
            extRunnersAffected += (externalSearchResult.runnerResearch || []).length;
            extLatestQuery = externalSearchResult.searchQuery || extLatestQuery;
            if (externalSearchResult.searchStatus === 'no_results') externalSearchResult = { ...externalSearchResult, searchStatus: 'error', errorCode: 'EMPTY_RESULTS', errorMessage: externalSearchResult.errorMessage || 'Search returned no usable sources' };
            extLatestStatus = externalSearchResult.searchStatus || extLatestStatus;
            extNextRetryAt = externalSearchResult.nextRetryAt || extNextRetryAt;
            extErrorType = externalSearchResult.errorType || extErrorType;
            extBackoffSeconds = externalSearchResult.backoffSeconds || extBackoffSeconds;
            if (externalSearchResult.searchStatus === 'error_backoff') extSearchCalls=Math.max(0,extSearchCalls-1);
            if (externalSearchResult.searchStatus === 'success' && externalSearchResult.raceLevelNotes) extLatestSummary = externalSearchResult.raceLevelNotes.slice(0, 200);
            if (externalSearchResult.searchStatus === 'timeout') extSearchTimeouts++;
            else if (externalSearchResult.searchStatus === 'error') extSearchErrors++;
            else if (externalSearchResult.searchStatus === 'no_results') extSearchNoResults++;
            externalSearchPerEvent.push({ eventId: cluster.eventId, eventName, searchStatus: externalSearchResult.searchStatus, sourceCount: externalSearchResult.sourceCount || 0, dataQuality: externalSearchResult.dataQuality || 0, runnersResearched: (externalSearchResult.runnerResearch || []).length, cacheHit: false, errorMessage: externalSearchResult.errorMessage || null });
          }
        } catch (extErr) {
          const isTimeout = extErr.message?.toLowerCase().includes('timeout');
          if (isTimeout) extSearchTimeouts++; else extSearchErrors++;
          externalSearchResult = { searchStatus: isTimeout ? 'timeout' : 'error', sourceCount: 0, sources: [], runnerResearch: [], raceLevelNotes: '', dataQuality: 0, errorMessage: extErr.message, searchQuery: '', searchedAt: new Date().toISOString(), searchProvider: 'openai_web_search' };
          externalSearchPerEvent.push({ eventId: cluster.eventId, eventName, searchStatus: externalSearchResult.searchStatus, sourceCount: 0, dataQuality: 0, runnersResearched: 0, cacheHit: false, errorMessage: extErr.message });
        }
      }
    }

    // ── Step 2: Build the RacePack ──
    const racePack = hydratedRacePack && selectedRace
      ? hydrateCachedRacePack(raceCache.racePacksByRaceKey.get(selectedRace.raceKey), { markets, runners, settings, featherlessSettings, bankrollStats, paperOrders, externalResearch: externalSearchResult, opts: { paperMode: true, paperProofMode, dataFresh: selectedRace.freshnessStatus } })
      : buildRacePack(cluster, runners, markets, settings, featherlessSettings, bankrollStats, paperOrders, externalSearchResult, {
          paperMode: true,
          paperProofMode,
          dataFresh: connectionState?.priceFeedStale ? 'stale' : 'live',
        });
    racePacksBuilt++;
    const racePackSummary = summarizeRacePack(racePack);

    // ── Step 3: Call Featherless with the FULL race pack ──
    const raceAiCache = !debugScanMode && selectedRace ? getRaceAiCache(selectedRace.raceKey, marketRunners, featherlessSettings?.majorPriceMoveTicks || 5, featherlessSettings?.rerunAiOnMajorPriceMove !== false) : null;
    let aiResult = debugScanMode ? null : (raceAiCache?.featherlessResult || getCachedAIResult(cluster, marketRunners));
    let aiTrace = null;
    let usedMarketOnlyFallback = false;
    let featherlessStatus = 'not_called';
    let featherlessLatencyMs = 0;
    let featherlessDataQuality = 0;
    let featherlessConfidence = 0;
    let featherlessRecommendedOpp = null;

    if (aiResult) {
      cacheHits++;
      aiResult = { ...aiResult, decisionSource:DECISION_SOURCES.CACHE };
      aiTrace = cacheAiTrace({ raceKey:cluster.raceKey || cluster.eventId, model:featherlessSettings?.modelName, runnerCount:marketRunners.length, result:aiResult });
      aiStatusLog.push({ eventId: cluster.eventId, status: 'cache_hit' });
      featherlessStatus = 'cache_hit';
      featherlessDataQuality = aiResult.dataQuality || 0;
      featherlessConfidence = aiResult.confidence || aiResult.dataQuality || 0;
    } else if (callAI) {
      featherlessCalled++;
      aiTrace = beginAiTrace({ raceKey:cluster.raceKey || cluster.eventId, provider:'featherless', model:featherlessSettings?.modelName, runnerCount:marketRunners.length, selectionIds: marketRunners.map(runner => String(runner.betfairSelectionId || runner.selectionId || '')).filter(Boolean) });
      const flStart = Date.now();
      try {
        aiResult = await callAI(cluster, primaryMarket, marketRunners, racePack);
        featherlessLatencyMs = Date.now() - flStart;
        featherlessTotalLatencyMs += featherlessLatencyMs;
        if (aiResult) {
          aiResult = { ...aiResult, decisionSource:DECISION_SOURCES.FEATHERLESS_AI };
          aiTrace = completeAiTrace(aiTrace, aiResult);
          if (!debugScanMode) {
            setCachedAIResult(cluster, marketRunners, aiResult);
            if (selectedRace) setRaceAiCache(selectedRace.raceKey, aiResult, marketRunners, featherlessSettings?.aiResultCacheTtlSeconds || 90);
          }
          eventsWithAI++;
          featherlessSucceeded++;
          featherlessStatus = aiResult.featherlessStatus || 'success';
          featherlessDataQuality = aiResult.dataQuality || 0;
          featherlessConfidence = aiResult.confidence || aiResult.dataQuality || 0;
          totalRunnerProbabilitiesReturned += (aiResult.runnerProbabilities?.length || 0);
          totalH2HProbabilitiesReturned += (aiResult.h2hProbabilities?.length || 0);
          totalRecommendedOpportunitiesReturned += (aiResult.recommendedOpportunities?.length || 0);
          featherlessRecommendedOpp = aiResult.recommendedOpportunities?.[0] || null;
          aiStatusLog.push({ eventId: cluster.eventId, status: 'ai_called', success: true, returnedProbabilities: true, latencyMs: featherlessLatencyMs });
          aiDecisions.push({ eventId: cluster.eventId, aiResult });
        } else {
          featherlessFailed++;
          featherlessStatus = 'failed';
          aiTrace = completeAiTrace(aiTrace, null, new Error('AI returned no valid response'));
          aiStatusLog.push({ eventId: cluster.eventId, status: 'ai_called', success: false, reason: 'AI returned null' });
        }
      } catch (err) {
        const isTimeout = err.message?.toLowerCase().includes('timeout') || err.code === 'ETIMEDOUT';
        featherlessLatencyMs = Date.now() - flStart;
        featherlessTotalLatencyMs += featherlessLatencyMs;
        if (isTimeout) { featherlessTimedOut++; featherlessStatus = 'timeout'; }
        else { featherlessFailed++; featherlessStatus = 'failed'; }
        aiTrace = completeAiTrace(aiTrace, null, err);
        aiStatusLog.push({ eventId: cluster.eventId, status: isTimeout ? 'ai_timeout' : 'ai_error', reason: err.message, latencyMs: featherlessLatencyMs });
      }
    } else {
      featherlessNotConfigured++;
      featherlessStatus = 'not_configured';
      aiTrace = unusedAiTrace({ raceKey:cluster.raceKey || cluster.eventId, model:featherlessSettings?.modelName, runnerCount:marketRunners.length, error:'AI disabled or unavailable' });
      aiStatusLog.push({ eventId: cluster.eventId, status: 'ai_disabled' });
    }
    aiObservability.push(aiTrace || unusedAiTrace({ raceKey:cluster.raceKey || cluster.eventId, model:featherlessSettings?.modelName, runnerCount:marketRunners.length }));

    // ── Step 4: Handle Featherless failure ──
    const isNormalMode = !paperProofMode && !debugScanMode;

    if (!aiResult) {
      if (allowDeterministicFallback) {
        aiResult = buildMarketOnlyAIResult(cluster, marketRunners);
        aiResult.decisionSource = DECISION_SOURCES.DETERMINISTIC_MARKET_ONLY;
        aiResult.featherlessStatus = featherlessStatus;
        usedMarketOnlyFallback = true;
        marketOnlyFallbacksUsed++;
        marketOnlyResultsCreated++;
        const reason = !callAI ? 'Featherless not configured — market-implied probabilities' : `Featherless ${featherlessStatus} — market-implied fallback`;
        aiStatusLog.push({ eventId: cluster.eventId, status: 'market_only_fallback', success: true, reason });
      } else if (aiRequired) {
        aiRequiredFailures++;
        raceAssessments.push({ eventId: cluster.eventId, eventName: cluster.eventName, racePackSummary, featherlessCalled: featherlessStatus !== 'not_configured', featherlessStatus, featherlessLatencyMs, featherlessDataQuality: 0, featherlessConfidence: 0, runnerProbabilitiesReturned: 0, h2hProbabilitiesReturned: 0, recommendedOpportunitiesReturned: 0, featherlessRecommendedOpp: null, opportunitiesGenerated: 0, localEngineOverruled: false, overruleReason: 'AI_REQUIRED_BUT_NOT_AVAILABLE', failedGate:'AI_REQUIRED_BUT_NOT_AVAILABLE', finalDecision: 'NO_BET', finalReason: 'AI_REQUIRED_BUT_NOT_AVAILABLE', decisionSource: null });
        continue;
      } else {
        continue;
      }
    }
    if (aiResult && !aiResult.decisionSource) aiResult.decisionSource = usedMarketOnlyFallback ? DECISION_SOURCES.DETERMINISTIC_MARKET_ONLY : DECISION_SOURCES.FEATHERLESS_AI;
    if (aiResult) aiResult.featherlessStatus = featherlessStatus;

    // ── Step 5: Generate opportunities using Featherless probabilities ──
    // The local exchange engine creates BACK/LAY opportunities across
    // WIN/PLACE/H2H using Featherless probabilities as model probabilities.
    // The local engine is the final mathematical and safety authority.
    const opportunities = generateOpportunitiesForEvent(
      cluster, runners, aiResult, settings, botSettings, featherlessSettings, bankrollStats, paperOrders, externalSearchResult
    );
    allOpportunities.push(...opportunities);

    if (externalSearchResult && externalSearchResult.searchStatus === 'success') {
      const oppsWithDelta = opportunities.filter(o => Math.abs(o.probabilityDelta || 0) > 0.001);
      for (const opp of oppsWithDelta) {
        extProbabilityChanges.push({
          eventId: cluster.eventId,
          runnerName: opp.runnerName,
          selectionId: opp.selectionId,
          preSearchProbability: opp.preSearchProbability,
          postSearchProbability: opp.postSearchProbability,
          probabilityDelta: opp.probabilityDelta,
          decisionImpact: opp.decisionImpact,
        });
      }

      const sortedPre = [...opportunities].sort((a, b) => (b.preSearchProbability || 0) - (a.preSearchProbability || 0));
      const sortedPost = [...opportunities].sort((a, b) => (b.postSearchProbability || 0) - (a.postSearchProbability || 0));
      const bestPre = sortedPre[0];
      const bestPost = sortedPost[0];
      if (bestPre && bestPost && bestPre.selectionId !== bestPost.selectionId) {
        extDecisionChanges.push({
          eventId: cluster.eventId,
          runnerName: bestPost.runnerName,
          was: bestPre.runnerName,
          changedTo: bestPost.decision,
          reason: `External search changed best runner from ${bestPre.runnerName} to ${bestPost.runnerName}`,
        });
      }
    }

    // ── Track race assessment for diagnostics ──
    const betOpps = opportunities.filter(o => o.decision === 'BET');
    const bestLocalOpp = rankOpportunities(betOpps)[0] || null;
    let localOverruled = false;
    let overruleReason = null;
    if (featherlessRecommendedOpp && bestLocalOpp) {
      const flSelId = String(featherlessRecommendedOpp.selectionId || '');
      const localSelId = String(bestLocalOpp.selectionId || '');
      const flSide = featherlessRecommendedOpp.side;
      if (flSelId !== localSelId || flSide !== bestLocalOpp.side) {
        localOverruled = true;
        overruleReason = `Featherless recommended ${flSide} ${featherlessRecommendedOpp.runnerName}, but local engine selected ${bestLocalOpp.side} ${bestLocalOpp.runnerName}`;
      } else if (bestLocalOpp.blockers?.length > 0) {
        localOverruled = true;
        overruleReason = `Featherless recommended ${flSide} ${featherlessRecommendedOpp.runnerName}, but local engine rejected: ${bestLocalOpp.blockers[0]}`;
      }
    }
    if (localOverruled) localEngineOverruledFeatherless++;
    raceAssessments.push({
      eventId: cluster.eventId,
      eventName: cluster.eventName,
      racePackSummary,
      featherlessCalled: featherlessStatus !== 'not_called' && featherlessStatus !== 'not_configured',
      featherlessStatus,
      featherlessLatencyMs,
      featherlessDataQuality,
      featherlessConfidence,
      runnerProbabilitiesReturned: aiResult?.runnerProbabilities?.length || 0,
      h2hProbabilitiesReturned: aiResult?.h2hProbabilities?.length || 0,
      recommendedOpportunitiesReturned: aiResult?.recommendedOpportunities?.length || 0,
      featherlessRecommendedOpp: featherlessRecommendedOpp ? { selectionId: featherlessRecommendedOpp.selectionId, runnerName: featherlessRecommendedOpp.runnerName, side: featherlessRecommendedOpp.side, marketType: featherlessRecommendedOpp.marketType, estimatedEdge: featherlessRecommendedOpp.estimatedEdge } : null,
      opportunitiesGenerated: opportunities.length,
      bestLocalOpportunity: bestLocalOpp ? { selectionId: bestLocalOpp.selectionId, runnerName: bestLocalOpp.runnerName, side: bestLocalOpp.side, marketType: bestLocalOpp.marketType, ev: bestLocalOpp.ev, decision: bestLocalOpp.decision } : null,
      localEngineOverruled: localOverruled,
      overruleReason,
      finalDecision: bestLocalOpp ? 'BET' : 'NO_BET',
      finalReason: bestLocalOpp ? `${bestLocalOpp.side} ${bestLocalOpp.runnerName} — EV $${bestLocalOpp.ev.toFixed(2)}` : (opportunities.length > 0 ? `All ${opportunities.length} opportunities blocked by safety gates` : 'No opportunities generated'),
      decisionSource: aiResult?.decisionSource || 'UNKNOWN',
    });
  }

  applyRaceOrderLock(allOpportunities, raceMonitoring);

  // ── Collect favourite contexts from opportunities (for diagnostics) ──
  const favouriteContextsDetected = [];
  const seenFavSelectionIds = new Set();
  for (const opp of allOpportunities) {
    if (opp.favouriteSelectionId && !seenFavSelectionIds.has(opp.favouriteSelectionId)) {
      seenFavSelectionIds.add(opp.favouriteSelectionId);
      favouriteContextsDetected.push({
        favouriteSelectionId: opp.favouriteSelectionId,
        favouriteName: opp.favouriteName,
        favouriteOdds: opp.favouriteOdds,
        favouriteDominanceScore: opp.favouriteDominanceScore,
        fieldStrengthCategory: opp.fieldStrengthCategory,
        qualityThreatCount: opp.qualityThreatCount,
        favouriteLooksStrong: opp.fieldStrengthCategory === 'DOMINANT' || opp.fieldStrengthCategory === 'STRONG',
        favouriteLooksVulnerable: opp.fieldStrengthCategory === 'VULNERABLE' || opp.fieldStrengthCategory === 'WEAK',
      });
    }
  }

  // Stale or unavailable prices are an absolute rejection gate, never a score penalty.
  if (connectionDiagnostics.priceFeedStatus !== 'LIVE') {
    const failedGate = connectionDiagnostics.priceFeedStatus === 'STALE' ? 'STALE_PRICE_DATA' : 'PRICE_DATA_UNAVAILABLE';
    for (const opportunity of allOpportunities) {
      opportunity.decision = 'REJECT';
      opportunity.gatesPassed = false;
      opportunity.failedGate = failedGate;
      opportunity.blockers = [failedGate, ...(opportunity.blockers || []).filter(item => item !== failedGate)];
    }
  }

  // 8. Rank all opportunities by EV
  let ranked = rankOpportunities(allOpportunities);

  // 9. Choose best positive-EV opportunity
  let bestNormalOpportunity = ranked.find(o => o.decision === 'BET') || null;
  let bestOpportunity = bestNormalOpportunity;
  let proofFallbackOpportunity = null;
  const normalOpportunities = [...ranked];

  // ── Paper Proof Fallback: only after every hard gate is known to pass ──
  if (!debugScanMode && !bestOpportunity && paperProofMode) {
    proofFallbackAttempted = true;
    const proofSafetyContext = {
      priceFeedStatus:connectionDiagnostics.priceFeedStatus,
      raceMonitoring,
      now:Date.now(),
      windowStart:featherlessSettings?.timeWindowStart ?? settings.defaultTimeWindowStartSeconds ?? 500,
      windowEnd:featherlessSettings?.timeWindowEnd ?? settings.defaultTimeWindowEndSeconds ?? 30,
    };
    const hardGate = getProofFallbackHardGate(proofSafetyContext);
    const proofOpp = hardGate ? null : buildProofOpportunity(eventClusters, runners, paperOrders, settings, proofSafetyContext);
    if (proofOpp) {
      proofFallbackOpportunity = { ...proofOpp, decisionSource:DECISION_SOURCES.PROOF_OVERRIDE };
      allOpportunities.push(proofFallbackOpportunity);
      proofFallbackCreated = true;
    } else {
      proofFallbackBlockedReason = hardGate || proofFallbackBlockedReason;
      if (hardGate) {
        // The authoritative hard-gate reason must not be replaced by candidate diagnostics.
      } else if (eventClusters.length === 0) {
        proofFallbackBlockedReason = 'no eligible event clusters';
      } else {
        let hasMatchedRunners = false;
        let hasActiveRunners = false;
        let hasBackOrLayPrices = false;
        let hasDuplicateOrder = false;
        let hasOpenMarket = false;
        let hasPlaceMarket = false;
        let hasSupportedProofMarket = false;
        for (const cluster of eventClusters) {
          const allMarkets = [...cluster.winMarkets, ...cluster.placeMarkets, ...cluster.h2hMarkets];
          for (const market of allMarkets) {
            if (market.status !== 'OPEN') continue;
            hasOpenMarket = true;
            if (market.inPlay) continue;
            const proofMarketType = detectMarketType(market);
            if (proofMarketType === 'PLACE') hasPlaceMarket = true;
            else if (proofMarketType !== 'UNKNOWN') hasSupportedProofMarket = true;
            const raceLike = { ...market, eventId:cluster.eventId, eventName:cluster.eventName, raceNumber:cluster.raceNumber, venue:cluster.venue, startTime:cluster.startTime || market.startTime || market.marketStartTime };
            if (activeRaceOrders(paperOrders, raceLike).length || exposureBlock(paperOrders, raceLike, settings)) hasDuplicateOrder = true;
            const marketRunners = getRunnersForMarket(market, runnersByMarket);
            if (marketRunners.length > 0) hasMatchedRunners = true;
            for (const runner of marketRunners) {
              hasActiveRunners = true;
              if ((runner.bestBackPrice > 0 && (runner.bestBackSize || 0) >= 2) ||
                  (runner.bestLayPrice > 0 && (runner.bestLaySize || 0) >= 2)) hasBackOrLayPrices = true;
            }
          }
        }
        if (!hasOpenMarket) proofFallbackBlockedReason = 'no OPEN markets in event clusters';
        else if (hasPlaceMarket && !hasSupportedProofMarket) proofFallbackBlockedReason = 'PLACE_MODEL_NOT_VALIDATED';
        else if (!hasMatchedRunners) proofFallbackBlockedReason = 'no market matched runners';
        else if (!hasActiveRunners) proofFallbackBlockedReason = 'no ACTIVE runners';
        else if (!hasBackOrLayPrices) proofFallbackBlockedReason = 'no back/lay prices with sufficient size (>= $2)';
        else if (hasDuplicateOrder) proofFallbackBlockedReason = 'duplicate open order on all candidates';
        else proofFallbackBlockedReason = 'no valid candidate found (all blocked by hard blockers)';
      }
    }
  }

  // Proof opportunities must pass the same final race lock as normal opportunities.
  applyRaceOrderLock(allOpportunities, raceMonitoring);
  ranked = rankOpportunities(allOpportunities);
  bestOpportunity = raceMonitoring.raceLocked ? null : (ranked.find(opportunity => opportunity.decision === 'BET') || null);
  if (raceMonitoring.raceLocked) bestNormalOpportunity = null;
  const topRankedOpportunity = ranked[0] || null;
  const bestGatePassedOpportunity = ranked.find(opportunity => opportunity.decision === 'BET') || null;
  const bestRejectedCandidate = ranked.find(opportunity => opportunity.decision !== 'BET') || null;
  const finalSelectedOpportunity = bestOpportunity;

  // ── Top 20 opportunities by EV ──
  const topOpportunities = ranked.slice(0, 20).map(o => ({
    opportunityId: o.opportunityId,
    eventId: o.eventId,
    eventName: o.eventName || '',
    marketId: o.marketId,
    betfairMarketId: o.betfairMarketId,
    marketType: o.marketType,
    marketTypeCode: o.marketTypeCode || '',
    detectedMarketType: o.detectedMarketType || o.marketType,
    marketName: o.marketName,
    marketStartTime: o.marketStartTime || null,
    side: o.side,
    runnerName: o.runnerName,
    selectionId: o.selectionId,
    opponentSelectionId: o.opponentSelectionId || null,
    odds: o.odds,
    availableSize: o.availableSize,
    bestBackPrice: o.bestBackPrice ?? null,
    bestLayPrice: o.bestLayPrice ?? null,
    bestBackSize: o.bestBackSize ?? null,
    bestLaySize: o.bestLaySize ?? null,
    modelProbability: o.modelProbability,
    impliedProbability: o.impliedProbability,
    breakevenProbability: o.breakevenProbability,
    fairOdds: o.fairOdds,
    edge: o.edge,
    ev: o.ev,
    roi: o.roi,
    commissionRate: o.commissionRate,
    confidence: o.confidence,
    dataQuality: o.dataQuality,
    decisionSource: o.decisionSource,
    dataSource: o.dataSource,
    riskAdjustedScore: o.riskAdjustedScore,
    spreadTicks: o.spreadTicks,
    delayRiskScore: o.delayRiskScore,
    fillProbability: o.fillProbability,
    stake: o.stake,
    liability: o.liability,
    maxProfit: o.maxProfit ?? null,
    maxLoss: o.maxLoss ?? null,
    failedGate: o.failedGate || o.blockers?.[0] || null,
    blocker: o.blockers?.[0] || null,
    blockers: o.blockers,
    decision: o.decision,
    externalSearchUsed: o.externalSearchUsed || false,
    externalSearchStatus: o.externalSearchStatus || 'not_requested',
    externalSourceCount: o.externalSourceCount || 0,
    externalDataQuality: o.externalDataQuality || 0,
    preSearchProbability: o.preSearchProbability ?? null,
    postSearchProbability: o.postSearchProbability ?? null,
    probabilityDelta: o.probabilityDelta ?? 0,
    preSearchConfidence: o.preSearchConfidence ?? null,
    postSearchConfidence: o.postSearchConfidence ?? null,
    confidenceDelta: o.confidenceDelta ?? 0,
    externalSearchSummary: o.externalSearchSummary || '',
    externalSearchSourceUrls: (o.externalSearchSourceUrls || []).slice(0, 5),
    decisionImpact: o.decisionImpact || 'no_effect',
    marketOnlyFallbackReason: o.marketOnlyFallbackReason || null,
    marketOnlyProbability: o.marketOnlyProbability ?? null,
    openAIProbabilityAdjustment: o.openAIProbabilityAdjustment ?? 0,
    finalProbabilityUsedInEV: o.finalProbabilityUsedInEV ?? o.modelProbability,
    // ── Favourite Value Context fields ──
    favouriteSelectionId: o.favouriteSelectionId ?? null,
    favouriteName: o.favouriteName ?? null,
    isFavourite: o.isFavourite ?? false,
    favouriteOdds: o.favouriteOdds ?? null,
    favouriteDominanceScore: o.favouriteDominanceScore ?? null,
    fieldStrengthCategory: o.fieldStrengthCategory ?? null,
    qualityThreatCount: o.qualityThreatCount ?? null,
    runnerContextScore: o.runnerContextScore ?? null,
    marketScore: o.marketScore ?? null,
    formScore: o.formScore ?? null,
    pressureScore: o.pressureScore ?? null,
    baseProbability: o.baseProbability ?? o.modelProbability,
    favouriteContextAdjustment: o.favouriteContextAdjustment ?? 0,
    contextAdjustmentReason: o.contextAdjustmentReason ?? null,
    favouriteValueWarning: o.favouriteValueWarning ?? null,
    specificNoBetReason: o.specificNoBetReason ?? null,
  }));

  // ── Top 10 rejected opportunities ──
  const rejectedOpps = ranked
    .filter(o => o.decision === 'NO_BET' || o.decision === 'REJECT')
    .slice(0, 10)
    .map(o => ({
      opportunityId: o.opportunityId,
      eventName: o.eventName || '',
      marketName: o.marketName,
      marketType: o.marketType,
      marketTypeCode: o.marketTypeCode || '',
      detectedMarketType: o.detectedMarketType || o.marketType,
      marketStartTime: o.marketStartTime || null,
      side: o.side,
      runner: o.runnerName,
      runnerName: o.runnerName,
      selectionId: o.selectionId,
      opponentSelectionId: o.opponentSelectionId || null,
      odds: o.odds,
      availableSize: o.availableSize,
      bestBackPrice: o.bestBackPrice ?? null,
      bestLayPrice: o.bestLayPrice ?? null,
      bestBackSize: o.bestBackSize ?? null,
      bestLaySize: o.bestLaySize ?? null,
      spreadTicks: o.spreadTicks,
      modelProbability: o.modelProbability,
      impliedProbability: o.impliedProbability,
      breakevenProbability: o.breakevenProbability,
      fairOdds: o.fairOdds,
      edge: o.edge,
      ev: o.ev,
      roi: o.roi,
      commissionRate: o.commissionRate,
      confidence: o.confidence,
      dataQuality: o.dataQuality,
      decisionSource: o.decisionSource,
      dataSource: o.dataSource,
      riskAdjustedScore: o.riskAdjustedScore,
      delayRiskScore: o.delayRiskScore,
      fillProbability: o.fillProbability,
      stake: o.stake,
      liability: o.liability,
      maxProfit: o.maxProfit ?? null,
      maxLoss: o.maxLoss ?? null,
      failedGate: o.failedGate || o.blockers?.[0] || 'Unknown',
      blocker: o.blockers?.[0] || 'Unknown',
      blockers: o.blockers,
      externalSearchUsed: o.externalSearchUsed || false,
      externalSearchStatus: o.externalSearchStatus || 'not_requested',
      externalSourceCount: o.externalSourceCount || 0,
      externalDataQuality: o.externalDataQuality || 0,
      preSearchProbability: o.preSearchProbability ?? null,
      postSearchProbability: o.postSearchProbability ?? null,
      probabilityDelta: o.probabilityDelta ?? 0,
      decisionImpact: o.decisionImpact || 'no_effect',
      marketOnlyFallbackReason: o.marketOnlyFallbackReason || null,
      marketOnlyProbability: o.marketOnlyProbability ?? null,
      openAIProbabilityAdjustment: o.openAIProbabilityAdjustment ?? 0,
      finalProbabilityUsedInEV: o.finalProbabilityUsedInEV ?? o.modelProbability,
      // ── Favourite Value Context fields ──
      favouriteSelectionId: o.favouriteSelectionId ?? null,
      favouriteName: o.favouriteName ?? null,
      isFavourite: o.isFavourite ?? false,
      favouriteOdds: o.favouriteOdds ?? null,
      favouriteDominanceScore: o.favouriteDominanceScore ?? null,
      fieldStrengthCategory: o.fieldStrengthCategory ?? null,
      qualityThreatCount: o.qualityThreatCount ?? null,
      runnerContextScore: o.runnerContextScore ?? null,
      marketScore: o.marketScore ?? null,
      formScore: o.formScore ?? null,
      pressureScore: o.pressureScore ?? null,
      baseProbability: o.baseProbability ?? o.modelProbability,
      favouriteContextAdjustment: o.favouriteContextAdjustment ?? 0,
      contextAdjustmentReason: o.contextAdjustmentReason ?? null,
      favouriteValueWarning: o.favouriteValueWarning ?? null,
      specificNoBetReason: o.specificNoBetReason ?? null,
    }));

  const selectedCoverage = eventClusters[0] ? marketCoverage(eventClusters[0], runners) : null;
  if (selectedCoverage) {
    const relatedRejections = rejectedRelatedMarkets(eventClusters[0], catalogueMarkets);
    selectedCoverage.rejectionReasons = [...selectedCoverage.rejectionReasons, ...relatedRejections];
    selectedCoverage.marketsRejectedBeforeEngine = selectedCoverage.rejectionReasons.length;
    selectedCoverage.relatedMarkets = getAllMarketsInCluster(eventClusters[0]).map(market => { const rejected = selectedCoverage.rejectionReasons.find(item => String(item.marketId) === String(market.betfairMarketId || market.id)); return { marketId: market.betfairMarketId || market.id, marketType: detectMarketType(market), accepted: !rejected, rejectionReason: rejected?.reason || null }; });
    selectedCoverage.h2hStatus = selectedCoverage.uniqueH2HMarketCount > 0 ? 'returned_and_supported' : catalogueMarkets.some(market => detectMarketType(market) === 'H2H') ? 'returned_but_filtered_out' : 'not_offered_by_betfair';
  }

  const diagnostics = {
    raceMonitoring,
    ...raceMonitoring,
    marketsScanned: eligibleMarkets.length,
    eventsScanned,
    totalEventClusters,
    maxEventsToScan,
    eventsWithAI,
    cacheHits,
    aiCallsMade: featherlessCalled,
    aiCacheHits: cacheHits,
    aiCacheMisses: featherlessCalled,
    aiStatusLog,
    aiObservability,
    aiRequiredFailures,
    aiStatus: featherlessCalled === 0 && cacheHits === 0 ? 'Not used' : cacheHits > 0 ? 'Cache used' : featherlessSucceeded > 0 ? 'Used' : 'Failed',
    aiDisabled: !callAI,
    aiResultsCreated: eventsWithAI,
    marketOnlyResultsCreated,
    cacheStats: getCacheStats(),
    marketDetectionLog,
    winMarketsFound: marketTypeCounts.winMarketsFound,
    placeMarketsFound: marketTypeCounts.placeMarketsFound,
    h2hMarketsFound: marketTypeCounts.h2hMarketsFound,
    unknownMarketsFound: marketTypeCounts.unknownMarketsFound,
    uniqueWinMarketCount: marketTypeCounts.winMarketsFound,
    uniquePlaceMarketCount: marketTypeCounts.placeMarketsFound,
    uniqueH2HMarketCount: marketTypeCounts.h2hMarketsFound,
    totalUniqueMarketCount: uniqueEligibleMarkets.length,
    totalRunnerCount: runners.length,
    raceClustersCreated: eventClusters.length,
    totalOpportunities: allOpportunities.length,
    backOpportunities: allOpportunities.filter(o => o.side === 'BACK').length,
    layOpportunities: allOpportunities.filter(o => o.side === 'LAY').length,
    opportunityFunnel: {
      currentMarketsInAppContext: markets.length,
      currentRunnersInAppContext: runners.length,
      currentPricedRunners: runners.filter(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0)).length,
      openPreRaceMarkets,
      marketsWithTwoActiveRunners: marketFilterFunnel.marketsWithTwoActiveRunners,
      marketsWithPriceData: marketFilterFunnel.marketsWithPriceData,
      eligibleMarkets: eligibleMarkets.length,
      eventClustersCreated: eventClusters.length,
      clustersWithPrimaryMarket,
      clustersWithMatchedRunners,
      aiResultsCreated: eventsWithAI,
      marketOnlyResultsCreated,
      opportunitiesGenerated: allOpportunities.length,
      backOpportunitiesGenerated: allOpportunities.filter(o => o.side === 'BACK').length,
      layOpportunitiesGenerated: allOpportunities.filter(o => o.side === 'LAY').length,
      proofModeDetectedInsideEngine: paperProofMode,
      proofFallbackAttempted,
      proofFallbackCreated,
      proofFallbackBlockedReason,
      raceDayLoaded: !!raceCache.loadedAt,
      raceDayLoadedAt: raceCache.loadedAt,
      totalDayRaces: raceCache.summary.totalRacesLoaded || 0,
      totalDayMarkets: raceCache.summary.totalMarketsLoaded || 0,
      cachedRacePacks: raceCache.racePacksByRaceKey.size,
      selectedRaceKey: selectedRace?.raceKey || null,
      selectedRaceName: selectedRace?.eventName || null,
      selectedRaceStartTime: selectedRace?.startTime || null,
      selectedRaceSecondsToJump: selectedRace?.secondsToJump ?? null,
      racePackFromCache: !!hydratedRacePack,
      racePackHydratedAt: hydratedRacePack?.hydratedAt || null,
      racePackFreshnessStatus: selectedRace?.freshnessStatus || 'missing',
      aiCacheUsed: cacheHits > 0,
      openAICacheUsed: extSearchCacheHits > 0,
      openAICalled: extSearchCalls > 0,
      racesInsideWindow: schedule.racesInsideWindow,
      nextRaceWindowOpensAt: schedule.nextRaceWindowOpensAt,
      racePacksBuilt,
      featherlessCalled,
      featherlessSucceeded,
      featherlessFailed,
      ...raceMonitoring,
    },
    positiveEVOpportunities: allOpportunities.filter(o => o.ev > 0 && !o.proofMode).length,
    mathematicallyPositiveEVOpportunities: allOpportunities.filter(o => o.ev > 0 && !o.proofMode).length,
    gateApprovedOpportunities: allOpportunities.filter(o => o.decision === 'BET' && !o.proofMode).length,
    forcedProofOpportunities: allOpportunities.filter(o => o.proofMode === true).length,
    rejectedOpportunities: allOpportunities.filter(o => o.decision === 'NO_BET' || o.decision === 'REJECT').length,
    topOpportunities,
    topRejected: rejectedOpps,
    topRankedOpportunity,
    bestGatePassedOpportunity,
    bestRejectedCandidate,
    finalSelectedOpportunity,
    bestOpportunity: finalSelectedOpportunity,
    decision: bestOpportunity ? 'BET' : 'NO_BET',
    failedGate: raceMonitoring.raceLocked ? 'DUPLICATE_RACE_EXPOSURE' : aiRequiredFailures > 0 && allOpportunities.length === 0 ? 'AI_REQUIRED_BUT_NOT_AVAILABLE' : bestOpportunity ? null : ranked[0]?.failedGate || null,
    noBetReason: raceMonitoring.raceLocked
      ? 'DUPLICATE_RACE_EXPOSURE'
      : aiRequiredFailures > 0 && allOpportunities.length === 0
      ? 'AI_REQUIRED_BUT_NOT_AVAILABLE'
      : debugScanMode
      ? (allOpportunities.length === 0
        ? 'Debug scan: no opportunities generated — check AI or price data'
        : `Debug scan: ${allOpportunities.length} opportunities generated, ${allOpportunities.filter(o => o.decision === 'BET').length} positive-EV — NO orders placed (debug mode)`)
      : (bestOpportunity ? null : (allOpportunities.length === 0
        ? 'No opportunities generated — check AI availability or market data'
        : (ranked[0]?.specificNoBetReason || `Best opportunity: ${ranked[0]?.runnerName || 'Unknown'} — ${ranked[0]?.blockers?.[0] || 'blocked by safety gate'}`))),
    favouriteValueDiagnostics: buildFavouriteValueDiagnostics(allOpportunities, favouriteContextsDetected),
    bestByCategory: getBestByCategory(allOpportunities),
    candidateCountByMarketTypeAndSide: allOpportunities.reduce((counts, item) => { const key=`${item.marketType}_${item.side}`; counts[key]=(counts[key] || 0)+1; return counts; }, {}),
    sideSelectionDiagnostics: buildSideSelectionDiagnostics(allOpportunities, bestOpportunity),
    selectedRaceMarketCoverage: selectedCoverage,
    aiDecisions,
    marketFeedDiagnostics,
    marketFilterFunnel,
    timeWindowFunnel,
    loadedMarketsTable,
    marketBookValidation: eligibleMarkets.map(market => ({ marketId:normalizedMarketId(market), marketType:detectMarketType(market), ...validateCompleteMarketBook(getRunnersForMarket(market, runnersByMarket)), runners:getRunnersForMarket(market, runnersByMarket).map(runner => ({ selectionId:runner.betfairSelectionId || runner.selectionId, runnerName:runner.runnerName, bestBackPrice:runner.bestBackPrice, bestBackSize:runner.bestBackSize, bestLayPrice:runner.bestLayPrice, bestLaySize:runner.bestLaySize })) })),
    connectionDiagnostics,
    scanStage: 'completed',
    lastCompletedStage: 'completed',
    failedStage: null,
    engineError: null,
    debugScanMode,
    globalMarketsLoaded: marketFeedDiagnostics.marketsInMemory,
    globalMarketsOpen: marketFeedDiagnostics.marketsOpen,
    globalMarketsWithRunners: marketFeedDiagnostics.marketsWithRunners,
    globalMarketsWithPrices: marketFeedDiagnostics.marketsWithPriceData,
    selectedRaceMarketsLoaded: markets.length,
    selectedRaceMarketsInsideWindow: markets.filter(m => { const t = new Date(m.marketStartTime || m.startTime).getTime(); const s = (t - Date.now()) / 1000; return Number.isFinite(t) && s > (settings.defaultTimeWindowEndSeconds || 30) && s <= (settings.defaultTimeWindowStartSeconds || 500); }).length,
    selectedRaceMarketsEligible: eligibleMarkets.length,
    selectedRaceMarketsSentToEngine: eligibleMarkets.length,
    totalMarketsLoaded,
    openPreRaceMarkets,
    marketsInsideTimeWindow,
    eligibleMarketsAfterRunnerFilter: eligibleAfterRunnerFilter,
    eligibleMarketsAfterPriceFilter: eligibleAfterPriceFilter,
    marketsSentToExchangeEngine: eligibleMarkets.length,
    externalSearchDiagnostics: {
      enabled: extSearchEnabled,
      callsThisCycle: extSearchCalls,
      cacheHits: extSearchCacheHits,
      cacheMisses: extSearchCacheMisses,
      timeouts: extSearchTimeouts,
      errors: extSearchErrors,
      noResults: extSearchNoResults,
      totalSourcesFound: extTotalSources,
      runnersAffected: extRunnersAffected,
      probabilityChanges: extProbabilityChanges,
      decisionChanges: extDecisionChanges,
      latestSearchQuery: extLatestQuery,
      latestSearchSummary: extLatestSummary,
      latestSearchStatus: extLatestStatus,
      nextRetryAt: extNextRetryAt,
      openAIWebSearchErrorType: extErrorType,
      backoffSeconds: extBackoffSeconds,
      perEventResults: externalSearchPerEvent,
      cacheStats: getExternalSearchCacheStats(),
    },
    raceDayLoaded: !!raceCache.loadedAt,
    raceDayLoadedAt: raceCache.loadedAt,
    totalDayRaces: raceCache.summary.totalRacesLoaded || 0,
    totalDayMarkets: raceCache.summary.totalMarketsLoaded || 0,
    cachedRacePacks: raceCache.racePacksByRaceKey.size,
    selectedRaceKey: selectedRace?.raceKey || null,
    selectedRaceName: selectedRace?.eventName || null,
    selectedRaceStartTime: selectedRace?.startTime || null,
    selectedRaceSecondsToJump: selectedRace?.secondsToJump ?? null,
    racePackFromCache: !!hydratedRacePack,
    racePackHydratedAt: hydratedRacePack?.hydratedAt || null,
    racePackFreshnessStatus: selectedRace?.freshnessStatus || 'missing',
    aiCacheUsed: cacheHits > 0,
    openAICacheUsed: extSearchCacheHits > 0,
    openAICalled: extSearchCalls > 0,
    racesInsideWindow: schedule.racesInsideWindow,
    nextRaceWindowOpensAt: schedule.nextRaceWindowOpensAt,
    featherlessRequested: featherlessCalled > 0,
    featherlessStatus: aiObservability[aiObservability.length - 1]?.aiCallStatus || 'not_requested',
    featherlessError: aiObservability[aiObservability.length - 1]?.aiErrorMessage || null,
    openAIWebSearchRequested: extSearchCalls > 0,
    openAIWebSearchStatus: extLatestStatus,
    openAIWebSearchError: externalSearchPerEvent.find(item => item.errorMessage)?.errorMessage || null,
    openAIWebSearchNextRetryAt: extNextRetryAt,
    openAIWebSearchErrorType: extErrorType,
    openAIWebSearchBackoffSeconds: extBackoffSeconds,
    raceAssessmentDiagnostics: {
      racePacksBuilt,
      featherlessCalled,
      featherlessSucceeded,
      featherlessFailed,
      featherlessTimedOut,
      featherlessNotConfigured,
      marketOnlyFallbacksUsed,
      featherlessAlwaysRequired,
      totalRunnerProbabilitiesReturned,
      totalH2HProbabilitiesReturned,
      totalRecommendedOpportunitiesReturned,
      featherlessTotalLatencyMs,
      featherlessAvgLatencyMs: featherlessCalled > 0 ? Math.round(featherlessTotalLatencyMs / featherlessCalled) : 0,
      localEngineOverruledFeatherless,
      raceAssessments,
      lastRacePack: raceAssessments[0]?.racePackSummary || null,
    },
  };

  return {
    bestOpportunity: finalSelectedOpportunity,
    topRankedOpportunity,
    bestGatePassedOpportunity,
    bestRejectedCandidate,
    finalSelectedOpportunity,
    bestDebugCandidate: debugScanMode ? topRankedOpportunity : null,
    wouldCreateOrder: debugScanMode ? !!bestOpportunity : null,
    wouldFailGate: debugScanMode ? (bestOpportunity?.failedGate || ranked[0]?.failedGate || null) : null,
    wouldUseDecisionSource: debugScanMode ? (bestOpportunity?.decisionSource || ranked[0]?.decisionSource || null) : null,
    allOpportunities: ranked,
    normalOpportunities,
    proofFallbackOpportunity,
    bestNormalOpportunity,
    proofFallbackUsed: proofFallbackCreated,
    eventClusters,
    diagnostics,
  };
}

/**
 * Convert an opportunity into a signal for the existing order pipeline.
 */
export function opportunityToSignal(opportunity, settings) {
  const decisionSource = opportunity.decisionSource || DECISION_SOURCES.DETERMINISTIC_MARKET_ONLY;
  return {
    strategyName: strategyForDecisionSource(decisionSource),
    decisionSource,
    marketId: opportunity.marketId,
    betfairMarketId: opportunity.betfairMarketId,
    selectionId: opportunity.selectionId,
    runnerId: opportunity.runnerName,
    side: opportunity.side,
    odds: opportunity.odds,
    stakeSuggestion: opportunity.stake,
    modelProbability: opportunity.modelProbability,
    impliedProbability: opportunity.impliedProbability,
    fairOdds: opportunity.fairOdds,
    edgePercent: opportunity.edge * 100,
    expectedValue: opportunity.ev,
    confidence: opportunity.confidence,
    signalStatus: 'proposed',
    persistenceType: 'LAPSE',
    spreadTicks: opportunity.spreadTicks,
    reason: opportunity.reasons.join('; '),
    dataSource: dataSourceForDecisionSource(decisionSource),
    marketType: opportunity.marketType,
    opponentSelectionId: opportunity.opponentSelectionId,
    liability: opportunity.liability,
    commissionRate: opportunity.commissionRate,
    proofMode: opportunity.proofMode || false,
    // ── Favourite Value Context trace ──
    finalProbabilityUsedInEV: opportunity.finalProbabilityUsedInEV ?? opportunity.modelProbability,
    marketScore: opportunity.marketScore ?? null,
  };
}

export { MARKET_TYPE_THRESHOLDS, resolveMarketTypeThresholds };