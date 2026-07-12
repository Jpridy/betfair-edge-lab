import { canonicalRaceIdentity } from './raceIdentity';

export const ACTIVE_ORDER_STATUSES = Object.freeze(['pending','executable','unmatched','partially_matched','matched','awaiting_result','result_unknown']);
export const TERMINAL_ORDER_STATUSES = Object.freeze(['settled','voided','lapsed','cancelled','rejected']);

export function normalizedMarketId(value) {
  return String(value?.normalizedMarketId || value?.betfairMarketId || value?.marketId || value?.id || '').trim();
}

export function raceNumberOf(value) { return canonicalRaceIdentity(value).raceNumber; }
export function raceKeyOf(value) { return value?.canonicalRaceKey || canonicalRaceIdentity(value).canonicalRaceKey; }

export function isActiveOrder(order) {
  if (TERMINAL_ORDER_STATUSES.includes(order?.status) || TERMINAL_ORDER_STATUSES.includes(order?.settlementStatus)) return false;
  return ACTIVE_ORDER_STATUSES.includes(order?.status) || ACTIVE_ORDER_STATUSES.includes(order?.settlementStatus);
}

export function activeRaceOrders(orders, raceLike) {
  const key=raceKeyOf(raceLike);
  return (orders || []).filter(isActiveOrder).filter(order => raceKeyOf(order) === key);
}

export function exposureBlock(orders, market, settings = {}) {
  const active=activeRaceOrders(orders,market);
  if (!active.length) return null;
  if (settings.portfolioModeEnabled === true) return 'PORTFOLIO_PROOF_REQUIRED';
  return 'DUPLICATE_RACE_EXPOSURE';
}