import { normalizeCommissionValue } from './commission';

export function normalizeCommissionStrict(value) {
  const result = normalizeCommissionValue(value);
  return { valid:result.valid, rate:result.normalizedRate, raw:result.rawRate, normalized:result.normalizationApplied, error:result.error };
}