import { canonicalRaceIdentity } from './raceIdentity';
import { normalizedMarketId } from './raceExposure';

export const ACTIVE_EXPOSURE_STATUSES = Object.freeze(['pending','executable','unmatched','partially_matched','matched','awaiting_result','result_unknown']);
export const TERMINAL_ORDER_STATUSES = Object.freeze(['settled','voided','lapsed','cancelled','rejected']);

export function isActiveExposureOrder(order) {
  if (TERMINAL_ORDER_STATUSES.includes(order?.status) || TERMINAL_ORDER_STATUSES.includes(order?.settlementStatus)) return false;
  return ACTIVE_EXPOSURE_STATUSES.includes(order?.status) || ACTIVE_EXPOSURE_STATUSES.includes(order?.settlementStatus);
}

export function orderExposure(order) {
  const side=String(order?.side || '').toUpperCase();
  const stake=Number(order?.matchedStake ?? order?.matched_size ?? order?.requestedStake ?? order?.requested_size) || 0;
  const odds=Number(order?.matchedOdds ?? order?.matched_price ?? order?.requestedOdds ?? order?.requested_price) || 0;
  if (side === 'LAY') return { backExposure:0, layLiability:Number(order?.liability) > 0 ? Number(order.liability) : stake*Math.max(0,odds-1) };
  return { backExposure:stake, layLiability:0 };
}

export function reconcileRiskExposure(orders = []) {
  const active=orders.filter(isActiveExposureOrder);
  const exposureByRace={}, exposureByMarket={};
  let totalBackExposure=0,totalLayLiability=0,unresolvedMatchedOrderCount=0;
  for (const order of active) {
    const exposure=orderExposure(order); totalBackExposure+=exposure.backExposure; totalLayLiability+=exposure.layLiability;
    if (Number(order.matchedStake ?? order.matched_size) > 0 || ['matched','awaiting_result','result_unknown'].includes(order.status)) unresolvedMatchedOrderCount++;
    const raceKey=order.canonicalRaceKey || canonicalRaceIdentity(order).canonicalRaceKey;
    const marketId=normalizedMarketId(order) || 'unknown';
    exposureByRace[raceKey]=(exposureByRace[raceKey] || 0)+exposure.backExposure+exposure.layLiability;
    exposureByMarket[marketId]=(exposureByMarket[marketId] || 0)+exposure.backExposure+exposure.layLiability;
  }
  return { activeOrderCount:active.length, unresolvedMatchedOrderCount, totalBackExposure, totalLayLiability, totalExposure:totalBackExposure+totalLayLiability, exposureByRace, exposureByMarket, orders:active };
}