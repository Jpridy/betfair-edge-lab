export function normalizeCommissionStrict(value) {
  if (value == null || value === '') return { valid: false, rate: null, raw: value, normalized: false, error: 'COMMISSION_RATE_MISSING' };
  const raw = typeof value === 'string' ? Number(value.trim().replace(/%$/, '')) : Number(value);
  if (!Number.isFinite(raw)) return { valid: false, rate: null, raw: value, normalized: false, error: 'COMMISSION_RATE_NOT_FINITE' };
  if (raw < 0) return { valid: false, rate: null, raw, normalized: false, error: 'COMMISSION_RATE_NEGATIVE' };
  const rate = raw > 1 ? raw / 100 : raw;
  if (rate > 0.2) return { valid: false, rate: null, raw, normalized: raw > 1, error: 'COMMISSION_RATE_ABOVE_MAXIMUM' };
  return { valid: true, rate, raw, normalized: raw > 1, error: null };
}