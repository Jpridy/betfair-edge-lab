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

function eventIdOf(value) {
  const identity = canonicalRaceIdentity(value);
  return String(identity.eventId || identity.betfairEventId || value?.eventId || value?.betfairEventId || '').trim();
}

function hasCompleteRaceIdentity(value) {
  const identity = canonicalRaceIdentity(value);
  return Boolean(identity.eventId && Number(identity.raceNumber) > 0 && identity.startTime);
}

export function sameRace(left, right) {
  if (!left || !right) return false;
  const leftMarket = normalizedMarketId(left);
  const rightMarket = normalizedMarketId(right);
  if (leftMarket && rightMarket && leftMarket === rightMarket) return true;

  const leftKey = raceKeyOf(left);
  const rightKey = raceKeyOf(right);
  if (leftKey && rightKey && leftKey === rightKey) return true;

  const leftEvent = eventIdOf(left);
  const rightEvent = eventIdOf(right);
  if (!leftEvent || leftEvent !== rightEvent) return false;

  const leftRaceNumber = raceNumberOf(left);
  const rightRaceNumber = raceNumberOf(right);
  if (leftRaceNumber > 0 && rightRaceNumber > 0) return leftRaceNumber === rightRaceNumber;

  // Legacy orders can lack race number/start time. Locking the whole meeting is
  // conservative but safer than allowing a duplicate exposure to slip through.
  return !hasCompleteRaceIdentity(left) || !hasCompleteRaceIdentity(right);
}

export function activeRaceOrders(orders, raceLike) {
  return (orders || []).filter(isActiveOrder).filter(order => sameRace(order, raceLike));
}

export function exposureBlock(orders, market, settings = {}) {
  const active = activeRaceOrders(orders, market);
  if (!active.length) return null;
  if (settings.portfolioModeEnabled === true) return 'PORTFOLIO_PROOF_REQUIRED';
  const targetMarketId = normalizedMarketId(market);
  const sameMarketExposure = active.some(order => normalizedMarketId(order) === targetMarketId);
  return sameMarketExposure ? 'DUPLICATE_MARKET_EXPOSURE' : 'DUPLICATE_RACE_EXPOSURE';
}
