// ============================================================================
// Exchange Opportunity Engine
//
// Orchestrates the full bot cycle:
//   1. Scan all open pre-race markets
//   2. Group by race/event
//   3. Fetch/enrich public form data (via AI callback)
//   4. Call AI for probabilities (pWin, pPlace, pBeatsOpponent)
//   5. Generate BACK and LAY opportunities for WIN, PLACE, H2H
//   6. Run exchange EV maths (deterministic — no AI bypass)
//   7. Run safety gates
//   8. Rank all positive-EV opportunities
//   9. Choose best opportunity
//  10. Return best opportunity + all opportunities + diagnostics
//
// The AI call is delegated to a callback so this engine stays pure.
// ============================================================================

import { clusterMarketsByEvent, getPrimaryMarket, getAllMarketsInCluster, detectMarketType } from './marketClusterer';
import { generateOpportunitiesForEvent, rankOpportunities, getBestByCategory } from './crossMarketValueScanner';
import { resolveMarketTypeThresholds, MARKET_TYPE_THRESHOLDS } from './crossMarketValueScanner';
import { getCachedAIResult, setCachedAIResult, getCacheStats } from './exchangeEngineCache';
import { getCachedExternalSearch, setCachedExternalSearch, getExternalSearchCacheStats } from './externalSearchCache';
import { isPaperProofModeActive } from './paperProofDefaults';
import { buildProofOpportunity } from './paperProofScanner';

const OPEN_ORDER_STATUSES = ['pending', 'executable', 'matched', 'unmatched', 'partially_matched'];
const STRATEGY_NAME = 'Featherless AI Value Decision Engine';

/**
 * Scan all eligible pre-race markets.
 * @returns {Array} Eligible markets (OPEN, not in-play, 2+ runners, in time window)
 */
export function scanEligibleMarkets(markets, runners, settings, debugScanMode = false) {
  const windowStart = settings.defaultTimeWindowStartSeconds || 500;
  const windowEnd = settings.defaultTimeWindowEndSeconds || 30;
  const nowMs = Date.now();

  return markets.filter(m => {
    if (m.status !== 'OPEN') return false;
    if (m.inPlay && !settings.allowInPlay) return false;

    const marketRunners = runners.filter(r =>
      (r.marketId === m.id || r.marketId === m.betfairMarketId) && r.status === 'ACTIVE'
    );
    const runnerCount = Math.max(m.numberOfRunners || 0, m.numberOfActiveRunners || 0, marketRunners.length);
    if (runnerCount < 2) return false;

    // In debug scan mode, skip the time window filter entirely
    if (debugScanMode) return true;

    // Time window: include markets that are within or approaching the window
    const start = m.startTime ? new Date(m.startTime).getTime() : NaN;
    if (isNaN(start)) return true; // No start time — include (will be filtered later)
    const secsBefore = (start - nowMs) / 1000;
    // Include markets from windowEnd to windowStart * 2 (gives buffer for scanning)
    return secsBefore > windowEnd && secsBefore < windowStart * 2;
  });
}

/**
 * Build pre-filter market feed diagnostics from ALL loaded markets.
 * Runs before any eligibility filtering to show the raw state of the market feed.
 */
