export function calculatePriceFeedStatus(lastPriceUpdateAt, now = Date.now(), staleThresholdSeconds = 30, hasError = false) {
  if (hasError) return { priceFeedStatus: 'ERROR', priceAgeSeconds: null, staleThresholdSeconds, authoritativePriceTimestamp: lastPriceUpdateAt || null, priceFeedStale: true };
  if (!lastPriceUpdateAt || Number.isNaN(new Date(lastPriceUpdateAt).getTime())) return { priceFeedStatus: 'UNAVAILABLE', priceAgeSeconds: null, staleThresholdSeconds, authoritativePriceTimestamp: null, priceFeedStale: true };
  const priceAgeSeconds = Math.max(0, Math.round((now - new Date(lastPriceUpdateAt).getTime()) / 1000));
  const priceFeedStatus = priceAgeSeconds <= staleThresholdSeconds ? 'LIVE' : 'STALE';
  return { priceFeedStatus, priceAgeSeconds, staleThresholdSeconds, authoritativePriceTimestamp: lastPriceUpdateAt, priceFeedStale: priceFeedStatus !== 'LIVE' };
}

export function getPriceFreshness(updatedAt, now = Date.now(), staleAfterSeconds = 30) {
  const result = calculatePriceFeedStatus(updatedAt, now, staleAfterSeconds);
  return { priceDataAgeSeconds: result.priceAgeSeconds, priceFreshnessStatus: result.priceFeedStatus === 'LIVE' ? 'fresh' : result.priceFeedStatus === 'STALE' ? 'stale' : 'missing' };
}

export function summarizeRaceFreshness(markets = [], now = Date.now()) {
  const values = markets.map(m => getPriceFreshness(m.lastUpdateAt || m.lastPriceUpdateAt, now));
  if (!values.length || values.every(v => v.priceFreshnessStatus === 'missing')) return 'missing';
  return values.some(v => v.priceFreshnessStatus === 'fresh') ? 'fresh' : 'stale';
}