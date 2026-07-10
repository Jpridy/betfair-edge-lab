// ============================================================================
// Shared Market Eligibility
//
// Single source of truth for whether a market is eligible for scanning
// and trading. Used by both the exchange opportunity engine and the
// scan diagnostics to prevent time-window/funnel mismatches.
// ============================================================================

import { matchRunnerToMarket } from './marketIdMatcher';

/**
 * Check if a market is eligible for scanning/trading.
 *
 * @param {object} market - Market entity
 * @param {Array} marketRunners - Runners belonging to this market
 * @param {object} settings - App settings
 * @param {object} opts - { debugScanMode, allowInPlayOverride }
 * @returns {{ eligible: boolean, reason: string|null, secondsToJump: number|null }}
 */
export function checkMarketEligibility(market, marketRunners, settings, opts = {}) {
  if (!market) return { eligible: false, reason: 'Market is null', secondsToJump: null };

  if (market.status !== 'OPEN') {
    return { eligible: false, reason: `Market is ${market.status}`, secondsToJump: null };
  }

  if (market.inPlay && !opts.allowInPlayOverride && !settings.allowInPlay) {
    return { eligible: false, reason: 'Market is in-play', secondsToJump: null };
  }

  const runnerCount = Math.max(
    market.numberOfRunners || 0,
    market.numberOfActiveRunners || 0,
    (marketRunners || []).length
  );
  if (runnerCount < 2) {
    return { eligible: false, reason: 'Fewer than 2 runners', secondsToJump: null };
  }

  const start = market.startTime
    ? new Date(market.startTime).getTime()
    : (market.marketStartTime ? new Date(market.marketStartTime).getTime() : NaN);

  if (isNaN(start)) {
    // No start time — allow it (can't determine time window)
    return { eligible: true, reason: null, secondsToJump: null };
  }

  const nowMs = Date.now();
  const secondsToJump = Math.round((start - nowMs) / 1000);

  if (opts.debugScanMode) {
    return { eligible: true, reason: null, secondsToJump };
  }

  const windowStart = settings.defaultTimeWindowStartSeconds || 500;
  const windowEnd = settings.defaultTimeWindowEndSeconds || 30;

  if (secondsToJump <= windowEnd) {
    return { eligible: false, reason: `Too late — ${secondsToJump}s to jump (window closes at ${windowEnd}s)`, secondsToJump };
  }
  if (secondsToJump > windowStart) {
    return { eligible: false, reason: `Too early — ${secondsToJump}s to jump (window opens at ${windowStart}s)`, secondsToJump };
  }

  return { eligible: true, reason: null, secondsToJump };
}

/**
 * Filter all markets to eligible ones, using the shared eligibility logic.
 */
export function filterEligibleMarkets(markets, runners, settings, opts = {}) {
  const results = [];
  for (const market of markets) {
    const marketRunners = runners.filter(r => matchRunnerToMarket(r, market) && r.status === 'ACTIVE');
    const check = checkMarketEligibility(market, marketRunners, settings, opts);
    if (check.eligible) {
      results.push({ market, secondsToJump: check.secondsToJump, marketRunners });
    }
  }
  return results;
}