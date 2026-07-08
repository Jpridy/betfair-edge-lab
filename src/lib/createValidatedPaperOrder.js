// ============================================================================
// Central Paper-Order Creation Function
//
// Single source of truth for creating validated paper orders.
// Used by: bot engine, PaperTrading manual orders, RunnerView quick orders,
// and Featherless AI panel orders.
//
// Runs the full validation checklist, checks available size, and creates
// either a rejected order (with reason) or a matched/partially_matched/unmatched
// paper order with correct stake tracking.
// ============================================================================

import { calculateCommission } from './betfairMapping';

const OPEN_ORDER_STATUSES = ['pending', 'executable', 'matched', 'unmatched', 'partially_matched'];

/**
 * Create a validated paper order.
 *
 * @param {object} params
 * @param {object} params.market - Market object
 * @param {object} params.runner - Runner object
 * @param {string} params.side - 'BACK' or 'LAY'
 * @param {number} params.stake - Requested stake amount
 * @param {number} params.odds - Requested odds (if null, uses best back/lay price)
 * @param {string} params.strategyName - Strategy name
 * @param {string} params.source - 'bot' | 'manual' | 'runner_view' | 'featherless_ai'
 * @param {object} params.settings - App settings
 * @param {object} params.bankrollStats - Current bankroll stats
 * @param {array} params.existingOrders - Existing paper orders (for duplicate check)
 * @param {boolean} params.emergencyStop - Whether emergency stop is active
 * @param {boolean} params.apiConnected - Whether Betfair data is connected
 * @param {string} params.persistenceType - 'LAPSE' | 'PERSIST' | 'MARKET_ON_CLOSE'
 * @param {number} params.expectedValue - EV from signal (optional)
 * @param {string} params.entryReason - Entry reason text (optional)
 * @param {string} params.dataSource - Data source label (optional)
 * @returns {{ order: object, rejected: boolean, reason: string|null }}
 */
