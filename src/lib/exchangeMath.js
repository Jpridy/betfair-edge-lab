const finite = value => Number.isFinite(Number(value));

export function calcBackEV(p, odds, commissionRate, stake) {
  const profitIfWin = stake * (odds - 1) * (1 - commissionRate);
  const lossIfLose = stake;
  const ev = p * profitIfWin - (1 - p) * lossIfLose;
  return { ev, roi: stake > 0 ? ev / stake : 0, profitIfWin, lossIfLose, breakevenProbability: 1 / (1 + (odds - 1) * (1 - commissionRate)), liability: stake };
}

export function calcLayEV(p, odds, commissionRate, stake) {
  const liability = stake * (odds - 1);
  const profitIfSelectionLoses = stake * (1 - commissionRate);
  const ev = (1 - p) * profitIfSelectionLoses - p * liability;
  return { ev, roi: liability > 0 ? ev / liability : 0, liability, profitIfSelectionLoses, lossIfSelectionWins: liability, breakevenProbability: (1 - commissionRate) / (odds - commissionRate) };
}

export function calcBackEdge(p, odds) { return odds > 0 ? p - 1 / odds : 0; }
export function calcLayEdge(p, odds) { return odds > 0 ? 1 / odds - p : 0; }
export function calcOverround(odds = []) { return odds.reduce((sum, value) => sum + (value > 0 ? 1 / value : 0), 0) - 1; }

export function buildCalculationResult({ side, probability, odds, normalizedCommissionRate, stake }) {
  const p = Number(probability), price = Number(odds), rate = Number(normalizedCommissionRate), amount = Number(stake);
  if (![p, price, rate, amount].every(finite) || p <= 0 || p >= 1 || price <= 1 || rate < 0 || rate > .2 || amount < 0) return { mathematicalInvariantsPassed: false, error: 'INVALID_CALCULATION_INPUT' };
  const impliedProbability = 1 / price;
  const math = side === 'LAY' ? calcLayEV(p, price, rate, amount) : calcBackEV(p, price, rate, amount);
  const liability = side === 'LAY' ? math.liability : amount;
  const profitIfWin = side === 'LAY' ? math.profitIfSelectionLoses : math.profitIfWin;
  const lossIfLose = side === 'LAY' ? math.lossIfSelectionWins : math.lossIfLose;
  const edge = side === 'LAY' ? calcLayEdge(p, price) : calcBackEdge(p, price);
  const mathematicalInvariantsPassed = side === 'LAY'
    ? Math.abs(liability - amount * (price - 1)) <= 1e-8 && lossIfLose === liability && math.ev >= -liability - 1e-8
    : liability === amount && lossIfLose === amount && math.ev >= -amount - 1e-8 && math.roi >= -1 - 1e-8;
  return { probability:p, impliedProbability, odds:price, normalizedCommissionRate:rate, stake:amount, liability, profitIfWin, lossIfLose, ev:math.ev, roi:math.roi, edge, breakevenProbability:math.breakevenProbability, mathematicalInvariantsPassed };
}

export function calcKellyStake(p, odds, bankroll, confidence = .75, kellyMultiplier = .25, commissionRate = 0) {
  if (odds <= 1 || bankroll <= 0) return { kellyFraction:0, stake:0 };
  const netWinPayoff = (odds - 1) * (1 - commissionRate);
  const fraction = (p * netWinPayoff - (1 - p)) / netWinPayoff;
  return { kellyFraction:Math.max(0, fraction), stake:Math.max(0, bankroll * fraction * kellyMultiplier * confidence) };
}

export function calcLayKellyStake(p, odds, bankroll, confidence = .75, kellyMultiplier = .25, commissionRate = 0) {
  if (odds <= 1 || bankroll <= 0) return { kellyFraction:0, stake:0, liability:0 };
  const liabilityPerStake = odds - 1;
  const capitalGrowthEdge = (1 - p) * (1 - commissionRate) - p * liabilityPerStake;
  const liabilityFraction = Math.max(0, capitalGrowthEdge / Math.max(liabilityPerStake, 1e-12));
  const liability = bankroll * liabilityFraction * kellyMultiplier * confidence;
  const stake = liability / liabilityPerStake;
  return { kellyFraction:liabilityFraction, stake, liability };
}

export function applyStakeCaps(stake, bankroll, settings = {}) {
  if (!(stake > 0)) return 0;
  const absolute = Number(settings.maxStake ?? Infinity);
  const percent = Number(settings.maxStakePercent ?? 100) / 100;
  return Math.min(stake, absolute, bankroll * percent);
}

export function calcDelayRiskScore(timeBeforeJump, spreadTicks, isLiveMode) { if (isLiveMode) return 0; let score=.3; if (timeBeforeJump != null) { if (timeBeforeJump < 60) score+=.3; if (timeBeforeJump > 500) score+=.1; } if (spreadTicks > 5) score+=.15; return Math.min(1,score); }
export function calcFillProbability(availableSize, stake, spreadTicks, timeBeforeJump) { if (availableSize <= 0 || stake <= 0) return 0; let p=Math.min(1,availableSize/stake); if (spreadTicks>3)p*=.8;if(spreadTicks>5)p*=.7;if(timeBeforeJump!=null&&timeBeforeJump<60)p*=.9;return Math.max(0,Math.min(1,p)); }