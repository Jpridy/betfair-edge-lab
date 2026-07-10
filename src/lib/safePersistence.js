// ============================================================================
// Safe Entity Persistence Helper
//
// Replaces silent .catch(() => {}) patterns with a helper that:
//   - Returns a structured result { attempted, succeeded, record, error, latencyMs }
//   - Allows optimistic local state updates
//   - Enables the UI to distinguish saved / local-only / save-failed
//   - Adds idempotency keys to prevent duplicate writes
//   - Retries safe idempotent operations once
// ============================================================================

/**
 * Safely write an entity to the database.
 *
 * @param {object} params
 * @param {string} params.entityName - Entity name (e.g. 'PaperOrder')
 * @param {'create'|'update'|'delete'|'deleteMany'} params.operation
 * @param {object|string} params.payload - Data to write (create/update) or ID (delete)
 * @param {object} params.query - Query filter (deleteMany)
 * @param {string} params.idempotencyKey - Unique key to prevent duplicate writes
 * @param {number} params.retries - Number of retry attempts (default 1, only for idempotent ops)
 * @param {object} params.entityApi - The base44.entities.X object (injected for testability)
 * @returns {Promise<{attempted: boolean, succeeded: boolean, record: object|null, error: string|null, latencyMs: number}>}
 */
export async function safeEntityWrite({
  entityName,
  operation = 'create',
  payload = null,
  query = null,
  idempotencyKey = null,
  retries = 1,
  entityApi = null,
}) {
  if (!entityApi) {
    return { attempted: false, succeeded: false, record: null, error: 'No entity API provided', latencyMs: 0 };
  }

  // ── Idempotency: skip if this key was already written ──
  if (idempotencyKey) {
    if (SAFE_WRITE_CACHE.has(idempotencyKey)) {
      return { ...SAFE_WRITE_CACHE.get(idempotencyKey), cached: true };
    }
  }

  const startedAt = Date.now();
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      let result = null;

      if (operation === 'create') {
        // Add idempotency key to payload so server can deduplicate
        const writePayload = idempotencyKey
          ? { ...payload, _idempotencyKey: idempotencyKey }
          : payload;
        result = await entityApi.create(writePayload);
      } else if (operation === 'update') {
        result = await entityApi.update(payload.id, payload);
      } else if (operation === 'delete') {
        result = await entityApi.delete(payload);
      } else if (operation === 'deleteMany') {
        result = await entityApi.deleteMany(query || {});
      } else {
        return {
          attempted: false,
          succeeded: false,
          record: null,
          error: `Unknown operation: ${operation}`,
          latencyMs: Date.now() - startedAt,
        };
      }

      const response = {
        attempted: true,
        succeeded: true,
        record: result,
        error: null,
        latencyMs: Date.now() - startedAt,
      };

      if (idempotencyKey) {
        SAFE_WRITE_CACHE.set(idempotencyKey, response);
      }

      return response;
    } catch (err) {
      lastError = err.message || String(err);
      attempt++;

      // Only retry for idempotent operations (create with idempotency key, delete)
      const canRetry = idempotencyKey || operation === 'delete' || operation === 'deleteMany';
      if (!canRetry || attempt > retries) break;

      // Brief backoff before retry
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  const failResponse = {
    attempted: true,
    succeeded: false,
    record: null,
    error: lastError,
    latencyMs: Date.now() - startedAt,
  };

  if (idempotencyKey) {
    SAFE_WRITE_CACHE.set(idempotencyKey, failResponse);
  }

  return failResponse;
}

// ── In-memory cache for idempotency keys (prevents duplicate writes) ──
const SAFE_WRITE_CACHE = new Map();

/**
 * Clear the idempotency cache (for testing or reset).
 */
export function clearSafeWriteCache() {
  SAFE_WRITE_CACHE.clear();
}

/**
 * Generate an idempotency key for a cycle/signal/order.
 */
export function generateIdempotencyKey(type, ...parts) {
  return `${type}_${parts.map(p => String(p || '')).join('_')}`;
}