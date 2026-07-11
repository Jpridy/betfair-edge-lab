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
import { isPaperProofModeActive } from './paperProofDefaults';
import { matchOrderToMarket, matchSelectionId } from './marketIdMatcher';
import { ACTIVE_ORDER_STATUSES, exposureBlock } from './raceExposure';
import { DECISION_SOURCES, strategyForDecisionSource, dataSourceForDecisionSource } from './decisionProvenance';

const OPEN_ORDER_STATUSES = ACTIVE_ORDER_STATUSES;

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
 * @param {object} params.botSettings - BotSettings (for proof mode detection)
 * @param {object} params.featherlessSettings - FeatherlessSettings (for proof mode detection)
 * @param {boolean} params.paperProofMode - Pre-computed proof mode flag (takes priority)
 * @param {string} params.marketType - Market type ('WIN' | 'PLACE' | 'H2H')
 * @param {string} params.marketTypeCode - Market type code from Betfair
 * @param {string} params.eventId - Event ID
 * @param {string} params.eventName - Event name
 * @param {number} params.numberOfWinners - Number of winners (for PLACE markets)
 * @param {number} params.placeTerms - Place terms (for PLACE markets)
 * @param {boolean} params.proofMode - Whether this is a proof order
 * @param {string} params.proofReason - Proof reason
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
  botSettings = null,
  featherlessSettings = null,
  paperProofMode: paperProofModeOverride = undefined,
  marketType = null,
  marketTypeCode = null,
  eventId = null,
  eventName = null,
  numberOfWinners = null,
  placeTerms = null,
  proofMode = false,
  proofReason = null,
  decisionSource = null,
  selectionDiagnostics = null,
}) {
  const failures = [];
  if (decisionSource) {
    strategyName = strategyForDecisionSource(decisionSource);
    dataSource = dataSourceForDecisionSource(decisionSource);
    if (decisionSource === DECISION_SOURCES.DETERMINISTIC_MARKET_ONLY) entryReason = entryReason.replace(/\bAI\b:?\s*/gi, '').trim();
  }

  // ── Paper Proof Mode detection ──
  // Use pre-computed flag if provided, otherwise detect from real settings.
  const paperProofMode = paperProofModeOverride != null
    ? paperProofModeOverride
    : isPaperProofModeActive(settings, botSettings, featherlessSettings);

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

  // ── Force LAPSE in Paper Proof Mode ──
  if (paperProofMode && persistenceType === 'PERSIST') {
    persistenceType = 'LAPSE';
  }

  // ── Determine price ──
  const price = odds || (side === 'BACK' ? runner?.bestBackPrice : runner?.bestLayPrice) || 0;

  // ── Odds Bounds ── (relaxed in proof mode)
  const minOddsCheck = paperProofMode ? (settings.minOdds || 1.01) : (settings.minOdds || 1.5);
  const maxOddsCheck = paperProofMode ? (settings.maxOdds || 1000) : (settings.maxOdds || 20);
  if (!price || price < minOddsCheck) {
    failures.push({ field: 'odds', reason: `Odds ${price} below minimum ${minOddsCheck}` });
  }
  if (price > maxOddsCheck) {
    failures.push({ field: 'odds', reason: `Odds ${price} above maximum ${maxOddsCheck}` });
  }

  // ── Stake Bounds ── (relaxed in proof mode: $2 min, $5 max)
  const minStake = paperProofMode ? 2 : 1;
  const maxStake = paperProofMode ? (settings.maxStake || 5) : (settings.maxStake || 500);
  if (!stake || stake < minStake) {
    failures.push({ field: 'stake', reason: `Invalid stake: $${stake}` });
  }
  if (stake > maxStake) {
    failures.push({ field: 'stake', reason: `Stake $${stake} exceeds max $${maxStake}` });
  }
  const stakePct = bankrollStats.bankroll > 0 ? (stake / bankrollStats.bankroll) * 100 : 0;
  const maxStakePct = paperProofMode ? (settings.maxStakePercent || 0.1) : (settings.maxStakePercent || 5);
  if (stakePct > maxStakePct) {
    failures.push({ field: 'stakePercent', reason: `Stake ${stakePct.toFixed(1)}% exceeds max ${maxStakePct}% of bankroll` });
  }

  // ── Lay Liability Check ── (always enforced, but max is $25 in proof mode)
  if (side === 'LAY' && price > 0) {
    const liability = stake * (price - 1);
    const maxLiability = settings.maxLayLiability || 1500;
    if (liability > maxLiability) {
      failures.push({ field: 'layLiability', reason: `Lay liability $${liability.toFixed(2)} exceeds max $${maxLiability}` });
    }
  }

  // ── Opposite-Side Conflict Check ── (uses normalised match helpers)
  if (market && runner) {
    const orderMarket = { id: market.id, betfairMarketId: market.betfairMarketId };
    const oppositeSide = side === 'BACK' ? 'LAY' : 'BACK';
    const hasOpposite = existingOrders.some(o =>
      matchOrderToMarket(o, orderMarket) &&
      (matchSelectionId(o.selectionId, runner.betfairSelectionId || runner.selectionId) || matchSelectionId(o.runnerId, runner.id)) &&
      o.side === oppositeSide &&
      OPEN_ORDER_STATUSES.includes(o.status)
    );
    if (hasOpposite && !settings?.allowHedging) {
      failures.push({ field: 'conflictingPosition', reason: `Conflicting ${oppositeSide} position exists on this selection (hedging not enabled)` });
    }
  }

  // ── Exposure Limit ──
  const currentExposure = (bankrollStats.openPaperExposure || 0) + (bankrollStats.openLiveExposure || 0);
  const newExposure = side === 'LAY' ? stake * (price - 1) : stake;
  if (currentExposure + newExposure > (settings.maxMarketExposure || 1000)) {
    failures.push({ field: 'exposure', reason: `Exposure $${(currentExposure + newExposure).toFixed(2)} would exceed max $${settings.maxMarketExposure || 1000}` });
  }

  // ── One market / one race exposure guard ──
  if (market && runner) {
    const exposureFailure = exposureBlock(existingOrders, { ...market, eventId:eventId || market.eventId, eventName:eventName || market.eventName }, { ...settings, portfolioModeEnabled:featherlessSettings?.portfolioModeEnabled === true });
    if (exposureFailure) failures.push({ field:exposureFailure, reason:exposureFailure });
  }

  // ── Duplicate Order Check ── (uses normalised match helpers)
  if (market && runner) {
    const orderMarket = { id: market.id, betfairMarketId: market.betfairMarketId };
    const dup = existingOrders.some(o =>
      matchOrderToMarket(o, orderMarket) &&
      (matchSelectionId(o.selectionId, runner.betfairSelectionId || runner.selectionId) || matchSelectionId(o.runnerId, runner.id)) &&
      o.strategyName === strategyName &&
      OPEN_ORDER_STATUSES.includes(o.status)
    );
    if (dup) {
      failures.push({ field: 'duplicate', reason: 'Duplicate order already exists for this strategy/market/runner' });
    }
  }

  // ── Max Open Orders ──
  const openCount = existingOrders.filter(o => OPEN_ORDER_STATUSES.includes(o.status) || OPEN_ORDER_STATUSES.includes(o.settlementStatus)).length;
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
      decisionSource,
      selectionDiagnostics,
      marketId: market?.id || market?.betfairMarketId || '',
      betfairMarketId: market?.betfairMarketId || market?.id || '',
      normalizedMarketId: String(market?.betfairMarketId || market?.id || ''),
      selectionId: runner?.betfairSelectionId || runner?.selectionId || '',
      normalizedSelectionId: String(runner?.betfairSelectionId || runner?.selectionId || ''),
      runnerId: runner?.id || '',
      runnerName: runner?.runnerName || 'Unknown',
      horseNumber: runner?.horseNumber || 0,
      marketName: market?.venue ? `${market.venue} - ${market.marketName || 'Win'}` : (market?.marketName || 'Unknown'),
      venue: market?.venue || '',
      raceNumber: market?.raceNumber || 0,
      marketStartTime: market?.startTime || market?.marketStartTime || null,
      raceStartTime: market?.startTime || market?.marketStartTime || null,
      eventName: eventName || market?.eventName || '',
      eventId: eventId || market?.eventId || '',
      marketType: marketType || market?.marketType || null,
      marketTypeCode: marketTypeCode || market?.marketTypeCode || null,
      side,
      orderType: 'LIMIT',
      size: stake,
      price: price,
      persistenceType,
      paper_mode: true,
      liveMode: false,
      proofMode,
      proofReason,
      requested_size: stake,
      matched_size: 0,
      remaining_size: stake,
      requestedStake: stake,
      matchedStake: 0,
      requestedOdds: price,
      matchedOdds: null,
      status: 'rejected',
      settlementStatus: 'not_applicable',
      liability: side === 'LAY' ? stake * (price - 1) : stake,
      rejection_reason: reason,
      failed_validation_field: failures[0].field,
      result: 'pending',
      entryReason: entryReason || `${strategyName} paper order (${source})`,
      warningFlags: failures.map(f => f.reason),
      paperSimulationQuality: 'High',
      dataSource,
      validationRan: true,
      riskCheckRan: false,
      softOverridesApplied: [],
      hardBlockersChecked: true,
      commissionRateUsed: null,
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
    decisionSource,
    selectionDiagnostics,
    marketId: market.id || market.betfairMarketId,
    betfairMarketId: market.betfairMarketId || market.id,
    normalizedMarketId: String(market.betfairMarketId || market.id || ''),
    selectionId: runner.betfairSelectionId || runner.selectionId,
    normalizedSelectionId: String(runner.betfairSelectionId || runner.selectionId || ''),
    runnerId: runner.id,
    runnerName: runner.runnerName || 'Unknown Runner',
    horseNumber: runner.horseNumber || 0,
    marketName: market.venue ? `${market.venue} - ${market.marketName || 'Win'}` : (market.marketName || 'Unknown Market'),
    venue: market.venue || '',
    raceNumber: market.raceNumber || 0,
    marketStartTime: market.startTime || market.marketStartTime || null,
    raceStartTime: market.startTime || market.marketStartTime || null,
    eventName: eventName || market.eventName || '',
    eventId: eventId || market.eventId || '',
    marketType: marketType || market.marketType || null,
    marketTypeCode: marketTypeCode || market.marketTypeCode || null,
    numberOfWinners: numberOfWinners || market.numberOfWinners || null,
    placeTerms: placeTerms || null,
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
    proofMode,
    proofReason,
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
    settlementStatus: (orderStatus === 'matched' || orderStatus === 'partially_matched') ? 'awaiting_result' : 'not_applicable',
    liability: side === 'LAY' ? stake * (price - 1) : stake,
    expectedValue: expectedValue,
    result: 'pending',
    grossProfit: 0,
    commission: 0,
    netProfit: 0,
    commissionRateUsed,
    normalizedCommissionRate: commissionRateUsed,
    commissionSource,
    commission_calculation_status: commResult.status,
    entryReason: entryReason || `${strategyName} paper order (${source})`,
    warningFlags: [],
    paperSimulationQuality: 'High',
    dataSource,
    validationRan: true,
    riskCheckRan: true,
    softOverridesApplied: [],
    hardBlockersChecked: true,
  };

  return { order, rejected: false, reason: null };
}