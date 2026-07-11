import { resolveCommissionRate } from '@/lib/commission';
import { validateCompleteMarketBook } from '@/lib/marketBookValidation';

const marketIdOf = item => String(item?.betfairMarketId || item?.marketId || item?.id || '');

export function buildCalculationSnapshots(opportunities = [], timestamp) {
  return opportunities.map(opportunity => {
    const canonical = opportunity.calculationResult || {};
    const valuesMatched = (canonical.ev == null || Number(canonical.ev) === Number(opportunity.ev)) && (canonical.roi == null || Number(canonical.roi) === Number(opportunity.roi));
    return {
      opportunityId:opportunity.opportunityId, side:opportunity.side, odds:opportunity.odds, probability:opportunity.finalProbabilityUsedInEV ?? opportunity.modelProbability,
      impliedProbability:opportunity.impliedProbability, normalizedCommissionRate:opportunity.normalizedCommissionRate ?? opportunity.commissionRate,
      stake:opportunity.stake, liability:opportunity.liability, profitIfWin:opportunity.maxProfit ?? canonical.profitIfWin, lossIfLose:opportunity.maxLoss ?? canonical.lossIfLose,
      ev:opportunity.ev, roi:opportunity.roi, edge:opportunity.edge, breakevenProbability:opportunity.breakevenProbability,
      mathematicalInvariantsPassed:opportunity.mathematicalInvariantsPassed ?? canonical.mathematicalInvariantsPassed ?? null,
      sourceFunction:canonical.sourceFunction || 'exchangeMath', calculationTimestamp:opportunity.calculationTimestamp || timestamp,
      rankedCalculation:canonical, finalAuthorityRecalculation:opportunity.finalAuthorityRecalculation || null, valuesMatched,
      mismatchReason:valuesMatched ? null : 'Ranked calculation differs from the final opportunity values',
    };
  });
}

export function buildCommissionSnapshots(markets = [], opportunities = [], settings = {}) {
  const marketRows = markets.map(market => ({ marketId:marketIdOf(market), rawMarketBaseRate:market.marketBaseRate, ...commissionFields(resolveCommissionRate(market, settings), settings) }));
  const selectedRows = opportunities.filter(item => item.selectedAsBestBet || item.selectedAsBestRejected || item.selectedAsFinalCandidate).map(item => {
    const market = markets.find(candidate => marketIdOf(candidate) === marketIdOf(item)) || { marketBaseRate:item.rawCommissionRate ?? item.commissionRate };
    return { opportunityId:item.opportunityId, marketId:marketIdOf(item), rawMarketBaseRate:market.marketBaseRate, ...commissionFields(resolveCommissionRate(market, settings), settings) };
  });
  return { markets:marketRows, selectedOpportunities:selectedRows };
}

function commissionFields(result, settings) {
  return { defaultCommissionRate:settings.defaultCommissionRate, normalizedCommissionRate:result.normalizedRate, commissionSource:result.source, normalizationApplied:result.normalizationApplied, valid:result.valid, error:result.error };
}

export function buildMarketBookValidation(markets = [], runners = [], sentIds = []) {
  const allowed = new Set(sentIds.map(String).filter(Boolean));
  return markets.filter(market => allowed.size === 0 || allowed.has(marketIdOf(market))).map(market => {
    const marketId = marketIdOf(market);
    const marketRunners = runners.filter(runner => marketIdOf(runner) === marketId);
    const validation = validateCompleteMarketBook(marketRunners);
    return { marketId, marketType:market.marketTypeCode || market.marketType, ...validation, runners:marketRunners.map(runner => ({ selectionId:runner.betfairSelectionId || runner.selectionId, runnerName:runner.runnerName, bestBackPrice:runner.bestBackPrice, bestBackSize:runner.bestBackSize, bestLayPrice:runner.bestLayPrice, bestLaySize:runner.bestLaySize })) };
  });
}