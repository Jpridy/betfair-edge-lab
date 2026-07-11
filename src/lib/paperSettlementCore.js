export const normalizeMarketId = value => String(value ?? '').trim();
export const normalizeSelectionId = value => String(value ?? '').trim();

import { normalizeCommissionStrict } from './strictCommission';
import { calculateMarketCommission } from './commission';

export function normalizeCommissionRate(value) {
  const normalized = normalizeCommissionStrict(value);
  return normalized.valid ? normalized.rate : null;
}

export function calculateOrderGross(order, winnerSelectionIds) {
  const selection = normalizeSelectionId(order.normalizedSelectionId || order.selectionId);
  const winners = winnerSelectionIds.map(normalizeSelectionId);
  const selectedWon = winners.includes(selection);
  const stake = Number(order.matchedStake ?? order.matched_size) || 0;
  const odds = Number(order.matchedOdds ?? order.matched_price) || 0;
  const liability = Number(order.liability) || stake * Math.max(0, odds - 1);
  if (order.side === 'LAY') return { selectedWon, betWon: !selectedWon, grossProfit: selectedWon ? -liability : stake, liability };
  return { selectedWon, betWon: selectedWon, grossProfit: selectedWon ? stake * (odds - 1) : -stake, liability: stake };
}

export function allocateMarketCommission(calculations, rate) {
  const totalGross = calculations.reduce((sum, item) => sum + item.grossProfit, 0);
  const normalizedRate = normalizeCommissionRate(rate);
  if (normalizedRate == null) throw new Error('INVALID_COMMISSION');
  const commissionResult = calculateMarketCommission(totalGross, normalizedRate);
  if (!commissionResult.valid) throw new Error(commissionResult.error);
  const marketCommission = commissionResult.commission;
  const positiveIndexes = calculations.map((item, index) => item.grossProfit > 0 ? index : -1).filter(index => index >= 0);
  const positiveGross = positiveIndexes.reduce((sum, index) => sum + calculations[index].grossProfit, 0);
  let allocated = 0;
  return calculations.map((item, index) => {
    let commission = 0;
    if (marketCommission > 0 && item.grossProfit > 0) {
      commission = index === positiveIndexes.at(-1) ? marketCommission - allocated : marketCommission * item.grossProfit / positiveGross;
      allocated += commission;
    }
    return { ...item, commission, netProfit: item.grossProfit - commission, marketGrossProfit: totalGross, marketCommission };
  });
}

export function settleMarketOrders(orders, marketResult, now = new Date().toISOString()) {
  if (!['CLOSED', 'SETTLED'].includes(marketResult.status) || marketResult.inPlay) {
    return orders.map(order => ({ ...order, settlementStatus: 'awaiting_result', settledAt: null }));
  }
  if (marketResult.voided) return orders.map(order => ({ ...order, status: 'voided', settlementStatus: 'voided', result: 'void', grossProfit: 0, commission: 0, netProfit: 0, netPL: 0, settledAt: now }));
  const winners = marketResult.winnerSelectionIds || [];
  if (!winners.length) return orders.map(order => ({ ...order, settlementStatus: 'awaiting_result', settlementError: 'CLOSED_MARKET_WITHOUT_WINNER', settledAt: null }));
  const calculations = orders.map(order => ({ order, ...calculateOrderGross(order, winners) }));
  const allocated = allocateMarketCommission(calculations, orders[0]?.normalizedCommissionRate ?? 0.05);
  return allocated.map(item => ({ ...item.order, status: 'settled', settlementStatus: 'settled', result: item.betWon ? 'won' : 'lost', grossProfit: item.grossProfit, commission: item.commission, netProfit: item.netProfit, netPL: item.netProfit, settledAt: now, resultSource: 'BETFAIR_MARKET_BOOK', resultConfidence: 1, winnerSelectionId: normalizeSelectionId(winners[0]), settlementKey: `${normalizeMarketId(item.order.betfairMarketId)}:${item.order.customerRef}` }));
}