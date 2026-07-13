const RESOLVED_RESULTS = new Set(['won', 'lost', 'void', 'voided']);
const CANONICAL_SETTLED_STATUSES = new Set(['settled', 'voided']);

const finiteNumber = value => value != null && Number.isFinite(Number(value));

export function normalizedOrderResult(order) {
  const result = String(order?.result || '').toLowerCase();
  return result === 'voided' ? 'void' : result;
}

export function settlementTimestamp(order) {
  return order?.settledAt || order?.settled_date || null;
}

export function settlementMoney(order) {
  return {
    grossProfit: finiteNumber(order?.grossProfit) ? Number(order.grossProfit) : null,
    commission: finiteNumber(order?.commission) ? Number(order.commission) : null,
    netProfit: finiteNumber(order?.netProfit)
      ? Number(order.netProfit)
      : finiteNumber(order?.netPL)
        ? Number(order.netPL)
        : null,
  };
}

export function hasCompleteSettlementMoney(order) {
  const money = settlementMoney(order);
  return money.grossProfit != null && money.commission != null && money.netProfit != null;
}

export function hasEconomicSettlement(order) {
  const result = normalizedOrderResult(order);
  const timestamp = settlementTimestamp(order);
  return RESOLVED_RESULTS.has(result) && Boolean(timestamp) && hasCompleteSettlementMoney(order);
}

export function isCanonicalSettledOrder(order) {
  const result = normalizedOrderResult(order);
  const status = String(order?.status || '').toLowerCase();
  const settlementStatus = String(order?.settlementStatus || '').toLowerCase();
  return RESOLVED_RESULTS.has(result)
    && CANONICAL_SETTLED_STATUSES.has(status)
    && CANONICAL_SETTLED_STATUSES.has(settlementStatus)
    && hasCompleteSettlementMoney(order);
}

export function hasSettlementStateMismatch(order) {
  return hasEconomicSettlement(order) && !isCanonicalSettledOrder(order);
}

export function isPerformanceExcluded(order) {
  return order?.proofMode === true
    || order?.excludeFromPerformance === true
    || order?.invalidTestRecord === true;
}

export function orderNetResult(order) {
  return settlementMoney(order).netProfit;
}
