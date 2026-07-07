// ============================================================================
// Betfair Exchange API Field Mapping Layer
//
// This module provides the canonical mapping between Betfair Exchange API
// fields and the app's internal data structures. Every order (paper or live)
// must use the same field structure as a real Betfair Exchange order.
// ============================================================================

import { roundToNearestTick, isValidTickPrice } from './tickLadder';

function parseRaceNumberFromName(marketName, eventName) {
  const text = `${marketName || ''} ${eventName || ''}`;
  const match = text.match(/\bR(\d+)\b/i);
  return match ? parseInt(match[1], 10) : 0;
}

// ─── Betfair Order Structure ───────────────────────────────────────────────
// This is the canonical Betfair Exchange order structure. Both paper and
// live orders must use these fields. Paper orders add paper_mode = true
// and simulated* fields.

export function createBetfairOrderStructure(params) {
  const {
    marketId,
    selectionId,
    handicap = 0,
    side,              // BACK or LAY
    orderType = 'LIMIT',  // LIMIT, LIMIT_ON_CLOSE, MARKET_ON_CLOSE
    size,              // requested stake
    price,             // requested odds (must be on tick ladder)
    persistenceType = 'LAPSE',  // LAPSE, PERSIST, MARKET_ON_CLOSE
    customerRef = null,
    customerStrategyRef = null,
  } = params;

  // Validate and round price to nearest valid tick
  const validatedPrice = isValidTickPrice(price) ? price : roundToNearestTick(price);

  return {
    // ── Betfair API Order Fields ──
    marketId,
    selectionId: String(selectionId),
    handicap,
    side,
    orderType,
    size: Number(size),
    price: validatedPrice,
    persistenceType,
    customerRef: customerRef || generateCustomerRef(),
    customerStrategyRef: customerStrategyRef || 'BEL_STRATEGY',

    // ── Matched/Unmatched Tracking ──
    requested_size: Number(size),
    matched_size: 0,
    remaining_size: Number(size),
    average_price_matched: 0,
    requested_price: validatedPrice,
    matched_price: null,
    placed_date: new Date().toISOString(),
    matched_date: null,
    settled_date: null,
    lapse_reason: null,
    cancel_reason: null,
    rejection_reason: null,

    // ── Order Status (Exchange-style) ──
    status: 'pending',  // pending, execution_complete, executable, matched,
                        // partially_matched, unmatched, cancelled, lapsed,
                        // voided, settled, rejected, error

    // ── Paper Mode Flag ──
    paper_mode: true,

    // ── Simulation Fields (paper only) ──
    simulatedMatchedSize: 0,
    simulatedAveragePrice: 0,
    simulatedStatus: 'pending',
    simulatedSettlement: null,
    simulatedCommission: 0,
    simulatedCLV: 0,
    simulatedSlippage: 0,
  };
}

/**
 * Generate a Betfair-style customer reference.
 */
