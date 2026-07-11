export const ACTIVE_ORDER_STATUSES = Object.freeze(['pending', 'executable', 'unmatched', 'partially_matched', 'matched', 'awaiting_result']);

const clean = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const roundedStart = value => { const ms = new Date(value || 0).getTime(); return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 300000) : 0; };

export function normalizedMarketId(value) {
  return String(value?.normalizedMarketId || value?.betfairMarketId || value?.marketId || value?.id || '').trim();
}

export function raceKeyOf(value) {
  const eventId = String(value?.eventId || value?.betfairEventId || '').trim();
  if (eventId) return eventId;
  const venue = clean(value?.venue || value?.eventName);
  const race = Number(value?.raceNumber || 0);
  const start = roundedStart(value?.raceStartTime || value?.marketStartTime || value?.startTime);
  return `race:${venue}:${race}:${start}`;
}

export function activeRaceOrders(orders, raceLike) {
  const key = raceKeyOf(raceLike);
  return (orders || []).filter(order => ACTIVE_ORDER_STATUSES.includes(order.settlementStatus) || ACTIVE_ORDER_STATUSES.includes(order.status)).filter(order => raceKeyOf(order) === key);
}

export function exposureBlock(orders, market, settings = {}) {
  const active = activeRaceOrders(orders, market);
  if (!active.length) return null;
  if (settings.portfolioModeEnabled === true) return 'PORTFOLIO_PROOF_REQUIRED';
  return active.some(order => normalizedMarketId(order) === normalizedMarketId(market)) ? 'DUPLICATE_MARKET_EXPOSURE' : 'DUPLICATE_RACE_EXPOSURE';
}