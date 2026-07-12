import { resolveCommissionRate } from '@/lib/commission';
import { validateCompleteMarketBook } from '@/lib/marketBookValidation';
import { buildCalculationResult } from '@/lib/exchangeMath';

const marketIdOf = item => String(item?.betfairMarketId || item?.marketId || item?.id || '');

export function buildCalculationSnapshots(opportunities = [], timestamp) {
  return opportunities.map(opportunity => {
    const probability=opportunity.finalProbabilityUsedInEV ?? opportunity.modelProbability;
    const commission=opportunity.normalizedCommissionRate ?? opportunity.commissionRate;
    const canRebuild=['BACK','LAY'].includes(opportunity.side) && Number(opportunity.odds)>1 && Number(probability)>0 && Number(opportunity.stake)>0 && Number(commission)>=0;
    const rebuilt=canRebuild ? buildCalculationResult({side:opportunity.side,probability:Number(probability),odds:Number(opportunity.odds),normalizedCommissionRate:Number(commission),stake:Number(opportunity.stake)}) : null;
    const ranked=Object.keys(opportunity.calculationResult || {}).length ? opportunity.calculationResult : (rebuilt || calculationProjection(opportunity));
    const finalAuthority=opportunity.finalAuthorityRecalculation && typeof opportunity.finalAuthorityRecalculation === 'object' ? opportunity.finalAuthorityRecalculation : null;
    const comparison=finalAuthority || ranked;
    const fields=['ev','roi','edge','liability','breakevenProbability'];
    const hasComparableValues=Number.isFinite(Number(opportunity.ev)) && Number.isFinite(Number(opportunity.roi));
    const valuesMatched=hasComparableValues && fields.every(field => comparison?.[field] == null || opportunity[field] == null || close(comparison[field],opportunity[field]));
    const mathematicalInvariantsPassed=(opportunity.mathematicalInvariantsPassed ?? ranked?.mathematicalInvariantsPassed ?? rebuilt?.mathematicalInvariantsPassed) === true;
    const failedGate=opportunity.failedGate || opportunity.blockers?.[0] || 'REJECTED_BEFORE_ORDER_AUTHORITY';
    return {
      opportunityId:opportunity.opportunityId ?? null, runnerName:opportunity.runnerName ?? null, selectionId:opportunity.selectionId ?? null, side:opportunity.side ?? null, odds:opportunity.odds ?? null, probability:probability ?? null,
      impliedProbability:opportunity.impliedProbability ?? null, normalizedCommissionRate:commission ?? null,
      stake:opportunity.stake ?? null, liability:opportunity.liability ?? null, profitIfWin:opportunity.maxProfit ?? ranked?.profitIfWin ?? null, lossIfLose:opportunity.maxLoss ?? ranked?.lossIfLose ?? null,
      ev:opportunity.ev ?? null, roi:opportunity.roi ?? null, edge:opportunity.edge ?? null, breakevenProbability:opportunity.breakevenProbability ?? null,
      mathematicalInvariantsPassed, sourceFunction:ranked?.sourceFunction || 'exchangeMath', calculationTimestamp:opportunity.calculationTimestamp || timestamp || null,
      rankedCalculation:ranked, finalAuthorityRecalculation:finalAuthority || 'not_reached', finalAuthorityNotReachedReason:finalAuthority ? null : failedGate,
      valuesMatched, mismatchReason:valuesMatched ? null : 'Ranked and final values do not match',
    };
  });
}

const close=(a,b)=>Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a)-Number(b))<=1e-6;
function calculationProjection(item) { return {side:item.side ?? null,probability:item.finalProbabilityUsedInEV ?? item.modelProbability ?? null,impliedProbability:item.impliedProbability ?? null,odds:item.odds ?? null,normalizedCommissionRate:item.normalizedCommissionRate ?? item.commissionRate ?? null,stake:item.stake ?? null,liability:item.liability ?? null,profitIfWin:item.maxProfit ?? null,lossIfLose:item.maxLoss ?? null,ev:item.ev ?? null,roi:item.roi ?? null,edge:item.edge ?? null,breakevenProbability:item.breakevenProbability ?? null,mathematicalInvariantsPassed:false,sourceFunction:'export_projection'}; }

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
    const validation = validateCompleteMarketBook(marketRunners,market);
    return { marketId, marketType:market.marketTypeCode || market.marketType, ...validation, runners:marketRunners.map(runner => ({ selectionId:runner.betfairSelectionId || runner.selectionId || null, runnerName:runner.runnerName || null, bestBackPrice:runner.bestBackPrice ?? null, bestBackSize:runner.bestBackSize ?? null, bestLayPrice:runner.bestLayPrice ?? null, bestLaySize:runner.bestLaySize ?? null })) };
  });
}