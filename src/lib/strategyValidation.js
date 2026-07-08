// ============================================================================
// Strategy Validation Engine
// Computes traffic-light status, live lockout checks, metric reconciliation,
// and data quality badges for every strategy.
// ============================================================================

export const MIN_SAMPLE_SIZE = 200;
export const MIN_PROFIT_FACTOR = 1.20;
export const MIN_CLV = 0;
export const MAX_DRAWDOWN_PERCENT = 10; // % of bankroll

// ─── Traffic Light Status ───────────────────────────────────────────────────
// green  = paper validated (all criteria passed)
// yellow = paper testing (needs more data)
// red    = failing / locked
// grey   = archived
export function computeTrafficLight(strategy, audit, settings) {
  if (!strategy || !audit) return { light: 'grey', label: 'No Data', reasons: [] };

  // Grey: archived
  if (strategy.status === 'archived') {
    return { light: 'grey', label: 'Archived', reasons: ['Strategy is archived and inactive'] };
  }

  const reasons = [];
  const failingReasons = [];

  // Red conditions (any one triggers red)
  if (audit.netProfit < 0) failingReasons.push('Net ROI is negative');
  if (audit.profitFactor < 1.0) failingReasons.push('Profit factor below 1.00');
  if (audit.closingLineValue < 0) failingReasons.push('Closing Line Value is negative');
  if (audit.maxDrawdown < -(settings?.bankroll * MAX_DRAWDOWN_PERCENT / 100 || 1000)) {
    failingReasons.push('Drawdown exceeds risk limit');
  }
  if (audit.dataQualityError) failingReasons.push('Strategy has data quality errors');

  if (failingReasons.length > 0) {
    return { light: 'red', label: 'Failing / Locked', reasons: failingReasons };
  }

  // Green conditions (all must be true)
  const greenReasons = [];
  let isGreen = true;

  if (audit.totalPaperOrders < MIN_SAMPLE_SIZE) {
    isGreen = false;
    greenReasons.push(`Only ${audit.totalPaperOrders} settled trades (min ${MIN_SAMPLE_SIZE} required)`);
  }
  if (audit.netProfit <= 0) {
    isGreen = false;
    greenReasons.push('Net ROI is not positive');
  }
  if (audit.profitFactor < MIN_PROFIT_FACTOR) {
    isGreen = false;
    greenReasons.push(`Profit factor ${audit.profitFactor.toFixed(2)} below ${MIN_PROFIT_FACTOR}`);
  }
  if (audit.closingLineValue <= 0) {
    isGreen = false;
    greenReasons.push('CLV is not positive');
  }
  if (audit.maxDrawdown < -(settings?.bankroll * MAX_DRAWDOWN_PERCENT / 100 || 1000)) {
    isGreen = false;
    greenReasons.push('Drawdown exceeds allowed risk limit');
  }
  if (audit.hasDataWarnings) {
    isGreen = false;
    greenReasons.push('Has unresolved data quality warnings');
  }

  if (isGreen) {
    return { light: 'green', label: 'Paper Validated', reasons: ['All validation criteria passed'] };
  }

  // Yellow: paper testing only
  return { light: 'yellow', label: 'Paper Testing', reasons: greenReasons.length > 0 ? greenReasons : ['Strategy needs more data or testing'] };
}

// ─── Data Quality Badge ─────────────────────────────────────────────────────
export function computeDataQuality(strategy, audit) {
  if (!audit) return { status: 'stale_data', label: 'Stale Data', warnings: ['No audit data available'] };

  const warnings = [];

  if (audit.totalPaperOrders < MIN_SAMPLE_SIZE) {
    warnings.push(`Sample too small (${audit.totalPaperOrders}/${MIN_SAMPLE_SIZE})`);
  }
  if (audit.closingLineValue === null || audit.closingLineValue === undefined) {
    warnings.push('CLV data missing');
  }
  if (audit.hasSettlementGap) {
    warnings.push('Missing settlement data for some orders');
  }
  if (audit.commissionError) {
    warnings.push('Commission calculation error detected');
  }

  // Check reconciliation errors
  const recon = reconcileMetrics(audit);
  if (!recon.valid) {
    warnings.push(...recon.errors);
  }

  if (warnings.length === 0) return { status: 'clean', label: 'Clean', warnings: [] };
  if (warnings.some(w => w.includes('Commission'))) return { status: 'commission_error', label: 'Commission Error', warnings };
  if (warnings.some(w => w.includes('settlement') || w.includes('Settlement'))) return { status: 'missing_settlement', label: 'Missing Settlement', warnings };
  if (warnings.some(w => w.includes('CLV'))) return { status: 'missing_clv', label: 'Missing CLV', warnings };
  if (warnings.some(w => w.includes('Sample') || w.includes('sample'))) return { status: 'sample_too_small', label: 'Sample Too Small', warnings };
  if (warnings.length > 2) return { status: 'needs_audit', label: 'Needs Audit', warnings };
  return { status: 'needs_audit', label: 'Needs Audit', warnings };
}

