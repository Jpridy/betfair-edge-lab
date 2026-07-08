// ============================================================================
// Exchange Maths — Deterministic EV functions for BACK and LAY bets
//
// All probabilities are decimals (0.55 = 55%).
// All edge/ROI/EV values are decimals (0.05 = 5%).
// Commission rate is a decimal (0.05 = 5%).
//
// No AI decision may bypass these functions.
// ============================================================================

/**
 * BACK bet exchange maths.
 *
 * @param {number} p - Model probability of winning (0–1)
 * @param {number} odds - Back odds (decimal, > 1)
 * @param {number} commissionRate - Commission rate (0.05 = 5%)
 * @param {number} stake - Stake amount
 * @returns {object} { ev, roi, profitIfWin, lossIfLose, breakevenProbability, liability }
 */
export function calcBackEV(p, odds, commissionRate, stake) {
  const comm = commissionRate ?? 0.05;
  const profitIfWin = stake * (odds - 1) * (1 - comm);
  const lossIfLose = stake;
  const ev = p * profitIfWin - (1 - p) * lossIfLose;
  const roi = stake > 0 ? ev / stake : 0;
  const breakevenProbability = 1 / (1 + ((odds - 1) * (1 - comm)));
  return {
    ev,
    roi,
    profitIfWin,
    lossIfLose,
    breakevenProbability,
    liability: stake, // For BACK, liability = stake (what you can lose)
  };
}

/**
 * LAY bet exchange maths.
 *
 * @param {number} p - Model probability of selection WINNING (0–1)
 * @param {number} odds - Lay odds (decimal, > 1)
 * @param {number} commissionRate - Commission rate (0.05 = 5%)
 * @param {number} stake - Backer's stake (the amount you're laying)
 * @returns {object} { ev, roi, liability, profitIfSelectionLoses, lossIfSelectionWins, breakevenProbability }
 */
export function calcLayEV(p, odds, commissionRate, stake) {
  const comm = commissionRate ?? 0.05;
  const liability = stake * (odds - 1);
  const profitIfSelectionLoses = stake * (1 - comm);
  const lossIfSelectionWins = liability;
  const ev = (1 - p) * profitIfSelectionLoses - p * liability;
  const roi = liability > 0 ? ev / liability : 0;
  const breakevenProbability = (1 - comm) / (odds - comm);
  return {
    ev,
    roi,
    liability,
    profitIfSelectionLoses,
    lossIfSelectionWins,
    breakevenProbability,
  };
}

/**
 * Calculate edge for a BACK bet.
 * Edge = model probability - implied probability (decimal).
 */
export function calcBackEdge(p, odds) {
  if (odds <= 0) return 0;
  return p - (1 / odds);
}

/**
 * Calculate edge for a LAY bet.
 * Edge = implied probability - model probability (decimal).
 * Positive when model thinks selection is LESS likely to win than market implies.
 */
export function calcLayEdge(p, odds) {
  if (odds <= 0) return 0;
  return (1 / odds) - p;
}

/**
 * Calculate market overround from a set of runner odds.
 * Overround = sum of implied probabilities - 1.
 * Positive = bookmaker margin (favors layer). Negative = underround (favors backer).
 */
export function calcOverround(runnerOdds) {
  if (!runnerOdds || runnerOdds.length === 0) return 0;
  const totalImplied = runnerOdds.reduce((sum, o) => sum + (o > 0 ? 1 / o : 0), 0);
  return totalImplied - 1;
}

/**
 * Calculate fractional Kelly stake for a BACK bet.
 * Kelly fraction = ((odds - 1) * p - (1 - p)) / (odds - 1)
 * Stake = bankroll * kellyFraction * kellyFractionMultiplier * confidence
 */
export function calcKellyStake(p, odds, bankroll, confidence = 0.75, kellyMultiplier = 0.25) {
  if (odds <= 1) return { kellyFraction: 0, stake: 0 };
  const kellyFraction = ((odds - 1) * p - (1 - p)) / (odds - 1);
  const stake = bankroll * kellyFraction * kellyMultiplier * confidence;
  const maxStake = bankroll * 0.01; // Cap at 1% of bankroll
  return {
    kellyFraction,
    stake: Math.max(0, Math.min(stake, maxStake)),
  };
}

/**
 * Calculate fractional Kelly stake for a LAY bet.
 * Lay Kelly = ((1-p) - p * (odds-1)) / (odds-1) ... simplified: lay_kelly = -back_kelly at lay odds
 */
export function calcLayKellyStake(p, odds, bankroll, confidence = 0.75, kellyMultiplier = 0.25) {
  if (odds <= 1) return { kellyFraction: 0, stake: 0, liability: 0 };
  // Lay kelly: f = (1 - p - p*(odds-1)) / (odds-1) = (1 - p*odds) / (odds-1)
  const kellyFraction = (1 - p * odds) / (odds - 1);
  const stake = bankroll * kellyFraction * kellyMultiplier * confidence;
  const maxStake = bankroll * 0.01;
  const cappedStake = Math.max(0, Math.min(stake, maxStake));
  return {
    kellyFraction,
    stake: cappedStake,
    liability: cappedStake * (odds - 1),
  };
}

/**
 * Calculate delay risk score (0–1, higher = worse).
 * In delayed API mode, scalping/market-making/last-second chasing is disabled.
 */
export function calcDelayRiskScore(timeBeforeJump, spreadTicks, isLiveMode) {
  if (isLiveMode) return 0;
  let score = 0.3; // Base delay penalty
  if (timeBeforeJump != null) {
    if (timeBeforeJump < 60) score += 0.3; // Last-second chasing
    if (timeBeforeJump > 500) score += 0.1; // Early market, prices unreliable
  }
  if (spreadTicks > 5) score += 0.15;
  return Math.min(1, score);
}

/**
 * Estimate fill probability for an order (0–1).
 * Based on available size, spread, and time before jump.
 */
export function calcFillProbability(availableSize, stake, spreadTicks, timeBeforeJump) {
  if (availableSize <= 0) return 0;
  let prob = Math.min(1, availableSize / Math.max(stake, 1));
  if (spreadTicks > 3) prob *= 0.8;
  if (spreadTicks > 5) prob *= 0.7;
  if (timeBeforeJump != null && timeBeforeJump < 60) prob *= 0.9;
  return Math.max(0, Math.min(1, prob));
}