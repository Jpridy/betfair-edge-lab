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
import { calcProofStake, proofLiabilityLimit } from './paperProofDefaults';
import { matchRunnerToMarket } from './marketIdMatcher';
import { activeRaceOrders, exposureBlock } from './raceExposure';
import { compareOpportunities } from './opportunityRanking';
import { validateCompleteMarketBook } from './marketBookValidation';
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
export function getProofFallbackHardGate({ priceFeedStatus, raceMonitoring } = {}) {
  if (priceFeedStatus !== 'LIVE') return priceFeedStatus === 'STALE' ? 'STALE_PRICE_DATA' : 'PRICE_DATA_UNAVAILABLE';
  if (raceMonitoring?.raceLocked || raceMonitoring?.activeOrderExistsForRace) return 'DUPLICATE_RACE_EXPOSURE';
  if (raceMonitoring?.duplicateMarketRecordDetected) return 'DUPLICATE_MARKET_EXPOSURE';
  return null;
}

export function buildProofOpportunity(eventClusters, allRunners, paperOrders, settings, safetyContext = {}) {
  const hardGate = getProofFallbackHardGate(safetyContext);
  if (hardGate) return null;
  const candidates = [];
  const nowMs = safetyContext.now ?? Date.now();
  const windowStart = safetyContext.windowStart ?? settings.defaultTimeWindowStartSeconds ?? 500;
  const windowEnd = safetyContext.windowEnd ?? settings.defaultTimeWindowEndSeconds ?? 30;

  for (const cluster of eventClusters) {
    const allMarkets = [
      ...cluster.winMarkets,
      ...cluster.placeMarkets,
      ...cluster.h2hMarkets,
    ];

    for (const market of allMarkets) {
      if (market.status !== 'OPEN' || market.inPlay) continue;
      const marketType = detectMarketType(market);
      if (marketType === 'UNKNOWN' || marketType === 'PLACE') continue;
      const startTime = market.startTime || market.marketStartTime;
      const secondsToStart = startTime ? Math.round((new Date(startTime).getTime() - nowMs) / 1000) : null;
      if (secondsToStart == null || secondsToStart <= windowEnd || secondsToStart > windowStart) continue;
      const raceLike = { ...market, eventId:cluster.eventId, eventName:cluster.eventName, raceNumber:cluster.raceNumber, venue:cluster.venue, startTime:cluster.startTime || startTime };
      if (activeRaceOrders(paperOrders, raceLike).length || exposureBlock(paperOrders, raceLike, settings)) continue;
      const commission = resolveCommissionRate(market, settings);
      if (!commission.valid) continue;
      const marketRunners = allRunners.filter(r => matchRunnerToMarket(r, market) && r.status === 'ACTIVE');
      if (!validateCompleteMarketBook(marketRunners,market,settings.maxBackBookPercentage||150).valid) continue;

      for (const runner of marketRunners) {
        const selectionId = String(runner.betfairSelectionId || runner.selectionId || '');
        if (!selectionId) continue;

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

  candidates.sort((a,b)=>compareOpportunities(
    { ...a, decision:'BET', roi:0, ev:0, confidence:25, dataQuality:30, fillProbability:.9, liquidityScore:Math.min(1,a.availableSize/10), spreadTicks:0, delayRiskScore:0, marketId:a.market.betfairMarketId || a.market.id },
    { ...b, decision:'BET', roi:0, ev:0, confidence:25, dataQuality:30, fillProbability:.9, liquidityScore:Math.min(1,b.availableSize/10), spreadTicks:0, delayRiskScore:0, marketId:b.market.betfairMarketId || b.market.id }
  ));

  const best = candidates[0];
  const { market, runner, marketType, selectionId, side, odds, availableSize, cluster } = best;

  const stake=calcProofStake(side,odds,settings);
  if(!(stake>=2))return null;
  const commission = resolveCommissionRate(market, settings);
  if (!commission.valid) return null;
  const calculationResult = buildCalculationResult({ side, probability:1/odds, odds, normalizedCommissionRate:commission.normalizedRate, stake });
  if (!calculationResult.mathematicalInvariantsPassed) return null;
  const liability=calculationResult.liability;
  if(side==='LAY'&&liability>proofLiabilityLimit(settings))return null;
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
    breakevenProbability:calculationResult.breakevenProbability,
    commissionAwareBreakevenProbability:calculationResult.commissionAwareBreakevenProbability,
    rawProbabilityEdge:calculationResult.rawProbabilityEdge,
    commissionAdjustedEdge:calculationResult.commissionAdjustedEdge,
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
    decision:'PROOF_OVERRIDE',
    gatesPassed:true,
    proofMode:true,
    excludeFromPerformance:true,
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