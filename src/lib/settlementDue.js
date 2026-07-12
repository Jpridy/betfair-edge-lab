export const DEFAULT_SETTLEMENT_GRACE_SECONDS = 90;

export function settlementDueStatus(order, now = Date.now(), graceSeconds = DEFAULT_SETTLEMENT_GRACE_SECONDS) {
  const start = new Date(order?.raceStartTime || order?.marketStartTime || 0).getTime();
  if (!Number.isFinite(start) || start <= 0) return { due:false, settlementCheckStatus:'START_TIME_MISSING' };
  const dueAt = start + Math.max(0, Number(graceSeconds) || DEFAULT_SETTLEMENT_GRACE_SECONDS) * 1000;
  if (now < dueAt) return { due:false, settlementCheckStatus:'NOT_DUE', dueAt:new Date(dueAt).toISOString() };
  const retryAt = new Date(order?.nextSettlementRetryAt || 0).getTime();
  if (Number.isFinite(retryAt) && retryAt > now) return { due:false, settlementCheckStatus:'RETRY_BACKOFF', dueAt:new Date(retryAt).toISOString() };
  return { due:true, settlementCheckStatus:'DUE', dueAt:new Date(dueAt).toISOString() };
}

export function nextSettlementRetryAt(attempts = 0, now = Date.now()) {
  const delaySeconds = Math.min(1800, 60 * (2 ** Math.max(0, Number(attempts) || 0)));
  return new Date(now + delaySeconds * 1000).toISOString();
}