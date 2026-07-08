// ============================================================================
// Candidate Scoring Engine
//
// Central runner-scoring function that evaluates every runner against
// configured thresholds, producing a transparent scorecard with
// pass/fail results and specific failure reasons.
//
// All metrics are stored as DECIMALS (0.025 = 2.5%).
// Use fmtPct() for display, which multiplies by 100.
// ============================================================================

import { calculateSpreadTicks } from './tickLadder';

// ── Discovery Mode Presets ──
export const DISCOVERY_PRESETS = {
  strict: {
    label: 'Conservative (Strict)',
    description: 'No bet is default. Only strong value allowed.',
    minConfidence: 75,
    minEdge: 5,
    minExpectedROI: 3,
    minLiquidity: 500,
    maxSpread: 5,
  },
  balanced_paper: {
    label: 'Balanced Paper',
    description: 'Moderate thresholds for paper testing.',
    minConfidence: 65,
    minEdge: 2.5,
    minExpectedROI: 1,
    minLiquidity: 20,
    maxSpread: 7,
  },
  active_paper_discovery: {
    label: 'Active Paper Testing',
    description: 'Low thresholds for data collection. Does not mean better real-money performance.',
    minConfidence: 55,
    minEdge: 1.5,
    minExpectedROI: 0.5,
    minLiquidity: 2,
    maxSpread: 10,
  },
};

export const FREQUENCY_TO_MODE = {
  very_low: 'strict',
  low: 'strict',
  medium: 'balanced_paper',
  high: 'active_paper_discovery',
};

// ── Standardized Rejection Reasons ──
export const REJECTION_REASONS = {
  EDGE_BELOW_THRESHOLD: 'Edge below threshold',
  ROI_BELOW_THRESHOLD: 'Expected ROI below threshold',
  CONFIDENCE_BELOW_THRESHOLD: 'Confidence below threshold',
  LIQUIDITY_TOO_LOW: 'Liquidity too low',
  SPREAD_TOO_WIDE: 'Spread too wide',
  MARKET_TOO_CLOSE_TO_JUMP: 'Market too close to jump',
  MARKET_TOO_FAR_FROM_JUMP: 'Market too far from jump',
  RUNNER_INACTIVE: 'Runner inactive',
  MARKET_IN_PLAY: 'Market in-play',
  EMERGENCY_STOP_ACTIVE: 'Emergency stop active',
  DUPLICATE_ORDER: 'Duplicate order blocked',
  EXPOSURE_LIMIT_BREACHED: 'Exposure limit breached',
  EXTERNAL_FORM_DATA_REQUIRED: 'External form data required',
  AI_DISABLED: 'AI disabled',
  ODDS_OUTSIDE_RANGE: 'Odds outside configured range',
  NO_AVAILABLE_PRICE: 'No available price',
  DAILY_LOSS_LIMIT: 'Daily loss limit reached',
  MAX_OPEN_ORDERS: 'Max open orders reached',
  MARKET_NOT_OPEN: 'Market is not OPEN',
};

/**
 * Resolve effective thresholds from aiSettings, mode, and frequency.
 * Returns thresholds in DISPLAY units (percentages for edge/roi/confidence,
 * dollars for liquidity, ticks for spread).
 */
export function resolveThresholds(aiSettings) {
  const mode = aiSettings?.aiDecisionMode || 'strict';
  let preset = DISCOVERY_PRESETS[mode] || DISCOVERY_PRESETS.strict;

  // Frequency override — targetPaperBetsPerDay can override the mode
  const freq = aiSettings?.targetPaperBetsPerDay;
  if (freq && FREQUENCY_TO_MODE[freq]) {
    const freqMode = FREQUENCY_TO_MODE[freq];
    const freqPreset = DISCOVERY_PRESETS[freqMode];
    if (freqPreset) preset = freqPreset;
  }

  return {
    mode,
    label: preset.label,
    minConfidence: aiSettings?.minConfidence ?? preset.minConfidence,
    minEdge: aiSettings?.minEdge ?? preset.minEdge,
    minExpectedROI: aiSettings?.minExpectedROI ?? preset.minExpectedROI,
    minLiquidity: aiSettings?.minLiquidity ?? preset.minLiquidity,
    maxSpread: aiSettings?.maxSpread ?? preset.maxSpread,
  };
}