function buildMarketFeedDiagnostics(markets, runners, connectionState) {
  const nowMs = Date.now();
  let open = 0, closed = 0, suspended = 0, inPlay = 0, notInPlay = 0;
  let withStartTime = 0, withoutStartTime = 0;
  let withRunners = 0, withPriceData = 0, missingPriceData = 0;
  let streamCount = 0, catalogueCount = 0, mergedCount = 0;
  let runnersWithBackPrice = 0, runnersWithLayPrice = 0, runnersWithBackOrLay = 0;

  // Count markets by source
  for (const m of markets) {
    const src = m.source || 'cached';
    if (src === 'stream') streamCount++;
    else if (src === 'catalogue') catalogueCount++;
    else if (src === 'merged') { mergedCount++; streamCount++; catalogueCount++; }
  }

  // Count runners with price data
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

    const marketRunners = runners.filter(r =>
      (r.marketId === m.id || r.marketId === m.betfairMarketId) && r.status === 'ACTIVE'
    );
    const runnerCount = Math.max(m.numberOfRunners || 0, m.numberOfActiveRunners || 0, marketRunners.length);
    if (runnerCount >= 2) withRunners++;

    const hasPriceData = marketRunners.some(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0));
    if (hasPriceData) withPriceData++; else missingPriceData++;
  }

  // Determine price feed staleness
  const lastStreamUpdateAt = connectionState?.lastStreamUpdateAt ?? null;
  const lastCatalogueRefreshAt = connectionState?.lastCatalogueRefreshAt ?? null;
  const streamConnected = connectionState?.streamConnected ?? false;
  const apiConnected = connectionState?.apiConnected ?? false;

  let priceFeedStale = false;
  let marketDataSource = 'none';

  if (markets.length === 0) {
    marketDataSource = 'none';
  } else if (streamConnected && mergedCount > 0) {
    marketDataSource = 'merged';
  } else if (streamCount > 0 && !catalogueCount) {
    marketDataSource = 'stream_live';
  } else if (catalogueCount > 0 && !streamCount) {
    marketDataSource = 'rest_catalogue';
  } else if (mergedCount > 0) {
    marketDataSource = 'merged';
  } else {
    marketDataSource = 'cached_stale';
  }

  // Stale if: connected but no price updates in 60s (stream) or 5min (catalogue only)
  if (apiConnected && withPriceData === 0) {
    priceFeedStale = true;
  }
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
 * Build time-window funnel for all OPEN non-inplay markets.
 * Shows exactly why markets are rejected by the time window.
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
    if (secsBefore <= 0) { tooLate++; category = 'too_late'; }
    else if (secsBefore < windowEnd) { tooLate++; category = 'too_late'; }
    else if (secsBefore > windowStart * 2) { tooEarly++; category = 'too_early'; }
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

  // Sort by secondsToJump (nulls last) and take nearest 20
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
function buildLoadedMarketsTable(markets, runners) {
  const nowMs = Date.now();
  return markets.slice(0, 50).map(m => {
    const marketRunners = runners.filter(r =>
      (r.marketId === m.id || r.marketId === m.betfairMarketId) && r.status === 'ACTIVE'
    );
    const runnerCount = Math.max(m.numberOfRunners || 0, m.numberOfActiveRunners || 0, marketRunners.length);
    const hasPriceData = marketRunners.some(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0));
    const start = m.startTime ? new Date(m.startTime).getTime() : (m.marketStartTime ? new Date(m.marketStartTime).getTime() : NaN);
    const secondsToJump = isNaN(start) ? null : Math.round((start - nowMs) / 1000);
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
      hasPriceData,
      totalMatched: m.totalMatched || 0,
    };
  });
}

/**
 * Build a market-only AI result when Featherless AI is disabled.
 * Derives win probabilities from Betfair back/lay prices (implied probability).
 * Lower data quality (30) and confidence (25) to ensure safety gates flag these.
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
  // Normalize pWin to sum to ~1
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
    raceSummary: 'Market-only mode — probabilities derived from Betfair implied odds',
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
 * @returns {object} { bestOpportunity, allOpportunities, eventClusters, diagnostics }
 */
