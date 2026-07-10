export function getPriceFreshness(updatedAt, now = Date.now(), staleAfterSeconds = 30) {
  if (!updatedAt) return { priceDataAgeSeconds: null, priceFreshnessStatus: 'missing' };
  const age = Math.max(0, Math.round((now - new Date(updatedAt).getTime()) / 1000));
  return { priceDataAgeSeconds: age, priceFreshnessStatus: age <= staleAfterSeconds ? 'fresh' : 'stale' };
}

export function summarizeRaceFreshness(markets = [], now = Date.now()) {
  const values = markets.map(m => getPriceFreshness(m.lastUpdateAt || m.lastPriceUpdateAt, now));
  if (!values.length || values.every(v => v.priceFreshnessStatus === 'missing')) return 'missing';
  return values.some(v => v.priceFreshnessStatus === 'fresh') ? 'fresh' : 'stale';
}