/**
 * Format a decimal as a percentage string.
 * @param {number} decimal - e.g. 0.025
 * @param {number} digits - decimal places
 * @returns {string} e.g. "2.50%"
 */
export function fmtPct(decimal, digits = 2) {
  if (decimal == null || isNaN(decimal)) return '—';
  return `${(decimal * 100).toFixed(digits)}%`;
}

/**
 * Score a single runner as a paper-bet candidate.
 *
 * @param {object} params
 * @param {object} params.runner - Runner entity
 * @param {object} params.market - Market entity
 * @param {object} params.prices - Override prices { bestBack, bestLay, bestBackSize, bestLaySize }
 * @param {number} params.volume - Override traded volume
 * @param {object} params.settings - App settings
 * @param {object} params.aiSettings - Featherless AI settings
 * @param {object} params.marketContext - { timeBeforeJump, commissionRate, inPlay, marketStatus, dataSource, totalTradedVolume }
 * @returns {object} Scored candidate with all metrics, sub-scores, and threshold results
 */
export function scoreRunnerCandidate({
  runner,
  market,
  prices,
  volume,
  settings = {},
  aiSettings = {},
  marketContext = {},
}) {
  const failedThresholds = [];

  // ── Extract prices ──
  const bestBack = prices?.bestBack ?? runner?.bestBackPrice ?? 0;
  const bestLay = prices?.bestLay ?? runner?.bestLayPrice ?? 0;
  const bestBackSize = prices?.bestBackSize ?? runner?.bestBackSize ?? 0;
  const bestLaySize = prices?.bestLaySize ?? runner?.bestLaySize ?? 0;
  const tradedVolume = volume ?? runner?.tradedVolumeAmount ?? runner?.totalMatched ?? 0;

  // ── Spread ──
  const spread = calculateSpreadTicks(bestBack, bestLay);

  // ── Thresholds ──
  const thresholds = resolveThresholds(aiSettings);
  const commissionRate = marketContext?.commissionRate ?? market?.marketBaseRate ?? settings?.defaultCommissionRate ?? 0.05;
  const minOdds = aiSettings?.minOdds ?? settings?.minOdds ?? 1.5;
  const maxOdds = aiSettings?.maxOdds ?? settings?.maxOdds ?? 20;

  // ── Implied Probability ──
  const impliedProbability = bestBack > 0 ? 1 / bestBack : 0;

  // ── Estimated Probability ──
  let estimatedProbability;
  if (runner?.modelProbability != null) {
    estimatedProbability = runner.modelProbability;
  } else {
    estimatedProbability = deriveMarketProbability(bestBack, runner, marketContext);
  }
  estimatedProbability = Math.min(0.95, Math.max(0.02, estimatedProbability));

  // ── Fair Odds ──
  const fairOdds = estimatedProbability > 0 ? 1 / estimatedProbability : 0;

  // ── Value Edge (decimal: 0.05 = 5%) ──
  const valueEdge = estimatedProbability - impliedProbability;

  // ── Expected ROI (decimal, after commission: 0.03 = 3%) ──
  const expectedROI = bestBack > 0
    ? estimatedProbability * (bestBack - 1) * (1 - commissionRate) - (1 - estimatedProbability)
    : 0;

  // ── Confidence (decimal: 0.75 = 75%) ──
  const confidence = deriveConfidence(runner, marketContext, bestBack, spread, tradedVolume, bestBackSize);

  // ── Sub-scores (all 0–1 scale) ──
  const liquidityScore = scoreLiquidity(bestBackSize, bestLaySize, thresholds.minLiquidity);
  const priceStabilityScore = scorePriceStability(spread, runner);
  const volumeScore = scoreVolume(tradedVolume);
  const timeWindowScore = scoreTimeWindow(marketContext?.timeBeforeJump, aiSettings, settings);

  // ── Market Efficiency Penalty (0–1, higher = worse) ──
  const marketEfficiencyPenalty = calcMarketEfficiencyPenalty(spread, tradedVolume, marketContext);

  // ── Overall Score (0–100) ──
  const overallScore = calcOverallScore({
    valueEdge, expectedROI, confidence, liquidityScore, priceStabilityScore,
    volumeScore, timeWindowScore, marketEfficiencyPenalty,
  });

  // ── Threshold Checks ──
  const minEdgeDecimal = thresholds.minEdge / 100;
  const minROIDecimal = thresholds.minExpectedROI / 100;
  const minConfidenceDecimal = thresholds.minConfidence / 100;

  if (bestBack <= 0) {
    failedThresholds.push({ key: 'NO_AVAILABLE_PRICE', reason: REJECTION_REASONS.NO_AVAILABLE_PRICE, field: 'bestBack', actual: 0, required: '> 0' });
  }

  if (bestBack > 0 && bestBack < minOdds) {
    failedThresholds.push({ key: 'ODDS_OUTSIDE_RANGE', reason: `${REJECTION_REASONS.ODDS_OUTSIDE_RANGE} (${bestBack.toFixed(2)} < ${minOdds})`, field: 'odds', actual: bestBack, required: `>= ${minOdds}` });
  }
  if (bestBack > maxOdds) {
    failedThresholds.push({ key: 'ODDS_OUTSIDE_RANGE', reason: `${REJECTION_REASONS.ODDS_OUTSIDE_RANGE} (${bestBack.toFixed(2)} > ${maxOdds})`, field: 'odds', actual: bestBack, required: `<= ${maxOdds}` });
  }

  if (valueEdge < minEdgeDecimal) {
    failedThresholds.push({ key: 'EDGE_BELOW_THRESHOLD', reason: `${REJECTION_REASONS.EDGE_BELOW_THRESHOLD} — edge ${fmtPct(valueEdge)}, required ${fmtPct(minEdgeDecimal)}`, field: 'valueEdge', actual: valueEdge, required: minEdgeDecimal });
  }

  if (expectedROI < minROIDecimal) {
    failedThresholds.push({ key: 'ROI_BELOW_THRESHOLD', reason: `${REJECTION_REASONS.ROI_BELOW_THRESHOLD} — ROI ${fmtPct(expectedROI)}, required ${fmtPct(minROIDecimal)}`, field: 'expectedROI', actual: expectedROI, required: minROIDecimal });
  }

  if (confidence < minConfidenceDecimal) {
    failedThresholds.push({ key: 'CONFIDENCE_BELOW_THRESHOLD', reason: `${REJECTION_REASONS.CONFIDENCE_BELOW_THRESHOLD} — confidence ${fmtPct(confidence)}, required ${fmtPct(minConfidenceDecimal)}`, field: 'confidence', actual: confidence, required: minConfidenceDecimal });
  }

  const availableLiquidity = Math.min(bestBackSize, bestLaySize);
  if (availableLiquidity < thresholds.minLiquidity) {
    failedThresholds.push({ key: 'LIQUIDITY_TOO_LOW', reason: `${REJECTION_REASONS.LIQUIDITY_TOO_LOW} — $${availableLiquidity.toFixed(2)}, required $${thresholds.minLiquidity}`, field: 'liquidity', actual: availableLiquidity, required: thresholds.minLiquidity });
  }

  if (spread > thresholds.maxSpread) {
    failedThresholds.push({ key: 'SPREAD_TOO_WIDE', reason: `${REJECTION_REASONS.SPREAD_TOO_WIDE} — ${spread} ticks, max ${thresholds.maxSpread}`, field: 'spread', actual: spread, required: thresholds.maxSpread });
  }

  const timeBeforeJump = marketContext?.timeBeforeJump;
  const windowStart = aiSettings?.timeWindowStart ?? settings?.defaultTimeWindowStartSeconds ?? 500;
  const windowEnd = aiSettings?.timeWindowEnd ?? settings?.defaultTimeWindowEndSeconds ?? 30;
  if (timeBeforeJump != null) {
    if (timeBeforeJump > windowStart) {
      failedThresholds.push({ key: 'MARKET_TOO_FAR_FROM_JUMP', reason: `${REJECTION_REASONS.MARKET_TOO_FAR_FROM_JUMP} — ${Math.round(timeBeforeJump)}s before, window opens at ${windowStart}s`, field: 'timeWindow', actual: timeBeforeJump, required: `<= ${windowStart}s` });
    }
    if (timeBeforeJump < windowEnd && timeBeforeJump > 0) {
      failedThresholds.push({ key: 'MARKET_TOO_CLOSE_TO_JUMP', reason: `${REJECTION_REASONS.MARKET_TOO_CLOSE_TO_JUMP} — ${Math.round(timeBeforeJump)}s before, window closes at ${windowEnd}s`, field: 'timeWindow', actual: timeBeforeJump, required: `>= ${windowEnd}s` });
    }
  }

  if (runner?.status && runner.status !== 'ACTIVE') {
    failedThresholds.push({ key: 'RUNNER_INACTIVE', reason: `${REJECTION_REASONS.RUNNER_INACTIVE} (${runner.status})`, field: 'runnerStatus', actual: runner.status, required: 'ACTIVE' });
  }

  if (market?.status && market.status !== 'OPEN') {
    failedThresholds.push({ key: 'MARKET_NOT_OPEN', reason: `${REJECTION_REASONS.MARKET_NOT_OPEN} (${market.status})`, field: 'marketStatus', actual: market.status, required: 'OPEN' });
  }

  if (market?.inPlay && !settings?.allowInPlay) {
    failedThresholds.push({ key: 'MARKET_IN_PLAY', reason: REJECTION_REASONS.MARKET_IN_PLAY, field: 'inPlay', actual: true, required: false });
  }

  const dataSource = marketContext?.dataSource || runner?.formDataStatus || 'MARKET_ONLY';
  if (aiSettings?.requireExternalFormData && dataSource === 'MARKET_ONLY') {
    failedThresholds.push({ key: 'EXTERNAL_FORM_DATA_REQUIRED', reason: REJECTION_REASONS.EXTERNAL_FORM_DATA_REQUIRED, field: 'dataSource', actual: dataSource, required: 'BETFAIR_METADATA_PLUS_MARKET or EXTERNAL_FORM_PLUS_MARKET' });
  }

  const passed = failedThresholds.length === 0;
  const mainBlocker = failedThresholds.length > 0 ? failedThresholds[0].reason : null;

  return {
    runnerName: runner?.runnerName || 'Unknown',
    selectionId: runner?.betfairSelectionId || runner?.selectionId || '',
    runnerId: runner?.id || '',
    bestBack,
    bestLay,
    spread,
    impliedProbability,
    estimatedProbability,
    fairOdds,
    valueEdge,           // decimal
    expectedROI,         // decimal
    confidence,          // decimal
    liquidityScore,
    priceStabilityScore,
    volumeScore,
    timeWindowScore,
    marketEfficiencyPenalty,
    overallScore,
    failedThresholds,
    mainBlocker,
    passed,
    dataSource,
    marketMovement: analyzeMovement(runner),
    thresholds,
  };
}

