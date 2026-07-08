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

import { clusterMarketsByEvent, getPrimaryMarket, getAllMarketsInCluster } from './marketClusterer';
import { generateOpportunitiesForEvent, rankOpportunities, getBestByCategory } from './crossMarketValueScanner';
import { resolveMarketTypeThresholds, MARKET_TYPE_THRESHOLDS } from './crossMarketValueScanner';

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
      diagnostics: { noBetReason: 'No eligible open pre-race markets found', marketsScanned: 0, eventsScanned: 0 },
    };
  }

  // 2. Group by event/race
  const eventClusters = clusterMarketsByEvent(eligibleMarkets);

  // 3-4. For each event, call AI for probabilities and generate opportunities
  const allOpportunities = [];
  const aiDecisions = [];
  let eventsScanned = 0;
  let eventsWithAI = 0;

  for (const cluster of eventClusters) {
    eventsScanned++;
    const primaryMarket = getPrimaryMarket(cluster);
    if (!primaryMarket) continue;

    // Skip if this event already has a strategy order in all its markets
    const clusterMarketIds = getAllMarketsInCluster(cluster).map(m => m.betfairMarketId || m.id);
    const hasStrategyOrder = paperOrders.some(o =>
      clusterMarketIds.includes(o.betfairMarketId || o.marketId) &&
      o.strategyName === STRATEGY_NAME &&
      OPEN_ORDER_STATUSES.includes(o.status)
    );
    // Allow multiple opportunities per event — one per market type

    // Get runners for the primary market
    const marketRunners = runners.filter(r =>
      (r.marketId === primaryMarket.id || r.marketId === primaryMarket.betfairMarketId) && r.status === 'ACTIVE'
    );

    if (marketRunners.length === 0) continue;

    // 3-4. Call AI for probabilities (delegated to callback)
    let aiResult = null;
    if (callAI) {
      try {
        aiResult = await callAI(cluster, primaryMarket, marketRunners);
        if (aiResult) {
          eventsWithAI++;
          aiDecisions.push({ eventId: cluster.eventId, aiResult });
        }
      } catch (err) {
        // AI failed — skip this event
        continue;
      }
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

  // Build diagnostics
  const diagnostics = {
    marketsScanned: eligibleMarkets.length,
    eventsScanned,
    eventsWithAI,
    totalOpportunities: allOpportunities.length,
    positiveEVOpportunities: allOpportunities.filter(o => o.decision === 'BET').length,
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