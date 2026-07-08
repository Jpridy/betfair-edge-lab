// ============================================================================
// External Search Cache
//
// Caches OpenAI web search results by event identity to avoid calling the
// OpenAI API every 30 seconds for the same race.
//
// Cache key: eventId + eventName + marketStartTime + runner selection IDs
// TTL: configurable (default 5 minutes)
//
// IMPORTANT: Only external research and probability adjustments are cached.
// Final betting decisions are NEVER cached — the exchange engine recalculates
// EV, ROI, spread, liquidity, delay risk, exposure, and safety gates every
// cycle using current Betfair prices.
// ============================================================================

const DEFAULT_TTL_MS = 300_000; // 5 minutes
const MAX_ENTRIES = 30;

const _cache = new Map();

/**
 * Build a cache key from event identity + runner composition.
 */
function buildCacheKey(eventId, eventName, marketStartTime, marketRunners) {
  const selectionIds = (marketRunners || [])
    .map(r => String(r.betfairSelectionId || r.selectionId || ''))
    .filter(Boolean)
    .sort()
    .join(',');
  return `${eventId || eventName}|${marketStartTime || ''}|${selectionIds}`;
}

/**
 * Get a cached external search result if still valid.
 */
export function getCachedExternalSearch(eventId, eventName, marketStartTime, marketRunners) {
  const key = buildCacheKey(eventId, eventName, marketStartTime, marketRunners);
  const entry = _cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    _cache.delete(key);
    return null;
  }
  return entry.result;
}

/**
 * Store an external search result in the cache.
 */
export function setCachedExternalSearch(eventId, eventName, marketStartTime, marketRunners, result, ttlMs = DEFAULT_TTL_MS) {
  const key = buildCacheKey(eventId, eventName, marketStartTime, marketRunners);
  if (_cache.size >= MAX_ENTRIES) {
    const oldestKey = _cache.keys().next().value;
    if (oldestKey) _cache.delete(oldestKey);
  }
  _cache.set(key, {
    result,
    timestamp: Date.now(),
    ttl: ttlMs,
  });
}

/**
 * Invalidate cache for a specific event.
 */
export function invalidateExternalSearchEvent(eventId) {
  for (const [key] of _cache) {
    if (key.startsWith((eventId || '') + '|')) {
      _cache.delete(key);
    }
  }
}

/**
 * Clear the entire external search cache.
 */
export function clearExternalSearchCache() {
  _cache.clear();
}

/**
 * Get cache stats for diagnostics.
 */
export function getExternalSearchCacheStats() {
  return {
    entries: _cache.size,
    keys: Array.from(_cache.keys()),
  };
}