export function generateCustomerRef() {
  return 'BEL' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// ─── Commission Model ──────────────────────────────────────────────────────

export const COMMISSION_SOURCES = {
  MARKET_BASE_RATE: 'market_base_rate',
  DEFAULT_FALLBACK: 'default_fallback',
  MANUAL_OVERRIDE: 'manual_override',
  MISSING: 'missing',
};

/**
 * Calculate commission for a market.
 * Commission is ONLY on net market winnings (not on losing markets).
 * 
 * @param {number} netMarketWinnings - The net profit from winning bets in a market
 * @param {object} market - The market object with commission fields
 * @param {object} settings - App settings with commission config
 * @returns {object} { commission, rate, source, status, warnings }
 */
export function calculateCommission(netMarketWinnings, market, settings) {
  const warnings = [];

  // No commission on losses or zero winnings
  if (netMarketWinnings <= 0) {
    return { commission: 0, rate: 0, source: 'none', status: 'ok', warnings: [] };
  }

  // Determine commission source and rate
  let rate = null;
  let source = COMMISSION_SOURCES.MISSING;
  let status = 'missing';

  // Priority 1: Manual override if set
  if (settings.manualCommissionRate != null && settings.manualCommissionRate > 0) {
    rate = settings.manualCommissionRate;
    source = COMMISSION_SOURCES.MANUAL_OVERRIDE;
    status = 'ok';
  }
  // Priority 2: Market-specific Market Base Rate
  else if (settings.useMarketBaseRate !== false && market?.marketBaseRate != null && market.marketBaseRate > 0) {
    rate = market.marketBaseRate;
    source = COMMISSION_SOURCES.MARKET_BASE_RATE;
    status = 'ok';
  }
  // Priority 3: Default fallback rate
  else if (settings.defaultCommissionRate != null && settings.defaultCommissionRate > 0) {
    rate = settings.defaultCommissionRate;
    source = COMMISSION_SOURCES.DEFAULT_FALLBACK;
    status = 'using_default';
    warnings.push('Using default commission rate — Market Base Rate not available for this market');
  }
  // No rate available
  else {
    rate = 0;
    source = COMMISSION_SOURCES.MISSING;
    status = 'missing';
    warnings.push('Commission rate missing — cannot calculate accurate commission');
  }

  const commission = netMarketWinnings * rate;

  return { commission, rate, source, status, warnings };
}

/**
 * Get commission warnings for a market.
 */
export function getCommissionWarnings(market, settings) {
  const warnings = [];

  if (settings.useMarketBaseRate !== false && (market?.marketBaseRate == null || market.marketBaseRate <= 0)) {
    if (settings.defaultCommissionRate != null && settings.defaultCommissionRate > 0) {
      warnings.push({
        level: 'warning',
        message: 'Using default commission rate — Market Base Rate not available for this market',
      });
    } else {
      warnings.push({
        level: 'critical',
        message: 'Commission rate missing — Market Base Rate required before live use',
      });
    }
  }

  if (settings.manualCommissionRate != null && settings.manualCommissionRate > 0) {
    warnings.push({
      level: 'info',
      message: `Using manual override commission rate (${(settings.manualCommissionRate * 100).toFixed(1)}%)`,
    });
  }

  return warnings;
}

/**
 * Check if commission calculation is valid for live mode.
 */
export function isCommissionValidForLive(market, settings) {
  const result = calculateCommission(100, market, settings); // Test with dummy winnings
  return result.status !== 'missing';
}

// ─── Market Catalogue → App Market Mapping ─────────────────────────────────

/**
 * Map a Betfair Market Catalogue + Market Book response to app Market format.
 */
export function mapBetfairMarket(catalogue, book) {
  const description = catalogue.description || {};
  const event = catalogue.event || {};

  return {
    // ── Betfair Market Identity ──
    betfairMarketId: catalogue.marketId,
    eventTypeId: event.id ? String(event.id).split('.')[0] : '7',
    eventId: catalogue.event?.id || null,
    competitionId: catalogue.competition?.id || null,
    marketId: catalogue.marketId,  // Keep betfairMarketId as the app's marketId too
    marketName: catalogue.marketName || event.name || catalogue.marketId,
    venue: event.venue || '',
    raceNumber: parseRaceNumberFromName(catalogue.marketName, event.name),
    country: event.countryCode || 'AU',
    timezone: event.timezone || 'Australia/Sydney',
    marketStartTime: catalogue.marketStartTime || description.marketTime || null,

    // ── Market State (from Market Book) ──
    status: book?.status || 'OPEN',
    inPlay: book?.inplay || false,
    totalMatched: book?.totalMatched || 0,
    betDelay: description.bettingDelay || 0,
    bspMarket: description.bspMarket || false,
    turnInPlayEnabled: description.turnInPlayEnabled || false,
    marketBaseRate: description.marketBaseRate || null,
    numberOfWinners: description.numberOfWinners || 1,
    numberOfRunners: (catalogue.runners || []).length,
    numberOfActiveRunners: book?.numberOfActiveRunners || (catalogue.runners || []).filter(r => r.status === 'ACTIVE').length,

    // ── App-specific ──
    eventType: 'Horse Racing',
    eventName: event.name || '',
    marketType: description.marketType || 'WIN',
    startTime: catalogue.marketStartTime || description.marketTime || null,
    watched: false,
    eligibleStrategies: [],
    warningFlags: [],
  };
}

// ─── Runner Metadata + Market Book → App Runner Mapping ────────────────────

/**
 * Map a Betfair Runner (from catalogue) + Runner Book (from market book)
 * to app Runner format with all Betfair-style fields.
 */
export function mapBetfairRunner(runnerMeta, runnerBook) {
  const bestBack = runnerBook?.ex?.availableToBack?.[0];
  const bestLay = runnerBook?.ex?.availableToLay?.[0];
  const bestBackPrice = bestBack?.price || 0;
  const bestLayPrice = bestLay?.price || 0;

  return {
    // ── Betfair Runner Identity ──
    marketId: runnerBook?.marketId || null,
    betfairSelectionId: String(runnerMeta.selectionId),
    selectionId: String(runnerMeta.selectionId),
    runnerName: runnerMeta.runnerName || `Selection ${runnerMeta.selectionId}`,
    horseNumber: runnerMeta.sortPriority || 0,
    handicap: runnerMeta.handicap || 0,
    status: runnerBook?.status || runnerMeta.status || 'ACTIVE',
    adjustmentFactor: runnerMeta.adjustmentFactor || null,

    // ── Price Data ──
    lastPriceTraded: runnerBook?.lastPriceTraded || 0,
    totalMatched: runnerBook?.totalMatched || 0,
    availableToBack: runnerBook?.ex?.availableToBack || [],
    availableToLay: runnerBook?.ex?.availableToLay || [],
    tradedVolume: runnerBook?.tradedVolume || [],

    // ── Derived Fields ──
    bestBackPrice,
    bestBackSize: bestBack?.size || 0,
    bestLayPrice,
    bestLaySize: bestLay?.size || 0,
    lastTradedPrice: runnerBook?.lastPriceTraded || 0,
    tradedVolume: runnerBook?.totalMatched || 0,
    impliedProbability: bestBackPrice > 0 ? (1 / bestBackPrice) * 100 : 0,
    favouriteRank: 0,
    isFavourite: false,
    isOutsider: false,

    // ── Strategy / Model Fields ──
    modelProbability: null,
    edge: null,
    clvEstimate: null,
    strategySignalStatus: 'none',  // none, active, executed, expired, blocked, rejected
    rejectedSignalReason: null,
  };
}

// ─── Order Status Mapping ──────────────────────────────────────────────────

export const ORDER_STATUSES = {
  PENDING: 'pending',
  EXECUTION_COMPLETE: 'execution_complete',
  EXECUTABLE: 'executable',
  MATCHED: 'matched',
  PARTIALLY_MATCHED: 'partially_matched',
  UNMATCHED: 'unmatched',
  CANCELLED: 'cancelled',
  LAPSED: 'lapsed',
  VOIDED: 'voided',
  SETTLED: 'settled',
  REJECTED: 'rejected',
  ERROR: 'error',
};

/**
 * Check if an order status represents a settled/matched state
 * that should count towards performance metrics.
 */
export function isSettledMatched(status) {
  return status === ORDER_STATUSES.SETTLED;
}

/**
 * Check if an order is in an open/active state (still has remaining size).
 */
export function isOrderOpen(status) {
  return [
    ORDER_STATUSES.PENDING,
    ORDER_STATUSES.EXECUTABLE,
    ORDER_STATUSES.MATCHED,
    ORDER_STATUSES.UNMATCHED,
    ORDER_STATUSES.PARTIALLY_MATCHED,
  ].includes(status);
}

/**
 * Check if an order is in a failed/terminal-non-matched state.
 */
export function isOrderFailed(status) {
  return [
    ORDER_STATUSES.CANCELLED,
    ORDER_STATUSES.LAPSED,
    ORDER_STATUSES.VOIDED,
    ORDER_STATUSES.REJECTED,
    ORDER_STATUSES.ERROR,
  ].includes(status);
}

// ─── Persistence Type ──────────────────────────────────────────────────────

export const PERSISTENCE_TYPES = {
  LAPSE: 'LAPSE',
  PERSIST: 'PERSIST',
  MARKET_ON_CLOSE: 'MARKET_ON_CLOSE',
};

/**
 * Get warnings for persistence type selection.
 */
export function getPersistenceWarnings(persistenceType, strategy, settings) {
  const warnings = [];

  if (persistenceType === PERSISTENCE_TYPES.PERSIST) {
    warnings.push({
      level: 'warning',
      message: 'PERSIST may leave unmatched bets active in-play. Use only if intentionally approved.',
    });

    // Pre-off strategy using PERSIST requires admin approval for live
    if (strategy?.timeWindow !== 'In-play only' && settings?.liveTradingEnabled && !settings?.persistApproved) {
      warnings.push({
        level: 'critical',
        message: 'Live mode blocked: pre-off strategy uses PERSIST without admin approval.',
      });
    }
  }

  if (persistenceType === PERSISTENCE_TYPES.MARKET_ON_CLOSE) {
    warnings.push({
      level: 'info',
      message: 'MARKET_ON_CLOSE will match at the starting price. Ensure this is intentionally configured.',
    });
  }

  return warnings;
}

// ─── In-Play Safety ────────────────────────────────────────────────────────

export function checkInPlaySafety(market, strategy, settings) {
  const failures = [];

  // Default: in-play live betting disabled
  if (market?.inPlay) {
    if (!settings?.allowInPlay) {
      failures.push('In-play execution is locked — in-play betting is disabled');
    }
    if (!strategy?.allowInPlay) {
      failures.push('Strategy is pre-off only — cannot create signals on in-play market');
    }
  }

  // Pre-off strategy: stop scanning 30 seconds before start
  if (!strategy?.allowInPlay && market?.startTime) {
    const start = new Date(market.startTime).getTime();
    const now = Date.now();
    const secondsBefore = (start - now) / 1000;

    if (secondsBefore < 30 && secondsBefore > -300) {
      // Within 30 seconds of jump — pre-off strategies must stop
      if (secondsBefore < 0 && !market.inPlay) {
        failures.push('Market is about to jump or has jumped — pre-off scanning stopped');
      }
    }
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Check if in-play execution is locked.
 */
export function isInPlayLocked(settings, strategy) {
  if (!settings?.allowInPlay) return true;
  if (!strategy?.allowInPlay) return true;
  return false;
}