export function createValidatedPaperOrder({
  market,
  runner,
  side,
  stake,
  odds = null,
  strategyName,
  source = 'manual',
  settings = {},
  bankrollStats = {},
  existingOrders = [],
  emergencyStop = false,
  apiConnected = false,
  persistenceType = 'LAPSE',
  expectedValue = 0,
  entryReason = '',
  dataSource = 'MARKET_ONLY',
}) {
  const failures = [];

  // ── Emergency Stop ──
  if (emergencyStop) {
    failures.push({ field: 'emergencyStop', reason: 'Emergency stop is active — no orders can be placed' });
  }

  // ── Market Checks ──
  if (!market) {
    failures.push({ field: 'market', reason: 'Market not found' });
  } else {
    if (market.status !== 'OPEN') {
      failures.push({ field: 'marketStatus', reason: `Market is ${market.status} (must be OPEN)` });
    }
    if (market.inPlay && !settings.allowInPlay) {
      failures.push({ field: 'inPlay', reason: 'Market is in-play (locked by settings)' });
    }
  }

  // ── Runner Checks ──
  if (!runner) {
    failures.push({ field: 'runner', reason: 'Runner not found' });
  } else {
    if (runner.status === 'REMOVED') {
      failures.push({ field: 'runnerStatus', reason: 'Runner is REMOVED' });
    }
    if (runner.status !== 'ACTIVE') {
      failures.push({ field: 'runnerStatus', reason: `Runner is ${runner.status} (must be ACTIVE)` });
    }
  }

  // ── Determine price ──
  const price = odds || (side === 'BACK' ? runner?.bestBackPrice : runner?.bestLayPrice) || 0;

  // ── Odds Bounds ──
  if (!price || price < (settings.minOdds || 1.5)) {
    failures.push({ field: 'odds', reason: `Odds ${price} below minimum ${settings.minOdds || 1.5}` });
  }
  if (price > (settings.maxOdds || 20)) {
    failures.push({ field: 'odds', reason: `Odds ${price} above maximum ${settings.maxOdds || 20}` });
  }

  // ── Stake Bounds ──
  if (!stake || stake < 1) {
    failures.push({ field: 'stake', reason: `Invalid stake: $${stake}` });
  }
  if (stake > (settings.maxStake || 500)) {
    failures.push({ field: 'stake', reason: `Stake $${stake} exceeds max $${settings.maxStake || 500}` });
  }
  const stakePct = bankrollStats.bankroll > 0 ? (stake / bankrollStats.bankroll) * 100 : 0;
  if (stakePct > (settings.maxStakePercent || 5)) {
    failures.push({ field: 'stakePercent', reason: `Stake ${stakePct.toFixed(1)}% exceeds max ${settings.maxStakePercent || 5}% of bankroll` });
  }

  // ── Lay Liability Check ──
  if (side === 'LAY' && price > 0) {
    const liability = stake * (price - 1);
    const maxLiability = settings.maxLayLiability || 1500;
    if (liability > maxLiability) {
      failures.push({ field: 'layLiability', reason: `Lay liability $${liability.toFixed(2)} exceeds max $${maxLiability}` });
    }
  }

  // ── Exposure Limit ──
  const currentExposure = (bankrollStats.openPaperExposure || 0) + (bankrollStats.openLiveExposure || 0);
  const newExposure = side === 'LAY' ? stake * (price - 1) : stake;
  if (currentExposure + newExposure > (settings.maxMarketExposure || 1000)) {
    failures.push({ field: 'exposure', reason: `Exposure $${(currentExposure + newExposure).toFixed(2)} would exceed max $${settings.maxMarketExposure || 1000}` });
  }

  // ── Duplicate Order Check ──
  if (market && runner) {
    const dup = existingOrders.some(o =>
      o.marketId === (market.id || market.betfairMarketId) &&
      (o.selectionId === (runner.betfairSelectionId || runner.selectionId) || o.runnerId === runner.id) &&
      o.strategyName === strategyName &&
      OPEN_ORDER_STATUSES.includes(o.status)
    );
    if (dup) {
      failures.push({ field: 'duplicate', reason: 'Duplicate order already exists for this strategy/market/runner' });
    }
  }

  // ── Max Open Orders ──
  const openCount = existingOrders.filter(o => OPEN_ORDER_STATUSES.includes(o.status)).length;
  if (openCount >= (settings.maxOpenOrders || 10)) {
    failures.push({ field: 'maxOpenOrders', reason: `Max open orders reached (${openCount}/${settings.maxOpenOrders || 10})` });
  }

  // ── Available Size Check ──
  const availableSize = runner
    ? (side === 'BACK' ? (runner.bestBackSize || 0) : (runner.bestLaySize || 0))
    : 0;

  // If any validation failed, create a rejected order
  if (failures.length > 0) {
    const reason = failures.map(f => f.reason).join('; ');
    const rejectedOrder = {
      strategyName,
      marketId: market?.id || market?.betfairMarketId || '',
      betfairMarketId: market?.betfairMarketId || market?.id || '',
      selectionId: runner?.betfairSelectionId || runner?.selectionId || '',
      runnerId: runner?.id || '',
      runnerName: runner?.runnerName || 'Unknown',
      horseNumber: runner?.horseNumber || 0,
      marketName: market?.venue ? `${market.venue} - ${market.marketName || 'Win'}` : (market?.marketName || 'Unknown'),
      venue: market?.venue || '',
      raceNumber: market?.raceNumber || 0,
      marketStartTime: market?.startTime || null,
      side,
      orderType: 'LIMIT',
      size: stake,
      price: price,
      persistenceType,
      paper_mode: true,
      liveMode: false,
      requested_size: stake,
      matched_size: 0,
      remaining_size: stake,
      requestedStake: stake,
      matchedStake: 0,
      requestedOdds: price,
      matchedOdds: null,
      status: 'rejected',
      rejection_reason: reason,
      failed_validation_field: failures[0].field,
      result: 'pending',
      entryReason: entryReason || `${strategyName} paper order (${source})`,
      warningFlags: failures.map(f => f.reason),
      paperSimulationQuality: 'High',
      dataSource,
    };
    return { order: rejectedOrder, rejected: true, reason };
  }

  // ── Calculate matched/unmatched based on available size ──
  let matchedStake, remainingStake, orderStatus;

  if (availableSize <= 0) {
    matchedStake = 0;
    remainingStake = stake;
    orderStatus = 'unmatched';
  } else if (availableSize < stake) {
    matchedStake = availableSize;
    remainingStake = stake - availableSize;
    orderStatus = 'partially_matched';
  } else {
    matchedStake = stake;
    remainingStake = 0;
    orderStatus = 'matched';
  }

  // ── Commission ──
  const commResult = calculateCommission(0, market, settings);
  const commissionRateUsed = commResult.rate;
  const commissionSource = commResult.source;

  const order = {
    strategyName,
    marketId: market.id || market.betfairMarketId,
    betfairMarketId: market.betfairMarketId || market.id,
    selectionId: runner.betfairSelectionId || runner.selectionId,
    runnerId: runner.id,
    runnerName: runner.runnerName || 'Unknown Runner',
    horseNumber: runner.horseNumber || 0,
    marketName: market.venue ? `${market.venue} - ${market.marketName || 'Win'}` : (market.marketName || 'Unknown Market'),
    venue: market.venue || '',
    raceNumber: market.raceNumber || 0,
    marketStartTime: market.startTime || null,
    side,
    orderType: 'LIMIT',
    size: stake,
    price: price,
    persistenceType,
    customerRef: 'BEL' + Date.now().toString(36).toUpperCase(),
    customerStrategyRef: 'BEL_' + strategyName.toUpperCase().replace(/[^A-Z]/g, ''),
    handicap: runner.handicap || 0,
    paper_mode: true,
    liveMode: false,
    requested_size: stake,
    matched_size: matchedStake,
    remaining_size: remainingStake,
    average_price_matched: matchedStake > 0 ? price : null,
    requested_price: price,
    matched_price: matchedStake > 0 ? price : null,
    placed_date: new Date().toISOString(),
    matched_date: matchedStake > 0 ? new Date().toISOString() : null,
    requestedOdds: price,
    matchedOdds: matchedStake > 0 ? price : null,
    requestedStake: stake,
    matchedStake: matchedStake,
    status: orderStatus,
    expectedValue: expectedValue,
    result: 'pending',
    grossProfit: 0,
    commission: 0,
    netProfit: 0,
    commissionRateUsed,
    commissionSource,
    commission_calculation_status: commResult.status,
    entryReason: entryReason || `${strategyName} paper order (${source})`,
    warningFlags: [],
    paperSimulationQuality: 'High',
    dataSource,
  };

  return { order, rejected: false, reason: null };
}