// ── Derive probability from market data (when no AI estimate) ──
function deriveMarketProbability(bestBack, runner, marketContext) {
  if (bestBack <= 0) return 0;
  let prob = 1 / bestBack;

  // Favourite-longshot bias
  if (bestBack < 2.5) prob *= 0.98;
  else if (bestBack > 15) prob *= 1.03;

  // Price movement
  const movement = runner?.priceMovementShortTerm;
  if (movement != null) {
    if (movement < -0.05) prob *= 1.02;    // shortening
    else if (movement > 0.05) prob *= 0.98; // drifting
  }

  // Order book imbalance
  const imbalance = runner?.orderBookImbalance;
  if (imbalance != null) {
    prob *= (1 + imbalance * 0.02);
  }

  return prob;
}

// ── Derive confidence from market quality ──
function deriveConfidence(runner, marketContext, bestBack, spread, tradedVolume, bestBackSize) {
  let conf = 0.5;

  if (bestBackSize > 100) conf += 0.1;
  else if (bestBackSize > 20) conf += 0.05;

  if (spread <= 2) conf += 0.1;
  else if (spread <= 4) conf += 0.05;
  else if (spread > 7) conf -= 0.1;

  if (tradedVolume > 50000) conf += 0.1;
  else if (tradedVolume > 10000) conf += 0.05;

  const movement = runner?.priceMovementShortTerm;
  if (movement != null && Math.abs(movement) < 0.02) conf += 0.05;
  else if (movement != null && Math.abs(movement) > 0.1) conf -= 0.05;

  // Cap at 0.70 for market-only (no form data)
  const hasFormData = marketContext?.dataSource && marketContext.dataSource !== 'MARKET_ONLY';
  if (!hasFormData) conf = Math.min(conf, 0.70);

  return Math.min(0.95, Math.max(0.1, conf));
}

