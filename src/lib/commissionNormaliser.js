import { normalizeCommissionValue } from './commission';

export function normaliseCommissionRate(value) {
  return normalizeCommissionValue(value).normalizedRate;
}

export function formatCommissionRate(value) {
  const rate = normaliseCommissionRate(value);
  return rate == null ? '—' : `${(rate * 100).toFixed(1)}%`;
}