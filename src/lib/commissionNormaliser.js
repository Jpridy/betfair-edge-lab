// ============================================================================
// Commission Normalisation Helper
//
// Accepts both decimal (0.05) and percentage (5) forms and always returns
// the decimal rate (0.05). Used at ingestion and persistence to ensure
// one consistent convention across the entire application.
// ============================================================================

/**
 * Normalise a commission rate to decimal form.
 *
 *   0.05  → 0.05   (already decimal)
 *   5     → 0.05   (percentage → decimal)
 *   8     → 0.08
 *   10    → 0.10
 *   0     → 0      (no commission)
 *   null  → null    (missing — caller decides fallback)
 *   "5%"  → 0.05   (string with %)
 *   "0.05"→ 0.05   (string decimal)
 *
 * @param {number|string|null|undefined} value
 * @returns {number|null} decimal rate (0–1) or null if input is null/undefined
 */
export function normaliseCommissionRate(value) {
  if (value == null) return null;

  // Strip string formatting
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/%$/, '');
    const parsed = parseFloat(trimmed);
    if (!isFinite(parsed)) return null;
    value = parsed;
  }

  if (typeof value !== 'number' || !isFinite(value) || value < 0) return null;
  const normalized = value > 1 ? value / 100 : value;
  return normalized <= 0.2 ? normalized : null;
}

/**
 * Format a commission rate for display.
 * @param {number} rate - decimal rate (0.05)
 * @returns {string} "5.0%"
 */
export function formatCommissionRate(rate) {
  const normalised = normaliseCommissionRate(rate);
  if (normalised == null) return '—';
  return `${(normalised * 100).toFixed(1)}%`;
}