function scoreLiquidity(bestBackSize, bestLaySize, minLiquidity) {
  const available = Math.min(bestBackSize, bestLaySize);
  if (available <= 0) return 0;
  if (available >= minLiquidity * 5) return 1;
  return Math.min(1, available / (minLiquidity * 5));
}

function scorePriceStability(spread, runner) {
  let score = spread <= 1 ? 1 : spread <= 2 ? 0.8 : spread <= 4 ? 0.6 : spread <= 7 ? 0.3 : 0.1;
  const movement = runner?.priceMovementShortTerm;
  if (movement != null) {
    const absMove = Math.abs(movement);
    if (absMove > 0.1) score *= 0.5;
    else if (absMove > 0.05) score *= 0.7;
  }
  return score;
}

function scoreVolume(tradedVolume) {
  if (tradedVolume <= 0) return 0;
  if (tradedVolume >= 100000) return 1;
  return Math.min(1, tradedVolume / 100000);
}

function scoreTimeWindow(timeBeforeJump, aiSettings, settings) {
  if (timeBeforeJump == null) return 0.5;
  const windowStart = aiSettings?.timeWindowStart ?? settings?.defaultTimeWindowStartSeconds ?? 500;
  const windowEnd = aiSettings?.timeWindowEnd ?? settings?.defaultTimeWindowEndSeconds ?? 30;
  if (timeBeforeJump >= windowEnd && timeBeforeJump <= windowStart) return 1;
  if (timeBeforeJump > windowStart) {
    return Math.max(0, 1 - (timeBeforeJump - windowStart) / windowStart);
  }
  if (timeBeforeJump < windowEnd && timeBeforeJump > 0) {
    return Math.max(0, timeBeforeJump / windowEnd);
  }
  return 0;
}

