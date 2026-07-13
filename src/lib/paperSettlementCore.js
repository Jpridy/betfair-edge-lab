import { normalizeCommissionStrict } from './strictCommission';
import { calculateMarketCommission } from './commission';

export const normalizeMarketId = value => String(value ?? '').trim();
export const normalizeSelectionId = value => String(value ?? '').trim();

export function normalizeCommissionRate(value) {
  const normalized = normalizeCommissionStrict(value);
  return normalized.valid ? normalized.rate : null;
}

const matchedStakeOf = order => Number(order?.matchedCalculation?.stake ?? order?.matchedStake ?? order?.matched_size) || 0;
const matchedOddsOf = order => Number(order?.matchedCalculation?.odds ?? order?.matchedOdds ?? order?.matched_price) || 0;

export function assertUniformMarketCommission(orders = []) {
  const rates = orders
    .map(order => normalizeCommissionRate(order.normalizedCommissionRate ?? order.commissionRateUsed))
    .filter(rate => rate != null);
  if (rates.length !== orders.length || rates.some(rate => Math.abs(rate - rates[0]) > 1e-12)) {
    throw new Error('INCONSISTENT_MARKET_COMMISSION_RATES');
  }
  return rates[0];
}

export function calculateOrderGross(order, winnerSelectionIds, marketResult = {}) {
  const selection = normalizeSelectionId(order.normalizedSelectionId || order.selectionId);
  const winners = winnerSelectionIds.map(normalizeSelectionId);
  const removed = new Set((marketResult.removedSelectionIds || []).map(normalizeSelectionId));

  if (removed.has(selection)) {
    return {
      selectedWon: false,
      betWon: false,
      grossProfit: 0,
      liability: 0,
      voided: true,
      voidReason: 'runner_removed',
    };
  }

  const voidFraction = Math.max(0, Math.min(1, Number(marketResult.partialVoidFractions?.[selection] ?? marketResult.partialVoidFraction ?? 0)));
  const stake = matchedStakeOf(order) * (1 - voidFraction);
  const reduction = Math.max(0, Math.min(0.999999, Number(marketResult.reductionFactors?.[selection] ?? marketResult.reductionFactor ?? 0)));
  const originalOdds = matchedOddsOf(order);
  const odds = 1 + (originalOdds - 1) * (1 - reduction);
  const deadHeatDivisor = Math.max(1, Number(marketResult.deadHeatDivisors?.[selection] ?? (winners.includes(selection) ? marketResult.deadHeatDivisor : 1) ?? 1));
  const selectedWon = winners.includes(selection);

  if (order.side === 'LAY') {
    const liability = stake * Math.max(0, odds - 1);
    const grossProfit = selectedWon
      ? stake * (1 - 1 / deadHeatDivisor) - liability / deadHeatDivisor
      : stake;
    return {
      selectedWon,
      betWon: grossProfit >= 0,
      grossProfit,
      liability,
      stake,
      odds,
      deadHeatDivisor,
      reductionFactor: reduction,
      partialVoidFraction: voidFraction,
    };
  }

  const grossProfit = selectedWon ? stake * (odds / deadHeatDivisor - 1) : -stake;
  return {
    selectedWon,
    betWon: selectedWon,
    grossProfit,
    liability: stake,
    stake,
    odds,
    deadHeatDivisor,
    reductionFactor: reduction,
    partialVoidFraction: voidFraction,
  };
}

export function allocateMarketCommission(calculations, rate) {
  const totalGross = calculations.reduce((sum, item) => sum + item.grossProfit, 0);
  const normalizedRate = normalizeCommissionRate(rate);
  if (normalizedRate == null) throw new Error('INVALID_COMMISSION');
  const result = calculateMarketCommission(totalGross, normalizedRate);
  if (!result.valid) throw new Error(result.error);

  const marketCommission = result.commission;
  const positiveIndexes = calculations
    .map((item, index) => item.grossProfit > 0 ? index : -1)
    .filter(index => index >= 0);
  const positiveGross = positiveIndexes.reduce((sum, index) => sum + calculations[index].grossProfit, 0);
  let allocated = 0;

  return calculations.map((item, index) => {
    let commission = 0;
    if (marketCommission > 0 && item.grossProfit > 0) {
      commission = index === positiveIndexes.at(-1)
        ? marketCommission - allocated
        : marketCommission * item.grossProfit / positiveGross;
      allocated += commission;
    }
    return {
      ...item,
      commission,
      netProfit: item.grossProfit - commission,
      marketGrossProfit: totalGross,
      marketCommission,
    };
  });
}

export function settleMarketOrders(orders, marketResult, now = new Date().toISOString()) {
  if (!['CLOSED', 'SETTLED'].includes(marketResult.status) || marketResult.inPlay) {
    return orders.map(order => ({
      ...order,
      settlementStatus: 'awaiting_result',
      settlementError: null,
      settledAt: null,
    }));
  }

  if (marketResult.voided) {
    const voidReason = marketResult.voidReason || 'market_voided_by_betfair';
    return orders.map(order => ({
      ...order,
      status: 'voided',
      settlementStatus: 'voided',
      result: 'void',
      voided: true,
      voidReason,
      grossProfit: 0,
      commission: 0,
      netProfit: 0,
      netPL: 0,
      settledAt: now,
      settled_date: now,
      settlementError: null,
      resultSource: 'BETFAIR_MARKET_BOOK',
      marketStatusAtSettlement: marketResult.status,
    }));
  }

  const winners = marketResult.winnerSelectionIds || [];
  if (!winners.length) {
    return orders.map(order => ({
      ...order,
      settlementStatus: 'awaiting_result',
      settlementError: 'CLOSED_MARKET_WITHOUT_WINNER',
      settledAt: null,
    }));
  }

  const rate = assertUniformMarketCommission(orders);
  const calculations = orders.map(order => ({
    order,
    ...calculateOrderGross(order, winners, marketResult),
  }));
  const allocated = allocateMarketCommission(calculations, rate);

  return allocated.map(item => ({
    ...item.order,
    status: item.voided ? 'voided' : 'settled',
    settlementStatus: item.voided ? 'voided' : 'settled',
    result: item.voided ? 'void' : item.betWon ? 'won' : 'lost',
    voided: item.voided === true,
    voidReason: item.voided ? (item.voidReason || 'runner_removed') : null,
    grossProfit: item.grossProfit,
    commission: item.commission,
    netProfit: item.netProfit,
    netPL: item.netProfit,
    settledAt: now,
    settled_date: now,
    settlementError: null,
    resultSource: 'BETFAIR_MARKET_BOOK',
    marketStatusAtSettlement: marketResult.status,
    resultConfidence: 1,
    winnerSelectionId: normalizeSelectionId(winners[0]),
    winnerSelectionIds: winners.map(normalizeSelectionId),
    settlementKey: `${normalizeMarketId(item.order.betfairMarketId)}:${item.order.customerRef}`,
  }));
}
