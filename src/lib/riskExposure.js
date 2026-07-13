import { canonicalRaceIdentity } from './raceIdentity';
import { normalizedMarketId } from './raceExposure';
import { hasEconomicSettlement } from './orderState';

export const ACTIVE_EXPOSURE_STATUSES = Object.freeze([
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

export function isActiveExposureOrder(order) {
  if (!order || hasEconomicSettlement(order)) return false;
  const status = String(order.status || '').toLowerCase();
  const settlementStatus = String(order.settlementStatus || '').toLowerCase();
  if (TERMINAL_ORDER_STATUSES.includes(status) || TERMINAL_ORDER_STATUSES.includes(settlementStatus)) return false;
  return ACTIVE_EXPOSURE_STATUSES.includes(status) || ACTIVE_EXPOSURE_STATUSES.includes(settlementStatus);
}

const amount = (...values) => {
  for (const value of values) {
    if (Number.isFinite(Number(value)) && Number(value) >= 0) return Number(value);
  }
  return 0;
};

export function orderExposure(order) {
  const side = String(order?.side || '').toUpperCase();
  const odds = amount(order?.matchedCalculation?.odds, order?.matchedOdds, order?.matched_price, order?.requestedOdds, order?.requested_price);
  const matchedStake = amount(order?.matchedCalculation?.stake, order?.matchedStake, order?.matched_size);
  const requestedStake = amount(order?.requestedCalculation?.stake, order?.requestedStake, order?.requested_size, order?.size);
  const explicitRemaining = order?.remainingStake ?? order?.remaining_size;
  const remainingStake = explicitRemaining != null
    ? amount(explicitRemaining)
    : Math.max(0, requestedStake - matchedStake);

  const matchedLiability = amount(
    order?.matchedCalculation?.liability,
    side === 'LAY' ? matchedStake * Math.max(0, odds - 1) : matchedStake,
  );
  const unmatchedLiability = amount(
    order?.remainingUnmatchedCalculation?.liability,
    side === 'LAY' ? remainingStake * Math.max(0, odds - 1) : remainingStake,
  );

  if (side === 'LAY') {
    return {
      backExposure: 0,
      layLiability: matchedLiability + unmatchedLiability,
      matchedExposure: matchedLiability,
      unmatchedReservedExposure: unmatchedLiability,
    };
  }

  return {
    backExposure: matchedStake + remainingStake,
    layLiability: 0,
    matchedExposure: matchedStake,
    unmatchedReservedExposure: remainingStake,
  };
}

export function reconcileRiskExposure(orders = []) {
  const active = (orders || []).filter(isActiveExposureOrder);
  const exposureByRace = {};
  const exposureByMarket = {};
  let totalBackExposure = 0;
  let totalLayLiability = 0;
  let unresolvedMatchedOrderCount = 0;

  for (const order of active) {
    const exposure = orderExposure(order);
    totalBackExposure += exposure.backExposure;
    totalLayLiability += exposure.layLiability;

    const matchedStake = amount(order?.matchedCalculation?.stake, order?.matchedStake, order?.matched_size);
    const status = String(order?.status || '').toLowerCase();
    const settlementStatus = String(order?.settlementStatus || '').toLowerCase();
    if (matchedStake > 0 || ['matched', 'awaiting_result', 'result_unknown'].includes(status) || ['awaiting_result', 'result_unknown'].includes(settlementStatus)) {
      unresolvedMatchedOrderCount += 1;
    }

    const raceKey = order.canonicalRaceKey || canonicalRaceIdentity(order).canonicalRaceKey;
    const marketId = normalizedMarketId(order) || 'unknown';
    const total = exposure.backExposure + exposure.layLiability;
    exposureByRace[raceKey] = (exposureByRace[raceKey] || 0) + total;
    exposureByMarket[marketId] = (exposureByMarket[marketId] || 0) + total;
  }

  const totalExposure = totalBackExposure + totalLayLiability;
  return {
    activeOrderCount: active.length,
    unresolvedMatchedOrderCount,
    totalBackExposure,
    totalLayLiability,
    totalExposure,
    backExposure: totalBackExposure,
    layLiability: totalLayLiability,
    riskExposureReconciliationPassed: Number.isFinite(totalExposure)
      && Math.abs(totalExposure - (totalBackExposure + totalLayLiability)) < 1e-9,
    exposureByRace,
    exposureByMarket,
    orders: active,
  };
}
