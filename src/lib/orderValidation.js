// ============================================================================
// Order Placement Pre-Check Engine
//
// Before any paper or live order is created, this engine runs a full
// validation checklist. If any check fails, a rejected order record is
// created with the rejection reason and failed validation field.
// ============================================================================

import { isValidTickPrice, roundToNearestTick, countTicksBetween } from './tickLadder';
import { isCommissionValidForLive, isInPlayLocked, isOrderOpen } from './betfairMapping';

/**
 * Run the full pre-order validation checklist.
 * 
 * @param {object} order - The proposed order { marketId, selectionId, side, price, size, persistenceType, strategyName }
 * @param {object} market - The market object
 * @param {object} runner - The runner object
 * @param {object} strategy - The strategy object from DEMO_STRATEGY_LIBRARY
 * @param {object} settings - App settings
 * @param {object} bankrollStats - Current bankroll stats
 * @param {array} existingOrders - Existing paper/live orders
 * @param {object} connectionState - { apiConnected, betfairSessionToken, dataFresh }
 * @returns {object} { passed, failures, rejectedOrder }
 */
export function runPreOrderChecks(order, market, runner, strategy, settings, bankrollStats, existingOrders, connectionState) {
  const failures = [];
  const isLiveMode = connectionState?.apiConnected === true;
  const riskDisabled = settings?.riskLimitsDisabled === true;

  // ── Market Checks ──
  if (!market) {
    failures.push({ field: 'marketId', reason: 'Market not found' });
    return { passed: false, failures, rejectedOrder: createRejectedOrder(order, failures) };
  }

  if (!market.betfairMarketId && !market.marketId) {
    failures.push({ field: 'marketId', reason: 'marketId does not exist' });
  }

  if (market.status === 'SUSPENDED') {
    failures.push({ field: 'marketStatus', reason: 'Market is SUSPENDED — cannot place orders' });
  }

  if (market.status === 'CLOSED' || market.status === 'SETTLED') {
    failures.push({ field: 'marketStatus', reason: 'Market is CLOSED — cannot place orders' });
  }

  // ── Runner Checks ──
  if (!runner) {
    failures.push({ field: 'selectionId', reason: 'Runner not found' });
  } else {
    if (!runner.betfairSelectionId && !runner.selectionId) {
      failures.push({ field: 'selectionId', reason: 'selectionId does not exist' });
    }

    if (runner.status === 'REMOVED') {
      failures.push({ field: 'runnerStatus', reason: 'Runner is REMOVED — cannot place orders' });
    }

    if (runner.status !== 'ACTIVE' && runner.status !== 'WINNER' && runner.status !== 'LOSER') {
      failures.push({ field: 'runnerStatus', reason: `Runner is ${runner.status} (must be ACTIVE)` });
    }

    // Price availability checks
    if (order.side === 'BACK' && (!runner.bestBackPrice || runner.bestBackPrice <= 0)) {
      failures.push({ field: 'bestBackPrice', reason: 'No back price available' });
    }

    if (order.side === 'LAY' && (!runner.bestLayPrice || runner.bestLayPrice <= 0)) {
      failures.push({ field: 'bestLayPrice', reason: 'No lay price available' });
    }

    // Size availability — in live mode, just require a token minimum ($2).
    // Live markets have thin liquidity at best price; the paper matching engine
    // already simulates partial fills.
    const sizeThreshold = isLiveMode ? 2 : (settings.baseStake || 50);
    if (order.side === 'BACK' && runner.bestBackSize < sizeThreshold) {
      failures.push({ field: 'bestBackSize', reason: `Insufficient available back size ($${runner.bestBackSize?.toFixed(2)}, need $${sizeThreshold.toFixed(2)})` });
    }

    if (order.side === 'LAY' && runner.bestLaySize < sizeThreshold) {
      failures.push({ field: 'bestLaySize', reason: `Insufficient available lay size ($${runner.bestLaySize?.toFixed(2)}, need $${sizeThreshold.toFixed(2)})` });
    }

    // Spread check (for scalping strategies)
    if (strategy?.name === 'Pre-Off Scalping' && runner.bestBackPrice > 0 && runner.bestLayPrice > 0) {
      const spreadTicks = countTicksBetween(runner.bestBackPrice, runner.bestLayPrice);
      if (spreadTicks > 3) {
        failures.push({ field: 'spread', reason: `Spread too wide (${spreadTicks} ticks — max 3 for scalping)` });
      }
    }
  }

  // ── Market Open Check ──
  if (market.status !== 'OPEN') {
    if (!failures.some(f => f.field === 'marketStatus')) {
      failures.push({ field: 'marketStatus', reason: `Market is ${market.status} (must be OPEN)` });
    }
  }

  // ── In-Play Check ──
  if (market.inPlay && !strategy?.allowInPlay) {
    failures.push({ field: 'inPlay', reason: 'Market is in-play but strategy is pre-off only' });
  }

  if (market.inPlay && settings && !settings.allowInPlay) {
    failures.push({ field: 'inPlay', reason: 'In-play betting is disabled in settings' });
  }

  // ── Strategy Checks ──
  if (!strategy) {
    failures.push({ field: 'strategy', reason: 'Strategy not found' });
  } else {
    if (strategy.status === 'archived') {
      failures.push({ field: 'strategyStatus', reason: 'Strategy is archived — cannot place orders' });
    }

    if (strategy.status === 'locked' || strategy.status === 'disabled') {
      failures.push({ field: 'strategyStatus', reason: 'Strategy is locked/disabled' });
    }


  }

  // ── Time Window Check ──
  // In live mode, the market selection already picks the market closest to
  // the trading window. Most live markets are further out than 5 minutes, so
  // blocking on the strict window would prevent any paper orders from ever
  // being created. Skip the hard block in live mode.
  if (market.startTime && strategy && !strategy.allowInPlay && connectionState?.apiConnected !== true) {
    const start = new Date(market.startTime).getTime();
    const now = Date.now();
    const secondsBefore = (start - now) / 1000;

    const windowStart = strategy.timeWindowStart || settings.defaultTimeWindowStartSeconds || 300;
    const windowEnd = strategy.timeWindowEnd || settings.defaultTimeWindowEndSeconds || 30;

    if (secondsBefore > windowStart) {
      failures.push({ field: 'timeWindow', reason: `Too early — race starts in ${Math.round(secondsBefore)}s (window opens at ${windowStart}s before start)` });
    }

    if (secondsBefore < windowEnd && secondsBefore > 0) {
      failures.push({ field: 'timeWindow', reason: `Too late — race starts in ${Math.round(secondsBefore)}s (window closes at ${windowEnd}s before start)` });
    }

    if (secondsBefore <= 0 && !market.inPlay) {
      failures.push({ field: 'timeWindow', reason: 'Race has jumped — pre-off window closed' });
    }
  }

  // ── Liquidity Check ──
  const minLiquidity = strategy?.minLiquidity || settings.minimumLiquidity || 5000;
  if (!riskDisabled && !isLiveMode && market.totalMatched < minLiquidity) {
    failures.push({ field: 'liquidity', reason: `Market liquidity $${market.totalMatched?.toFixed(0)} below minimum $${minLiquidity}` });
  }

  // ── Price Validation ──
  if (!riskDisabled && (!order.price || order.price < (settings.minOdds || 1.5))) {
    failures.push({ field: 'price', reason: `Price ${order.price} below minimum odds ${settings.minOdds || 1.5}` });
  }

  if (!riskDisabled && order.price > (settings.maxOdds || 20)) {
    failures.push({ field: 'price', reason: `Price ${order.price} above maximum odds ${settings.maxOdds || 20}` });
  }

  if (!isValidTickPrice(order.price)) {
    // Auto-correct rather than reject — but log a warning
    const corrected = roundToNearestTick(order.price);
    if (Math.abs(corrected - order.price) > 0.001) {
      failures.push({ field: 'price', reason: `Price ${order.price} is not on Betfair tick ladder (nearest: ${corrected})` });
    }
  }

  // ── Stake Checks ──
  if (!riskDisabled && (!order.size || order.size < (settings.baseStake || 50))) {
    failures.push({ field: 'size', reason: `Stake $${order.size} below minimum $${settings.baseStake || 50}` });
  }

  if (!riskDisabled && order.size > (settings.maxStake || 500)) {
    failures.push({ field: 'size', reason: `Stake $${order.size} exceeds max $${settings.maxStake || 500}` });
  }

  // ── Lay Liability Check ──
  if (!riskDisabled && order.side === 'LAY') {
    const liability = order.size * (order.price - 1);
    const maxLiability = settings.maxLayLiability || settings.maxStake * 3 || 1500;
    if (liability > maxLiability) {
      failures.push({ field: 'liability', reason: `Lay liability $${liability.toFixed(2)} exceeds max $${maxLiability}` });
    }
  }

  // ── Bankroll Check ──
  if (!riskDisabled) {
    const requiredFunds = order.side === 'BACK' ? order.size : order.size * (order.price - 1);
    if (bankrollStats && bankrollStats.available < requiredFunds) {
      failures.push({ field: 'bankroll', reason: `Insufficient bankroll ($${bankrollStats.available?.toFixed(2)} available, $${requiredFunds.toFixed(2)} required)` });
    }
  }

  // ── Daily Loss Limit ──
  if (!riskDisabled && bankrollStats && bankrollStats.todayPL < -(settings.dailyLossLimit || 500)) {
    failures.push({ field: 'dailyLossLimit', reason: `Daily loss limit reached (P/L: $${bankrollStats.todayPL?.toFixed(2)}, limit: -$${settings.dailyLossLimit || 500})` });
  }

  // ── Weekly Loss Limit ──
  if (!riskDisabled && bankrollStats && bankrollStats.weeklyPL !== undefined && bankrollStats.weeklyPL < -(settings.weeklyLossLimit || settings.dailyLossLimit * 5 || 2500)) {
    failures.push({ field: 'weeklyLossLimit', reason: `Weekly loss limit reached (P/L: $${bankrollStats.weeklyPL?.toFixed(2)})` });
  }

  // ── Max Open Orders ──
  if (!riskDisabled) {
    const openOrders = existingOrders.filter(o => isOrderOpen(o.status));
    if (openOrders.length >= (settings.maxOpenOrders || 10)) {
      failures.push({ field: 'maxOpenOrders', reason: `Max open orders reached (${openOrders.length}/${settings.maxOpenOrders || 10})` });
    }
  }

  // ── Max Unmatched Orders ──
  if (!riskDisabled) {
    const unmatchedOrders = existingOrders.filter(o => o.status === 'unmatched' || o.status === 'partially_matched');
    const maxUnmatched = settings.maxUnmatchedOrders || settings.maxOpenOrders || 10;
    if (unmatchedOrders.length >= maxUnmatched) {
      failures.push({ field: 'maxUnmatched', reason: `Max unmatched orders reached (${unmatchedOrders.length}/${maxUnmatched})` });
    }
  }

  // ── Max Orders Per Market ──
  if (!riskDisabled) {
    const marketOrders = existingOrders.filter(o => o.marketId === order.marketId && isOrderOpen(o.status));
    if (marketOrders.length >= (settings.maxTradesPerMarket || 5)) {
      failures.push({ field: 'maxTradesPerMarket', reason: `Max orders per market reached (${marketOrders.length}/${settings.maxTradesPerMarket || 5})` });
    }
  }

  // ── Duplicate Order Check ──
  if (!riskDisabled) {
    const dup = existingOrders.some(o =>
      o.marketId === order.marketId &&
      (o.selectionId === order.selectionId || o.runnerId === order.runnerId) &&
      o.strategyName === order.strategyName &&
      isOrderOpen(o.status)
    );
    if (dup) {
      failures.push({ field: 'duplicate', reason: 'Duplicate order already exists for this strategy/market/runner' });
    }
  }

  // ── Data Freshness Check (live mode only) ──
  if (!riskDisabled && connectionState?.apiConnected && !connectionState.dataFresh) {
    failures.push({ field: 'dataFreshness', reason: 'Data feed is stale — refusing to place orders on stale data' });
  }

  // ── Betfair Connection Check (live mode only) ──
  if (order.liveMode && connectionState) {
    if (!connectionState.apiConnected || !connectionState.betfairSessionToken) {
      failures.push({ field: 'betfairConnection', reason: 'Betfair session disconnected — cannot place live orders' });
    }
  }

  // ── Commission Check ──
  if (!isCommissionValidForLive(market, settings)) {
    if (order.liveMode) {
      failures.push({ field: 'commission', reason: 'Live locked: Market Base Rate missing — commission calculation invalid' });
    }
  }

  // ── Drawdown Check ──
  if (!riskDisabled && bankrollStats && strategy) {
    const drawdownLimit = settings.bankroll * 0.10 || 1000;
    if (bankrollStats.maxDrawdown && bankrollStats.maxDrawdown < -drawdownLimit) {
      failures.push({ field: 'drawdown', reason: `Strategy drawdown exceeds limit ($${bankrollStats.maxDrawdown?.toFixed(2)})` });
    }
  }

  const passed = failures.length === 0;
  const rejectedOrder = passed ? null : createRejectedOrder(order, failures, market, runner, strategy);

  return { passed, failures, rejectedOrder };
}

/**
 * Create a rejected order record.
 */
function createRejectedOrder(order, failures, market, runner, strategy) {
  const firstFailure = failures[0];
  return {
    ...order,
    status: 'rejected',
    rejection_reason: firstFailure.reason,
    failed_validation_field: firstFailure.field,
    strategy: strategy?.name || order.strategyName,
    market: market?.marketName || order.marketId,
    runner: runner?.runnerName || order.runnerId,
    marketId: order.marketId,
    selectionId: order.selectionId,
    timestamp: new Date().toISOString(),
    all_failures: failures.map(f => `${f.field}: ${f.reason}`),
    paper_mode: !order.liveMode,
  };
}