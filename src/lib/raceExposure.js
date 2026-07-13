import { canonicalRaceIdentity } from './raceIdentity';
import { hasEconomicSettlement } from './orderState';

export const ACTIVE_ORDER_STATUSES = Object.freeze([
  'pending',
  'executable',
  'unmatched',
  'partially_matched',
  'matched',
  'awaiting_result',
  'result_unknown',
]);

export const TERMINAL_ORDER_STATUSES = Object.freeze([
  'settled',
  'voided',
  'lapsed',
  'cancelled',
  'rejected',
]);

export function normalizedMarketId(value) {
  return String(value?.normalizedMarketId || value?.betfairMarketId || value?.marketId || value?.id || '').trim();
}

export function raceNumberOf(value) {
  return canonicalRaceIdentity(value).raceNumber;
}

export function raceKeyOf(value) {
  return value?.canonicalRaceKey || canonicalRaceIdentity(value).canonicalRaceKey;
}

export function isActiveOrder(order) {
  if (!order || hasEconomicSettlement(order)) return false;
  const status = String(order.status || '').toLowerCase();
  const settlementStatus = String(order.settlementStatus || '').toLowerCase();
  if (TERMINAL_ORDER_STATUSES.includes(status) || TERMINAL_ORDER_STATUSES.includes(settlementStatus)) return false;
  return ACTIVE_ORDER_STATUSES.includes(status) || ACTIVE_ORDER_STATUSES.includes(settlementStatus);
}

export function activeRaceOrders(orders, raceLike) {
  const key = raceKeyOf(raceLike);
  return (orders || []).filter(isActiveOrder).filter(order => raceKeyOf(order) === key);
}

export function exposureBlock(orders, market, settings = {}) {
  const active = activeRaceOrders(orders, market);
  if (!active.length) return null;
  if (settings.portfolioModeEnabled === true) return 'PORTFOLIO_PROOF_REQUIRED';
  return 'DUPLICATE_RACE_EXPOSURE';
}