function calcMarketEfficiencyPenalty(spread, tradedVolume, marketContext) {
  let penalty = 0;
  if (spread > 5) penalty += 0.2;
  if (spread > 10) penalty += 0.2;
  if (tradedVolume < 1000) penalty += 0.15;
  if (marketContext?.inPlay) penalty += 0.3;
  return Math.min(1, penalty);
}

function calcOverallScore({ valueEdge, expectedROI, confidence, liquidityScore, priceStabilityScore, volumeScore, timeWindowScore, marketEfficiencyPenalty }) {
  const edgeScore = Math.max(0, Math.min(1, valueEdge * 10));
  const roiScore = Math.max(0, Math.min(1, expectedROI * 20));

  const raw = (
    edgeScore * 0.20 +
    roiScore * 0.20 +
    confidence * 0.20 +
    liquidityScore * 0.10 +
    priceStabilityScore * 0.10 +
    volumeScore * 0.05 +
    timeWindowScore * 0.10
  );

  const penalized = raw * (1 - marketEfficiencyPenalty * 0.5);
  return Math.round(Math.max(0, Math.min(100, penalized * 100)));
}

function analyzeMovement(runner) {
  const movement = runner?.priceMovementShortTerm;
  const volumeDelta = runner?.tradedVolumeDelta;

  let label = 'stable';
  if (movement != null) {
    if (movement < -0.03) label = 'shortening';
    else if (movement > 0.03) label = 'drifting';
  }

  return {
    label,
    priceMovement: movement ?? 0,
    volumeChange: volumeDelta ?? 0,
    backPressure: runner?.backPressure ?? 0,
    layPressure: runner?.layPressure ?? 0,
    orderBookImbalance: runner?.orderBookImbalance ?? 0,
  };
}