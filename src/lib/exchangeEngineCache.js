// ============================================================================
// Exchange Engine AI Cache
//
// Prevents redundant AI calls for the same event within a configurable TTL.
// Cache key: eventId + marketStartTime + runner selection IDs + scratchings.
//
// The AI is only re-called when meaningful race data changes:
// - Different event ID
// - Different start time
// - Different runner list (scratchings/withdrawals)
// - Cache entry expired
// ============================================================================

const DEFAULT_TTL_MS = 120_000; // 2 minutes — avoids calling every 30s cycle
const MAX_ENTRIES = 50;

const _cache = new Map();

/**
 * Build a cache key from event identity + runner composition.
 * Changes if eventId, startTime, or runner list changes.
 */
function buildCacheKey(cluster, marketRunners) {
  const eventId = cluster?.eventId || '';
  const startTime = cluster?.startTime || '';
  const selectionIds = (marketRunners || [])
    .map(r => String(r.betfairSelectionId || r.selectionId || ''))
    .filter(Boolean)
    .sort()
    .join(',');
  return `${eventId}|${startTime}|${selectionIds}`;
}

/**
 * Get a cached AI result if still valid.
 * @returns {object|null} cached result or null
 */
export function getCachedAIResult(cluster, marketRunners) {
  const key = buildCacheKey(cluster, marketRunners);
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
 * Store an AI result in the cache.
 */
export function setCachedAIResult(cluster, marketRunners, result, ttlMs = DEFAULT_TTL_MS) {
  const key = buildCacheKey(cluster, marketRunners);
  // Evict oldest if at capacity
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
 * Invalidate cache for a specific event (e.g. after scratchings).
 */
export function invalidateEvent(eventId) {
  for (const [key] of _cache) {
    if (key.startsWith(eventId + '|')) {
      _cache.delete(key);
    }
  }
}

/**
 * Clear the entire cache.
 */
export function clearAICache() {
  _cache.clear();
}

/**
 * Get cache stats for diagnostics.
 */
export function getCacheStats() {
  return {
    entries: _cache.size,
    keys: Array.from(_cache.keys()),
  };
}