// ─── Metric Reconciliation ──────────────────────────────────────────────────
export function reconcileMetrics(audit) {
  const errors = [];

  if (!audit) return { valid: true, errors: [] };

  // Net profit should match gross - commission
  if (audit.grossProfit !== undefined && audit.commissionPaid !== undefined && audit.netProfit !== undefined) {
    const expectedNet = audit.grossProfit - audit.commissionPaid;
    if (Math.abs(expectedNet - audit.netProfit) > 0.50) {
      errors.push('Net profit does not match gross profit minus commission');
    }
  }

  // ROI should match net profit / total stake
  if (audit.netProfit !== undefined && audit.totalStake !== undefined && audit.roi !== undefined && audit.totalStake > 0) {
    const expectedROI = (audit.netProfit / audit.totalStake) * 100;
    if (Math.abs(expectedROI - audit.roi) > 0.50) {
      errors.push('ROI does not match net profit / total stake');
    }
  }

  // Win + loss should match settled orders
  if (audit.wins !== undefined && audit.losses !== undefined && audit.matchedOrders !== undefined) {
    if (audit.wins + audit.losses !== audit.matchedOrders && audit.matchedOrders > 0) {
      errors.push('Win/loss count does not match settled order count');
    }
  }

  // Average stake should match total stake / order count
  if (audit.totalStake !== undefined && audit.matchedOrders !== undefined && audit.averageStake !== undefined && audit.matchedOrders > 0) {
    const expectedAvg = audit.totalStake / audit.matchedOrders;
    if (Math.abs(expectedAvg - audit.averageStake) > 1.0) {
      errors.push('Average stake does not match total stake / order count');
    }
  }

  // CLV missing
  if (audit.closingLineValue === null || audit.closingLineValue === undefined) {
    errors.push('CLV is missing');
  }

  // Profit factor needs gross loss
  if (audit.profitFactor !== undefined && audit.grossLoss === undefined && audit.netProfit < 0) {
    errors.push('Profit factor cannot be calculated — missing gross loss data');
  }

  // Commission check — uses Market Base Rate, not fixed 5%
  if (audit.grossProfit > 0 && audit.commissionPaid !== undefined && audit.commissionRateUsed !== undefined) {
    const expectedComm = audit.grossProfit * audit.commissionRateUsed;
    if (Math.abs(expectedComm - audit.commissionPaid) > 1.0) {
      errors.push('Commission not applied correctly (does not match Market Base Rate)');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Live Mode Lockout ──────────────────────────────────────────────────────
export function checkLiveLockout(strategy, audit, settings, adminState = {}) {
  const reasons = [];

  if (!strategy || !audit) {
    return { locked: true, reasons: ['No strategy data available'] };
  }

  // Archived = always locked
  if (strategy.status === 'archived') {
    return { locked: true, reasons: ['Live locked: strategy is archived.'] };
  }

  // Fav/Outsider is failing — always locked
  if (strategy.name === 'Fav/Outsider' || strategy.validationStatus === 'failing') {
    return { locked: true, reasons: ['Live locked: Fav/Outsider is failing.'] };
  }

  // Status must be green
  const status = computeTrafficLight(strategy, audit, settings);
  if (status.light !== 'green') {
    reasons.push(`Strategy status is "${status.label}" — must be Live Approved`);
  }

  // Admin must manually enable live mode
  if (!adminState.liveApproved) {
    reasons.push('Admin has not manually approved this strategy for live mode');
  }

  // Sample size
  if (audit.totalPaperOrders < MIN_SAMPLE_SIZE) {
    reasons.push(`Live locked: minimum ${MIN_SAMPLE_SIZE} settled paper trades required (current: ${audit.totalPaperOrders}).`);
  }

  // Net ROI positive after commission
  if (audit.netProfit <= 0) {
    reasons.push('Live locked: net ROI is not positive after commission.');
  }

  // CLV positive
  if (audit.closingLineValue <= 0) {
    reasons.push('Live locked: strategy has negative CLV.');
  }

  // Profit factor
  if (audit.profitFactor < MIN_PROFIT_FACTOR) {
    reasons.push(`Live locked: profit factor ${audit.profitFactor.toFixed(2)} below ${MIN_PROFIT_FACTOR}.`);
  }

  // Drawdown
  const drawdownLimit = settings?.bankroll * MAX_DRAWDOWN_PERCENT / 100 || 1000;
  if (audit.maxDrawdown < -drawdownLimit) {
    reasons.push('Live locked: drawdown exceeds allowed limit.');
  }

  // Data errors
  const dq = computeDataQuality(strategy, audit);
  if (dq.status !== 'clean') {
    reasons.push(`Live locked: data quality is "${dq.label}" — must be Clean.`);
  }

  // Metric reconciliation
  const recon = reconcileMetrics(audit);
  if (!recon.valid) {
    reasons.push('Live locked: has unresolved metric reconciliation warnings.');
  }

  // Commission calculation must be valid
  if (!adminState.commissionValid) {
    reasons.push('Live locked: Market Base Rate missing — commission calculation invalid.');
  }

  // Betfair connection must be healthy
  if (!adminState.betfairConnected) {
    reasons.push('Live locked: Betfair session disconnected.');
  }

  // Risk Manager must allow it
  if (!adminState.riskManagerAllows) {
    reasons.push('Live locked: Risk Manager does not allow live trading.');
  }

  // Persistence type must be approved (for pre-off strategies using PERSIST)
  if (strategy.persistenceType === 'PERSIST' && !settings?.persistApproved && !strategy.allowInPlay) {
    reasons.push('Live locked: pre-off strategy uses PERSIST without admin approval.');
  }

  // In-play check
  if (strategy.allowInPlay && !settings?.allowInPlay) {
    reasons.push('Live locked: in-play betting is disabled.');
  }

  // User confirmation
  if (!adminState.userConfirmed) {
    reasons.push('User has not confirmed live mode via warning modal.');
  }

  return { locked: reasons.length > 0, reasons };
}

// ─── Paper Trading Progress ─────────────────────────────────────────────────
export function getPaperProgress(audit) {
  const current = audit?.totalPaperOrders || 0;
  const target = MIN_SAMPLE_SIZE;
  const percent = Math.min(100, (current / target) * 100);
  return { current, target, percent };
}

// ─── Betfair Safety Checks (pre-order validation) ───────────────────────────
export function runPreOrderSafetyChecks(order, market, runner, strategy, settings, existingOrders = []) {
  const failures = [];

  if (!market) {
    failures.push('Market not found');
    return { passed: false, failures };
  }

  // Market must be OPEN
  if (market.status !== 'OPEN') {
    failures.push(`Market is ${market.status} (must be OPEN)`);
  }

  // In-play check
  if (market.inPlay && !strategy.allowInPlay) {
    failures.push('Market is in-play but strategy is pre-off only');
  }

  // Time window check
  if (market.startTime && strategy.timeWindow) {
    const start = new Date(market.startTime).getTime();
    const now = Date.now();
    const secondsBefore = (start - now) / 1000;
    if (secondsBefore > (strategy.timeWindowStart || 600) || secondsBefore < (strategy.timeWindowEnd || 30)) {
      failures.push(`Race start is outside strategy time window (${Math.round(secondsBefore)}s before jump)`);
    }
  }

  // Runner count
  if (market.numberOfRunners < 2) {
    failures.push('Market has fewer than 2 runners');
  }

  // Liquidity
  if (market.totalMatched < (strategy.minLiquidity || settings.minimumLiquidity)) {
    failures.push(`Market liquidity $${market.totalMatched} below minimum $${strategy.minLiquidity || settings.minimumLiquidity}`);
  }

  // Odds range
  if (order.requestedOdds < (settings.minOdds || 1.5) || order.requestedOdds > (settings.maxOdds || 20)) {
    failures.push(`Odds ${order.requestedOdds} outside allowed range ${settings.minOdds}-${settings.maxOdds}`);
  }

  // Stake vs bankroll
  if (order.requestedStake > (settings.maxStake || 500)) {
    failures.push(`Stake $${order.requestedStake} exceeds max $${settings.maxStake}`);
  }

  // Strategy locked
  if (strategy.status === 'archived') {
    failures.push('Strategy is archived — cannot place orders');
  }

  // Duplicate check
  const dup = existingOrders.some(o =>
    o.marketId === order.marketId &&
    o.runnerId === order.runnerId &&
    o.strategyName === order.strategyName &&
    ['matched', 'pending', 'partially_matched', 'executable', 'unmatched'].includes(o.status)
  );
  if (dup) {
    failures.push('Duplicate order already exists for this runner/strategy');
  }

  return { passed: failures.length === 0, failures };
}