export async function runExchangeCycle({ markets, runners, settings, featherlessSettings, bankrollStats, paperOrders, emergencyStop, callAI, callExternalSearch, connectionState }) {
  // ── Build pre-filter diagnostics from ALL loaded markets ──
  const marketFeedDiagnostics = buildMarketFeedDiagnostics(markets, runners, connectionState);

  // ── Build time-window funnel ──
  const debugScanMode = featherlessSettings?.debugScanMode === true;
  const timeWindowFunnel = buildTimeWindowFunnel(markets, settings, debugScanMode);

  // ── Build loaded markets debug table (first 50) ──
  const loadedMarketsTable = buildLoadedMarketsTable(markets, runners);

  // ── Connection state ──
  const connectionDiagnostics = {
    betfairApiConnected: connectionState?.apiConnected ?? false,
    streamConnected: connectionState?.streamConnected ?? false,
    lastStreamUpdateAt: connectionState?.lastStreamUpdateAt ?? null,
    lastCatalogueRefreshAt: connectionState?.lastCatalogueRefreshAt ?? null,
    marketCatalogueError: connectionState?.marketCatalogueError ?? null,
    streamError: connectionState?.streamError ?? null,
    priceFeedStale: connectionState?.priceFeedStale ?? false,
  };

  if (emergencyStop) {
    return {
      bestOpportunity: null,
      allOpportunities: [],
      eventClusters: [],
      diagnostics: {
        noBetReason: 'Emergency stop active',
        marketsScanned: 0,
        eventsScanned: 0,
        marketFeedDiagnostics,
        timeWindowFunnel,
        loadedMarketsTable,
        connectionDiagnostics,
        debugScanMode,
      },
    };
  }

  // ── Separated scan counts ──
  const totalMarketsLoaded = markets.length;
  const openPreRaceMarkets = markets.filter(m => m.status === 'OPEN' && !m.inPlay).length;
  const marketsInsideTimeWindow = timeWindowFunnel.insideWindowMarkets;

  // 1. Scan all eligible pre-race markets
  const eligibleMarkets = scanEligibleMarkets(markets, runners, settings, debugScanMode);

  // Count eligible after runner filter
  const eligibleAfterRunnerFilter = markets.filter(m => {
    if (m.status !== 'OPEN') return false;
    if (m.inPlay && !settings.allowInPlay) return false;
    const marketRunners = runners.filter(r =>
      (r.marketId === m.id || r.marketId === m.betfairMarketId) && r.status === 'ACTIVE'
    );
    const runnerCount = Math.max(m.numberOfRunners || 0, m.numberOfActiveRunners || 0, marketRunners.length);
    return runnerCount >= 2;
  }).length;

  const eligibleAfterPriceFilter = eligibleMarkets.filter(m => {
    const marketRunners = runners.filter(r =>
      (r.marketId === m.id || r.marketId === m.betfairMarketId) && r.status === 'ACTIVE'
    );
    return marketRunners.some(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0));
  }).length;

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
        noBetReason: reason,
        marketsScanned: 0,
        eventsScanned: 0,
        marketFeedDiagnostics,
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

  // ── Market detection log: record detected type for every scanned market ──
  const marketDetectionLog = eligibleMarkets.map(m => {
    const detectedMarketType = detectMarketType(m);
    const marketRunners = runners.filter(r =>
      (r.marketId === m.id || r.marketId === m.betfairMarketId) && r.status === 'ACTIVE'
    );
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
  let eventsScanned = 0;
  let eventsWithAI = 0;
  let cacheHits = 0;

  // ── External search diagnostics ──
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
  let extLatestStatus = 'not_called';
  const extSearchEnabled = featherlessSettings?.externalSearchEnabled === true;
  const extCacheTtlMs = (featherlessSettings?.externalSearchCacheTtlMinutes || 5) * 60 * 1000;

  // Count market types detected
  const marketTypeCounts = eligibleMarkets.reduce((acc, m) => {
    const type = detectMarketType(m);
    if (type === 'WIN') acc.winMarketsFound++;
    else if (type === 'PLACE') acc.placeMarketsFound++;
    else if (type === 'H2H') acc.h2hMarketsFound++;
    else acc.unknownMarketsFound++;
    return acc;
  }, { winMarketsFound: 0, placeMarketsFound: 0, h2hMarketsFound: 0, unknownMarketsFound: 0 });

  for (const cluster of eventClusters) {
    eventsScanned++;
    const primaryMarket = getPrimaryMarket(cluster);
    if (!primaryMarket) continue;

    // Get runners for the primary market
    const marketRunners = runners.filter(r =>
      (r.marketId === primaryMarket.id || r.marketId === primaryMarket.betfairMarketId) && r.status === 'ACTIVE'
    );

    if (marketRunners.length === 0) continue;

    // ── AI caching: check cache before calling AI ──
    let aiResult = getCachedAIResult(cluster, marketRunners);
    if (aiResult) {
      cacheHits++;
      aiStatusLog.push({ eventId: cluster.eventId, status: 'cache_hit' });
    } else if (callAI) {
      try {
        aiResult = await callAI(cluster, primaryMarket, marketRunners);
        if (aiResult) {
          setCachedAIResult(cluster, marketRunners, aiResult);
          eventsWithAI++;
          aiStatusLog.push({ eventId: cluster.eventId, status: 'ai_called', success: true, returnedProbabilities: true });
          aiDecisions.push({ eventId: cluster.eventId, aiResult });
        } else {
          aiStatusLog.push({ eventId: cluster.eventId, status: 'ai_called', success: false, reason: 'AI returned null' });
        }
      } catch (err) {
        const isTimeout = err.message?.toLowerCase().includes('timeout') || err.code === 'ETIMEDOUT';
        aiStatusLog.push({ eventId: cluster.eventId, status: isTimeout ? 'ai_timeout' : 'ai_error', reason: err.message });
        continue;
      }
    } else {
      aiStatusLog.push({ eventId: cluster.eventId, status: 'ai_disabled' });
    }

    if (!aiResult) {
      // If AI is disabled (no callAI provided), fall back to market-only probabilities
      // derived from Betfair back/lay prices. This ensures the exchange engine always
      // generates opportunities even when Featherless AI is disabled.
      if (!callAI) {
        aiResult = buildMarketOnlyAIResult(cluster, marketRunners);
        aiStatusLog.push({ eventId: cluster.eventId, status: 'market_only', success: true, reason: 'AI disabled — using market-implied probabilities' });
      } else {
        // AI was called but returned null or errored — skip this event
        continue;
      }
    }

    // ── External search: call OpenAI web search for this event ──
    let externalSearchResult = null;
    if (extSearchEnabled && callExternalSearch) {
      const eventName = cluster.eventName || primaryMarket.eventName || '';
      const marketStartTime = primaryMarket.startTime || primaryMarket.marketStartTime || '';

      // Check cache first
      const cached = getCachedExternalSearch(cluster.eventId, eventName, marketStartTime, marketRunners);
      if (cached) {
        extSearchCacheHits++;
        externalSearchResult = cached;
        externalSearchPerEvent.push({
          eventId: cluster.eventId, eventName,
          searchStatus: cached.searchStatus, sourceCount: cached.sourceCount || 0,
          dataQuality: cached.dataQuality || 0, runnersResearched: (cached.runnerResearch || []).length,
          cacheHit: true,
        });
      } else {
        extSearchCacheMisses++;
        extSearchCalls++;
        try {
          externalSearchResult = await callExternalSearch(cluster, primaryMarket, marketRunners);
          if (externalSearchResult) {
            setCachedExternalSearch(cluster.eventId, eventName, marketStartTime, marketRunners, externalSearchResult, extCacheTtlMs);
            extTotalSources += externalSearchResult.sourceCount || 0;
            extRunnersAffected += (externalSearchResult.runnerResearch || []).length;
            extLatestQuery = externalSearchResult.searchQuery || extLatestQuery;
            extLatestStatus = externalSearchResult.searchStatus || extLatestStatus;
            if (externalSearchResult.searchStatus === 'success' && externalSearchResult.raceLevelNotes) {
              extLatestSummary = externalSearchResult.raceLevelNotes.slice(0, 200);
            }
            if (externalSearchResult.searchStatus === 'timeout') extSearchTimeouts++;
            else if (externalSearchResult.searchStatus === 'error') extSearchErrors++;
            else if (externalSearchResult.searchStatus === 'no_results') extSearchNoResults++;

            externalSearchPerEvent.push({
              eventId: cluster.eventId, eventName,
              searchStatus: externalSearchResult.searchStatus,
              sourceCount: externalSearchResult.sourceCount || 0,
              dataQuality: externalSearchResult.dataQuality || 0,
              runnersResearched: (externalSearchResult.runnerResearch || []).length,
              cacheHit: false,
            });
          }
        } catch (extErr) {
          const isTimeout = extErr.message?.toLowerCase().includes('timeout');
          if (isTimeout) extSearchTimeouts++; else extSearchErrors++;
          externalSearchResult = {
            searchStatus: isTimeout ? 'timeout' : 'error',
            sourceCount: 0, sources: [], runnerResearch: [], raceLevelNotes: '',
            dataQuality: 0, errorMessage: extErr.message, searchQuery: '',
            searchedAt: new Date().toISOString(), searchProvider: 'openai_web_search',
          };
          externalSearchPerEvent.push({
            eventId: cluster.eventId, eventName,
            searchStatus: externalSearchResult.searchStatus,
            sourceCount: 0, dataQuality: 0, runnersResearched: 0, cacheHit: false,
          });
        }
      }
    }

    // 5-7. Generate opportunities with exchange maths and safety gates
    const opportunities = generateOpportunitiesForEvent(
      cluster, runners, aiResult, settings, featherlessSettings, bankrollStats, paperOrders, externalSearchResult
    );
    allOpportunities.push(...opportunities);

    // ── Track probability changes and decision changes from external search ──
    if (externalSearchResult && externalSearchResult.searchStatus === 'success') {
      // Find pre-search and post-search best opportunities
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

      // Check if best runner changed
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
  }

  // 8. Rank all opportunities by EV
  const ranked = rankOpportunities(allOpportunities);

  // ── Paper Proof Mode: check if active ──
  const paperProofMode = isPaperProofModeActive(settings, {}, featherlessSettings);

  // 9. Choose best positive-EV opportunity
  // In debug scan mode, do NOT select any opportunity for order placement
  let bestOpportunity = debugScanMode ? null : (ranked.find(o => o.decision === 'BET') || null);

  // ── Paper Proof Fallback: if no positive-EV opportunity and proof mode is active ──
  if (!debugScanMode && !bestOpportunity && paperProofMode) {
    const proofOpp = buildProofOpportunity(eventClusters, runners, paperOrders, settings);
    if (proofOpp) {
      bestOpportunity = proofOpp;
      allOpportunities.push(proofOpp);
    }
  }

  // ── Top 20 opportunities by EV (for export and diagnostics) ──
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
    dataSource: o.dataSource || 'BETFAIR_METADATA_PLUS_MARKET',
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
    externalSearchStatus: o.externalSearchStatus || 'not_called',
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
  }));

  // ── Top 10 rejected opportunities (for no-bet logs) ──
  const rejectedOpps = ranked
    .filter(o => o.decision === 'NO_BET')
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
      dataSource: o.dataSource || 'BETFAIR_METADATA_PLUS_MARKET',
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
      externalSearchStatus: o.externalSearchStatus || 'not_called',
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
    }));

  // Build diagnostics
  const diagnostics = {
    marketsScanned: eligibleMarkets.length,
    eventsScanned,
    eventsWithAI,
    cacheHits,
    aiCallsMade: eventsWithAI,
    aiCacheHits: cacheHits,
    aiCacheMisses: eventsWithAI,
    aiStatusLog,
    aiDisabled: !callAI,
    cacheStats: getCacheStats(),
    marketDetectionLog,
    winMarketsFound: marketTypeCounts.winMarketsFound,
    placeMarketsFound: marketTypeCounts.placeMarketsFound,
    h2hMarketsFound: marketTypeCounts.h2hMarketsFound,
    unknownMarketsFound: marketTypeCounts.unknownMarketsFound,
    raceClustersCreated: eventClusters.length,
    totalOpportunities: allOpportunities.length,
    backOpportunities: allOpportunities.filter(o => o.side === 'BACK').length,
    layOpportunities: allOpportunities.filter(o => o.side === 'LAY').length,
    positiveEVOpportunities: allOpportunities.filter(o => o.decision === 'BET').length,
    rejectedOpportunities: allOpportunities.filter(o => o.decision === 'NO_BET').length,
    topOpportunities,
    topRejected: rejectedOpps,
    bestOpportunity: bestOpportunity,
    noBetReason: debugScanMode
      ? (allOpportunities.length === 0
        ? 'Debug scan: no opportunities generated — check AI or price data'
        : `Debug scan: ${allOpportunities.length} opportunities generated, ${allOpportunities.filter(o => o.decision === 'BET').length} positive-EV — NO orders placed (debug mode)`)
      : (bestOpportunity ? null : (allOpportunities.length === 0
        ? 'No opportunities generated — check AI availability or market data'
        : `Best opportunity: ${ranked[0]?.runnerName || 'Unknown'} — ${ranked[0]?.blockers?.[0] || 'blocked by safety gate'}`)),
    bestByCategory: getBestByCategory(allOpportunities),
    aiDecisions,
    // ── New diagnostic layers ──
    marketFeedDiagnostics,
    timeWindowFunnel,
    loadedMarketsTable,
    connectionDiagnostics,
    debugScanMode,
    totalMarketsLoaded,
    openPreRaceMarkets,
    marketsInsideTimeWindow,
    eligibleMarketsAfterRunnerFilter: eligibleAfterRunnerFilter,
    eligibleMarketsAfterPriceFilter: eligibleAfterPriceFilter,
    marketsSentToExchangeEngine: eligibleMarkets.length,
    // ── External search diagnostics ──
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
      perEventResults: externalSearchPerEvent,
      cacheStats: getExternalSearchCacheStats(),
    },
  };

  return {
    bestOpportunity,
    allOpportunities: ranked,
    eventClusters,
    diagnostics,
  };
}

