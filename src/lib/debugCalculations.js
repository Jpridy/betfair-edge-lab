import { resolveCommissionRate } from '@/lib/commission';
import { validateCompleteMarketBook } from '@/lib/marketBookValidation';

const marketIdOf = item => String(item?.betfairMarketId || item?.marketId || item?.id || '');

export function buildCalculationSnapshots(opportunities = [], timestamp) {
  return opportunities.map(opportunity => {
    const canonical = opportunity.calculationResult || {};
    const valuesMatched = (canonical.ev == null || Number(canonical.ev) === Number(opportunity.ev)) && (canonical.roi == null || Number(canonical.roi) === Number(opportunity.roi));
    return {
      opportunityId:opportunity.opportunityId ?? null, runnerName:opportunity.runnerName ?? null, selectionId:opportunity.selectionId ?? null, side:opportunity.side ?? null, odds:opportunity.odds ?? null, probability:opportunity.finalProbabilityUsedInEV ?? opportunity.modelProbability ?? null,
      impliedProbability:opportunity.impliedProbability ?? null, normalizedCommissionRate:opportunity.normalizedCommissionRate ?? opportunity.commissionRate ?? null,
      stake:opportunity.stake ?? null, liability:opportunity.liability ?? null, profitIfWin:opportunity.maxProfit ?? canonical.profitIfWin ?? null, lossIfLose:opportunity.maxLoss ?? canonical.lossIfLose ?? null,
      ev:opportunity.ev ?? null, roi:opportunity.roi ?? null, edge:opportunity.edge ?? null, breakevenProbability:opportunity.breakevenProbability ?? null,
      mathematicalInvariantsPassed:opportunity.mathematicalInvariantsPassed ?? canonical.mathematicalInvariantsPassed ?? null,
      sourceFunction:canonical.sourceFunction || 'exchangeMath', calculationTimestamp:opportunity.calculationTimestamp || timestamp || null,
      rankedCalculation:canonical, finalAuthorityRecalculation:opportunity.finalAuthorityRecalculation || null, valuesMatched,
      mismatchReason:valuesMatched ? null : 'Ranked calculation differs from the final opportunity values',
    };
  });
}

export function buildCommissionSnapshots(markets = [], opportunities = [], settings = {}) {
  const marketRows = markets.map(market => ({ marketId:marketIdOf(market), rawMarketBaseRate:market.marketBaseRate ?? null, ...commissionFields(resolveCommissionRate(market, settings), settings) }));
  const selectedRows = opportunities.map(item => {
    const market = markets.find(candidate => marketIdOf(candidate) === marketIdOf(item)) || { marketBaseRate:item.rawCommissionRate ?? item.commissionRate };
    const resolved = resolveCommissionRate(market, settings);
    const opportunityRate = item.normalizedCommissionRate !== '' && item.normalizedCommissionRate != null ? item.normalizedCommissionRate : item.commissionRate !== '' ? item.commissionRate : null;
    return { opportunityId:item.opportunityId ?? null, marketId:marketIdOf(item), rawMarketBaseRate:market.marketBaseRate ?? item.rawCommissionRate ?? null, ...commissionFields(opportunityRate != null ? {rawRate:item.rawCommissionRate ?? opportunityRate,normalizedRate:Number(opportunityRate),source:item.commissionSource || resolved.source,normalizationApplied:item.commissionNormalizationApplied ?? false,valid:Number.isFinite(Number(opportunityRate)),error:Number.isFinite(Number(opportunityRate)) ? null : 'COMMISSION_RATE_NOT_FINITE'} : resolved, settings) };
  });
  return { markets:marketRows, opportunities:selectedRows, selectedOpportunities:selectedRows.filter(item => opportunities.find(source => source.opportunityId === item.opportunityId && (source.selectedAsBestBet || source.selectedAsBestRejected || source.selectedAsFinalCandidate))) };
}

function commissionFields(result, settings) {
  return { defaultCommissionRate:settings.defaultCommissionRate ?? null, normalizedCommissionRate:result.normalizedRate ?? null, commissionSource:result.source ?? null, normalizationApplied:result.normalizationApplied ?? false, valid:result.valid ?? false, error:result.error ?? null };
}

export function buildMarketBookValidation(markets = [], runners = [], sentIds = []) {
  const allowed = new Set(sentIds.map(String).filter(Boolean));
  return markets.filter(market => allowed.size > 0 && allowed.has(marketIdOf(market))).map(market => {
    const marketId = marketIdOf(market);
    const marketRunners = runners.filter(runner => marketIdOf(runner) === marketId);
    const validation = validateCompleteMarketBook(marketRunners);
    return { marketId, marketType:market.marketTypeCode || market.marketType, ...validation, runners:marketRunners.map(runner => ({ selectionId:runner.betfairSelectionId || runner.selectionId || null, runnerName:runner.runnerName || null, bestBackPrice:runner.bestBackPrice ?? null, bestBackSize:runner.bestBackSize ?? null, bestLayPrice:runner.bestLayPrice ?? null, bestLaySize:runner.bestLaySize ?? null })) };
  });
}