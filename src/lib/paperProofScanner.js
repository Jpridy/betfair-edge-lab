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
import { matchRunnerToMarket } from './marketIdMatcher';
import { activeRaceOrders } from './raceExposure';
import { compareOpportunities } from './opportunityRanking';
import { DECISION_SOURCES } from './decisionProvenance';
import { resolveCommissionRate } from './commission';
import { buildCalculationResult } from './exchangeMath';

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
      if (marketType === 'UNKNOWN') continue;

      const marketRunners = allRunners.filter(r =>
        matchRunnerToMarket(r, market) && r.status === 'ACTIVE'
      );

      for (const runner of marketRunners) {
        const selectionId = String(runner.betfairSelectionId || runner.selectionId || '');
        if (!selectionId) continue;

        // Proof mode never bypasses the one-order-per-race guard.
        if (activeRaceOrders(paperOrders, { ...market, eventId:cluster.eventId }).length) continue;

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

  const nowMs = Date.now();
  candidates.sort((a,b)=>compareOpportunities(
    { ...a, decision:'BET', roi:0, ev:0, confidence:25, dataQuality:30, fillProbability:.9, liquidityScore:Math.min(1,a.availableSize/10), spreadTicks:0, delayRiskScore:0, marketId:a.market.betfairMarketId || a.market.id },
    { ...b, decision:'BET', roi:0, ev:0, confidence:25, dataQuality:30, fillProbability:.9, liquidityScore:Math.min(1,b.availableSize/10), spreadTicks:0, delayRiskScore:0, marketId:b.market.betfairMarketId || b.market.id }
  ));

  const best = candidates[0];
  const { market, runner, marketType, selectionId, side, odds, availableSize, cluster } = best;

  const stake = calcProofStake(side, odds, settings);
  const commission = resolveCommissionRate(market, settings);
  if (!commission.valid) return null;
  const calculationResult = buildCalculationResult({ side, probability:1/odds, odds, normalizedCommissionRate:commission.normalizedRate, stake });
  const liability = calculationResult.liability;
  const maxLoss = calculationResult.lossIfLose;
  const maxProfit = calculationResult.profitIfWin;

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
    commissionRate: commission.normalizedRate,
    normalizedCommissionRate: commission.normalizedRate,
    calculationResult,
    mathematicalInvariantsPassed: calculationResult.mathematicalInvariantsPassed,
    ev: calculationResult.ev,
    roi: calculationResult.roi,
    edge: calculationResult.edge,
    confidence: 25,
    dataQuality: 30,
    decisionSource: DECISION_SOURCES.PROOF_OVERRIDE,
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