/**
 * Convert an opportunity into a signal for the existing order pipeline.
 */
export function opportunityToSignal(opportunity, settings) {
  return {
    strategyName: opportunity.proofMode ? 'Paper Proof Mode' : STRATEGY_NAME,
    marketId: opportunity.marketId,
    betfairMarketId: opportunity.betfairMarketId,
    selectionId: opportunity.selectionId,
    runnerId: opportunity.runnerName, // Will be resolved by caller
    side: opportunity.side,
    odds: opportunity.odds,
    stakeSuggestion: opportunity.stake,
    modelProbability: opportunity.modelProbability,
    impliedProbability: opportunity.impliedProbability,
    fairOdds: opportunity.fairOdds,
    edgePercent: opportunity.edge * 100,
    expectedValue: opportunity.ev,
    confidence: opportunity.confidence,
    signalStatus: 'active',
    persistenceType: 'LAPSE', // Always LAPSE — never PERSIST
    spreadTicks: opportunity.spreadTicks,
    reason: opportunity.reasons.join('; '),
    dataSource: opportunity.proofMode ? 'MARKET_ONLY_PROOF' : 'BETFAIR_METADATA_PLUS_MARKET',
    marketType: opportunity.marketType,
    opponentSelectionId: opportunity.opponentSelectionId,
    liability: opportunity.liability,
    commissionRate: opportunity.commissionRate,
    proofMode: opportunity.proofMode || false,
  };
}

export { MARKET_TYPE_THRESHOLDS, resolveMarketTypeThresholds };