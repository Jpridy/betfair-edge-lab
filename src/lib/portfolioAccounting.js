import { isActiveExposureOrder, orderExposure } from './riskExposure';
import {
  hasEconomicSettlement,
  hasSettlementStateMismatch,
  isPerformanceExcluded,
  normalizedOrderResult,
  settlementMoney,
} from './orderState';

const round = value => {
  const result = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return Object.is(result, -0) ? 0 : result;
};

const numberOrNull = value => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const orderLabel = order => order?.id || order?.customerRef || order?.runnerName || 'unknown';

export function calculatePortfolioAccounting(orders = [], startingBankroll = 0) {
  const included = (orders || []).filter(order => !isPerformanceExcluded(order));
  const reconciliationErrors = [];

  const settledStateWithoutMoney = included.filter(order => {
    const result = normalizedOrderResult(order);
    const status = String(order?.status || '').toLowerCase();
    const settlementStatus = String(order?.settlementStatus || '').toLowerCase();
    const looksSettled = ['settled', 'voided'].includes(status) || ['settled', 'voided'].includes(settlementStatus);
    return looksSettled && ['won', 'lost', 'void'].includes(result) && !hasEconomicSettlement(order);
  });
  for (const order of settledStateWithoutMoney) {
    reconciliationErrors.push(`INCOMPLETE_SETTLEMENT:${orderLabel(order)}`);
  }

  // Economic settlement values remain authoritative for P/L even when a legacy
  // record has not had its status fields migrated yet. The mismatch is surfaced
  // as a reconciliation error instead of silently dropping the result.
  const settled = included.filter(hasEconomicSettlement);
  const inconsistentOrders = settled.filter(hasSettlementStateMismatch);
  for (const order of inconsistentOrders) {
    reconciliationErrors.push(`RESULT_STATE_MISMATCH:${orderLabel(order)}`);
  }

  let grossWinnings = 0;
  let grossLosses = 0;
  let commissionPaid = 0;
  let totalSettledCapitalAtRisk = 0;
  let wonOrderCount = 0;
  let lostOrderCount = 0;
  let voidOrderCount = 0;

  for (const order of settled) {
    const result = normalizedOrderResult(order);
    const { grossProfit, commission, netProfit } = settlementMoney(order);
    if (grossProfit == null || commission == null || netProfit == null) {
      reconciliationErrors.push(`MISSING_SETTLEMENT_MONEY:${orderLabel(order)}`);
      continue;
    }

    if (result === 'won') {
      wonOrderCount += 1;
      if (grossProfit > 0) grossWinnings += grossProfit;
      else if (grossProfit < 0) reconciliationErrors.push(`WINNING_ORDER_NEGATIVE_GROSS:${orderLabel(order)}`);
    } else if (result === 'lost') {
      lostOrderCount += 1;
      if (grossProfit < 0) grossLosses += grossProfit;
      else if (grossProfit > 0) reconciliationErrors.push(`LOSING_ORDER_POSITIVE_GROSS:${orderLabel(order)}`);
      if (Math.abs(commission) > 0.000001) reconciliationErrors.push(`LOSING_ORDER_COMMISSION:${orderLabel(order)}`);
    } else {
      voidOrderCount += 1;
      if (Math.abs(grossProfit) > 0.005 || Math.abs(commission) > 0.005 || Math.abs(netProfit) > 0.005) {
        reconciliationErrors.push(`VOID_ORDER_NON_ZERO_RESULT:${orderLabel(order)}`);
      }
    }

    if (Math.abs((grossProfit - commission) - netProfit) > 0.005) {
      reconciliationErrors.push(`ORDER_NET_MISMATCH:${orderLabel(order)}`);
    }

    const stake = numberOrNull(order.matchedCalculation?.stake ?? order.matchedStake ?? order.matched_size) ?? 0;
    const odds = numberOrNull(order.matchedCalculation?.odds ?? order.matchedOdds ?? order.matched_price) ?? 0;
    totalSettledCapitalAtRisk += String(order.side || '').toUpperCase() === 'LAY'
      ? (numberOrNull(order.matchedCalculation?.liability) ?? stake * Math.max(0, odds - 1))
      : stake;
    commissionPaid += commission;
  }

  grossWinnings = round(grossWinnings);
  grossLosses = round(grossLosses);
  commissionPaid = round(commissionPaid);
  const absoluteGrossLosses = round(Math.abs(grossLosses));
  const grossRealisedPL = round(grossWinnings + grossLosses);
  const netRealisedPL = round(grossRealisedPL - commissionPaid);
  const bankroll = round(Number(startingBankroll));
  const currentEquity = round(bankroll + netRealisedPL);

  let matchedBackExposure = 0;
  let matchedLayLiability = 0;
  let unmatchedReservedExposure = 0;
  let pendingPotentialProfit = 0;
  const active = included.filter(isActiveExposureOrder);

  for (const order of active) {
    const exposure = orderExposure(order);
    if (String(order.side || '').toUpperCase() === 'LAY') matchedLayLiability += exposure.matchedExposure;
    else matchedBackExposure += exposure.matchedExposure;
    unmatchedReservedExposure += exposure.unmatchedReservedExposure;

    const stake = numberOrNull(order.matchedCalculation?.stake ?? order.matchedStake ?? order.matched_size) ?? 0;
    const odds = numberOrNull(order.matchedCalculation?.odds ?? order.matchedOdds ?? order.requestedOdds ?? order.requested_price) ?? 0;
    pendingPotentialProfit += String(order.side || '').toUpperCase() === 'LAY'
      ? stake
      : stake * Math.max(0, odds - 1);
  }

  matchedBackExposure = round(matchedBackExposure);
  matchedLayLiability = round(matchedLayLiability);
  unmatchedReservedExposure = round(unmatchedReservedExposure);
  const totalOpenExposure = round(matchedBackExposure + matchedLayLiability + unmatchedReservedExposure);
  const availableBankroll = round(currentEquity - totalOpenExposure);

  if (round(grossWinnings + grossLosses) !== grossRealisedPL) reconciliationErrors.push('GROSS_PL_RECONCILIATION_FAILED');
  if (round(grossRealisedPL - commissionPaid) !== netRealisedPL) reconciliationErrors.push('NET_PL_RECONCILIATION_FAILED');
  if (round(bankroll + netRealisedPL) !== currentEquity) reconciliationErrors.push('EQUITY_RECONCILIATION_FAILED');

  const profitFactor = absoluteGrossLosses > 0 ? grossWinnings / absoluteGrossLosses : null;
  const netROI = totalSettledCapitalAtRisk > 0 ? netRealisedPL / totalSettledCapitalAtRisk : null;

  return Object.freeze({
    startingBankroll: bankroll,
    settledOrderCount: settled.length,
    economicallyResolvedOrderCount: settled.length,
    resolvedButStateInconsistentCount: inconsistentOrders.length,
    unresolvedOrderCount: active.length,
    wonOrderCount,
    lostOrderCount,
    voidOrderCount,
    grossWinnings,
    grossLosses,
    absoluteGrossLosses,
    grossRealisedPL,
    commissionPaid,
    netRealisedPL,
    currentEquity,
    matchedBackExposure,
    matchedLayLiability,
    unmatchedReservedExposure,
    totalOpenExposure,
    availableBankroll,
    pendingPotentialProfit: round(pendingPotentialProfit),
    totalSettledCapitalAtRisk: round(totalSettledCapitalAtRisk),
    profitFactor,
    netROI,
    netROIOnCapitalAtRisk: netROI,
    accountingDataInconsistent: reconciliationErrors.length > 0,
    accountingReconciliationPassed: reconciliationErrors.length === 0,
    reconciliationErrors,
    inconsistentOrderIds: inconsistentOrders.map(order => order.id).filter(Boolean),
    generatedAt: new Date().toISOString(),
  });
}
