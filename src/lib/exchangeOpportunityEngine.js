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

const OPEN_ORDER_STATUSES = ['pending', 'executable', 'matched', 'unmatched', 'partially_matched'];
const STRATEGY_NAME = 'Featherless AI Value Decision Engine';

/**
 * Scan all eligible pre-race markets.
 * @returns {Array} Eligible markets (OPEN, not in-play, 2+ runners, in time window)
 */
export function scanEligibleMarkets(markets, runners, settings) {
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

    // Time window: include markets that are within or approaching the window
    const start = m.startTime ? new Date(m.startTime).getTime() : NaN;
    if (isNaN(start)) return true; // No start time — include (will be filtered later)
    const secsBefore = (start - nowMs) / 1000;
    // Include markets from windowEnd to windowStart * 2 (gives buffer for scanning)
    return secsBefore > windowEnd && secsBefore < windowStart * 2;
  });
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
 * @returns {object} { bestOpportunity, allOpportunities, eventClusters, diagnostics }
 */
export async function runExchangeCycle({ markets, runners, settings, featherlessSettings, bankrollStats, paperOrders, emergencyStop, callAI }) {
  if (emergencyStop) {
    return {
      bestOpportunity: null,
      allOpportunities: [],
      eventClusters: [],
      diagnostics: { noBetReason: 'Emergency stop active', marketsScanned: 0, eventsScanned: 0 },
    };
  }

  // 1. Scan all eligible pre-race markets
  const eligibleMarkets = scanEligibleMarkets(markets, runners, settings);
  if (eligibleMarkets.length === 0) {
    return {
      bestOpportunity: null,
      allOpportunities: [],
      eventClusters: [],
      diagnostics: { noBetReason: 'No eligible open pre-race markets found', marketsScanned: 0, eventsScanned: 0, marketDetectionLog: [] },
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

    if (!aiResult) continue;

    // 5-7. Generate opportunities with exchange maths and safety gates
    const opportunities = generateOpportunitiesForEvent(
      cluster, runners, aiResult, settings, featherlessSettings, bankrollStats, paperOrders
    );
    allOpportunities.push(...opportunities);
  }

  // 8. Rank all opportunities by EV
  const ranked = rankOpportunities(allOpportunities);

  // 9. Choose best positive-EV opportunity
  const bestOpportunity = ranked.find(o => o.decision === 'BET') || null;

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
    noBetReason: bestOpportunity ? null : (allOpportunities.length === 0
      ? 'No opportunities generated — check AI availability or market data'
      : `Best opportunity: ${ranked[0]?.runnerName || 'Unknown'} — ${ranked[0]?.blockers?.[0] || 'blocked by safety gate'}`),
    bestByCategory: getBestByCategory(allOpportunities),
    aiDecisions,
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
    strategyName: STRATEGY_NAME,
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
    persistenceType: 'LAPSE',
    spreadTicks: opportunity.spreadTicks,
    reason: opportunity.reasons.join('; '),
    dataSource: 'BETFAIR_METADATA_PLUS_MARKET',
    marketType: opportunity.marketType,
    opponentSelectionId: opportunity.opponentSelectionId,
    liability: opportunity.liability,
    commissionRate: opportunity.commissionRate,
  };
}

export { MARKET_TYPE_THRESHOLDS, resolveMarketTypeThresholds };