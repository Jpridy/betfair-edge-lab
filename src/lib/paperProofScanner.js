// ============================================================================
// Paper Proof Opportunity Fallback
//
// When Paper Proof Mode is active and no positive-EV opportunity passes the
// normal BET gates, this module creates a "proof opportunity" from the best
// available market — a forced paper bet to test the full order lifecycle.
//
// This is ONLY allowed when:
//   - paperProofMode = true
//   - liveTradingEnabled = false
//   - forcedPaperOnlyMode = true
// ============================================================================

import { detectMarketType } from './marketClusterer';
import { calcProofStake } from './paperProofDefaults';
import { matchRunnerToMarket, matchOrderToMarket, matchSelectionId } from './marketIdMatcher';

const OPEN_ORDER_STATUSES = ['pending', 'executable', 'matched', 'unmatched', 'partially_matched'];

/**
 * Build a proof fallback opportunity from the best available market.
 *
 * @param {Array} eventClusters - Clustered markets from exchange engine
 * @param {Array} allRunners - All runners
 * @param {Array} paperOrders - Existing paper orders (for duplicate check)
 * @param {object} settings - App settings
 * @returns {object|null} Proof opportunity or null if no suitable market
 */
export function buildProofOpportunity(eventClusters, allRunners, paperOrders, settings) {
  const candidates = [];

  for (const cluster of eventClusters) {
    const allMarkets = [
      ...cluster.winMarkets,
      ...cluster.placeMarkets,
      ...cluster.h2hMarkets,
    ];

    for (const market of allMarkets) {
      if (market.status !== 'OPEN') continue;
      if (market.inPlay) continue;

      const marketType = detectMarketType(market);
      if (marketType === 'OTHER') continue;

      const marketRunners = allRunners.filter(r =>
        matchRunnerToMarket(r, market) && r.status === 'ACTIVE'
      );

      for (const runner of marketRunners) {
        const selectionId = String(runner.betfairSelectionId || runner.selectionId || '');
        if (!selectionId) continue;

        // Check for duplicate open order
        const hasDup = paperOrders.some(o =>
          matchOrderToMarket(o, market) &&
          (matchSelectionId(o.selectionId, selectionId) || matchSelectionId(o.runnerId, runner.id)) &&
          OPEN_ORDER_STATUSES.includes(o.status)
        );
        if (hasDup) continue;

        // Prefer BACK side
        if (runner.bestBackPrice > 0 && (runner.bestBackSize || 0) >= 2) {
          candidates.push({
            market, runner, marketType, selectionId,
            side: 'BACK',
            odds: runner.bestBackPrice,
            availableSize: runner.bestBackSize || 0,
            cluster,
            isPreferredMarketType: marketType === 'WIN',
          });
        }

        // Also consider LAY as fallback
        if (runner.bestLayPrice > 0 && (runner.bestLaySize || 0) >= 2) {
          candidates.push({
            market, runner, marketType, selectionId,
            side: 'LAY',
            odds: runner.bestLayPrice,
            availableSize: runner.bestLaySize || 0,
            cluster,
            isPreferredMarketType: marketType === 'WIN',
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Sort candidates by preference:
  // 1. WIN markets first
  // 2. BACK side first
  // 3. Odds between 1.2 and 20 preferred
  // 4. Nearest race (closest to jump)
  // 5. Best liquidity
  const nowMs = Date.now();
  candidates.sort((a, b) => {
    // WIN markets first
    if (a.isPreferredMarketType && !b.isPreferredMarketType) return -1;
    if (!a.isPreferredMarketType && b.isPreferredMarketType) return 1;
    // BACK side first
    if (a.side === 'BACK' && b.side !== 'BACK') return -1;
    if (a.side !== 'BACK' && b.side === 'BACK') return 1;
    // Prefer odds between 1.2 and 20
    const aGoodOdds = a.odds >= 1.2 && a.odds <= 20;
    const bGoodOdds = b.odds >= 1.2 && b.odds <= 20;
    if (aGoodOdds && !bGoodOdds) return -1;
    if (!aGoodOdds && bGoodOdds) return 1;
    // Nearest race
    const aStart = a.market.startTime ? new Date(a.market.startTime).getTime() : Infinity;
    const bStart = b.market.startTime ? new Date(b.market.startTime).getTime() : Infinity;
    const aSecs = (aStart - nowMs) / 1000;
    const bSecs = (bStart - nowMs) / 1000;
    // Prefer races within 24h that haven't jumped
    const aInWindow = aSecs > 0 && aSecs < 86400;
    const bInWindow = bSecs > 0 && bSecs < 86400;
    if (aInWindow && !bInWindow) return -1;
    if (!aInWindow && bInWindow) return 1;
    if (aInWindow && bInWindow) return aSecs - bSecs;
    // Best liquidity
    return b.availableSize - a.availableSize;
  });

  const best = candidates[0];
  const { market, runner, marketType, selectionId, side, odds, availableSize, cluster } = best;

  const stake = calcProofStake(side, odds, settings);
  const liability = side === 'BACK' ? stake : stake * (odds - 1);
  const maxLoss = side === 'BACK' ? stake : liability;
  const maxProfit = side === 'BACK'
    ? (odds - 1) * stake * (1 - (market.marketBaseRate ?? settings.defaultCommissionRate ?? 0.08))
    : stake * (1 - (market.marketBaseRate ?? settings.defaultCommissionRate ?? 0.08));

  const startTime = market.startTime || market.marketStartTime;
  const marketNameParts = [];
  if (market.venue) marketNameParts.push(market.venue);
  if (market.raceNumber) marketNameParts.push(`R${market.raceNumber}`);
  if (market.marketName) marketNameParts.push(market.marketName);
  else if (marketType) marketNameParts.push(marketType);
  const marketDisplayName = marketNameParts.join(' - ') || 'Unknown Market';

  return {
    opportunityId: `proof_${cluster.eventId}_${market.id}_${selectionId}_${side}`,
    eventId: cluster.eventId,
    eventName: cluster.eventName || market.eventName || '',
    marketId: market.id,
    betfairMarketId: market.betfairMarketId || market.id,
    marketType,
    marketTypeCode: market.marketTypeCode || market.marketType || '',
    detectedMarketType: marketType,
    marketName: marketDisplayName,
    marketStartTime: startTime || null,
    selectionId,
    runnerName: runner.runnerName || 'Unknown',
    side,
    odds,
    availableSize,
    bestBackPrice: runner.bestBackPrice || null,
    bestLayPrice: runner.bestLayPrice || null,
    bestBackSize: runner.bestBackSize || null,
    bestLaySize: runner.bestLaySize || null,
    stake,
    liability,
    maxProfit,
    maxLoss,
    modelProbability: 1 / odds,
    impliedProbability: 1 / odds,
    breakevenProbability: 1 / odds,
    fairOdds: odds,
    commissionRate: market.marketBaseRate ?? settings.defaultCommissionRate ?? 0.08,
    ev: 0,
    roi: 0,
    edge: 0,
    confidence: 25,
    dataQuality: 30,
    dataSource: 'MARKET_ONLY_PROOF',
    spreadTicks: 0,
    liquidityScore: Math.min(1, availableSize / 10),
    delayRiskScore: 0,
    fillProbability: 0.9,
    exposureAfterBet: liability,
    overround: 0,
    timeBeforeJump: startTime ? Math.round((new Date(startTime).getTime() - nowMs) / 1000) : null,
    decision: 'BET',
    proofMode: true,
    proofReason: 'Paper proof mode: forced paper opportunity to test order creation and settlement',
    failedGate: null,
    blocker: null,
    blockers: [],
    reasons: ['Paper proof mode: forced opportunity for pipeline testing'],
    externalSearchUsed: false,
    externalSearchStatus: 'not_called',
    externalSourceCount: 0,
    externalDataQuality: 0,
    preSearchProbability: 1 / odds,
    postSearchProbability: 1 / odds,
    probabilityDelta: 0,
    decisionImpact: 'no_effect',
    marketOnlyFallbackReason: null,
    marketOnlyProbability: 1 / odds,
    openAIProbabilityAdjustment: 0,
    finalProbabilityUsedInEV: 1 / odds,
    persistenceType: 'LAPSE',
  };
}