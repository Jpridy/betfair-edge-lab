export function normalizeCommissionValue(value) {
  if (value == null || value === '') return { valid:false, rawRate:value, normalizedRate:null, normalizationApplied:false, error:'COMMISSION_RATE_MISSING' };
  const rawRate = typeof value === 'string' ? Number(value.trim().replace(/%$/, '')) : Number(value);
  if (!Number.isFinite(rawRate)) return { valid:false, rawRate:value, normalizedRate:null, normalizationApplied:false, error:'COMMISSION_RATE_NOT_FINITE' };
  if (rawRate < 0) return { valid:false, rawRate, normalizedRate:null, normalizationApplied:false, error:'COMMISSION_RATE_NEGATIVE' };
  const normalizationApplied = rawRate > 1;
  const normalizedRate = normalizationApplied ? rawRate / 100 : rawRate;
  if (normalizedRate > .2) return { valid:false, rawRate, normalizedRate:null, normalizationApplied, error:'COMMISSION_RATE_ABOVE_MAXIMUM' };
  return { valid:true, rawRate, normalizedRate, normalizationApplied, error:null };
}

export const COMMISSION_SOURCES = Object.freeze({
  MANUAL_OVERRIDE: 'manual_override',
  MARKET_BASE_RATE: 'market_base_rate',
  DEFAULT_FALLBACK: 'default_fallback',
  MISSING: 'missing',
});

export function resolveCommissionRate(market = {}, settings = {}) {
  let rawRate = null;
  let source = COMMISSION_SOURCES.MISSING;
  if (settings.manualCommissionRate != null) {
    rawRate = settings.manualCommissionRate;
    source = COMMISSION_SOURCES.MANUAL_OVERRIDE;
  } else if (settings.useMarketBaseRate !== false && market.marketBaseRate != null) {
    rawRate = market.marketBaseRate;
    source = COMMISSION_SOURCES.MARKET_BASE_RATE;
  } else if (settings.defaultCommissionRate != null) {
    rawRate = settings.defaultCommissionRate;
    source = COMMISSION_SOURCES.DEFAULT_FALLBACK;
  }
  const checked = normalizeCommissionValue(rawRate);
  return {
    rawRate: checked.rawRate,
    normalizedRate: checked.normalizedRate,
    source,
    normalizationApplied: checked.normalizationApplied,
    validationStatus: checked.valid ? (source === COMMISSION_SOURCES.DEFAULT_FALLBACK ? 'using_default' : 'valid') : 'invalid',
    valid: checked.valid,
    error: checked.error,
  };
}

export function calculateMarketCommission(netMarketProfit, normalizedRate) {
  const checked = normalizeCommissionValue(normalizedRate);
  if (!checked.valid) return { valid: false, commission: null, error: checked.error };
  const profit = Number(netMarketProfit);
  if (!Number.isFinite(profit)) return { valid: false, commission: null, error: 'NET_MARKET_PROFIT_NOT_FINITE' };
  return { valid: true, commission: Math.max(0, profit) * checked.normalizedRate, error: null };
}