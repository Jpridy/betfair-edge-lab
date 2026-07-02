export const BOT_STEPS = [
  'Scan Markets',
  'Filter Markets',
  'Read Odds',
  'Check Strategies',
  'Create Signal',
  'Run Risk Manager',
  'Submit Paper Order',
  'Track Order',
  'Update Bankroll',
  'Update Strategy Stats',
  'Write Audit Log',
];

export const STRATEGY_LABELS = {
  promising: { text: 'Promising', status: 'ok' },
  needs_more_data: { text: 'Needs More Data', status: 'info' },
  unstable: { text: 'Unstable', status: 'warning' },
  risky: { text: 'Risky', status: 'warning' },
  failing: { text: 'Failing', status: 'danger' },
  disabled: { text: 'Disabled', status: 'neutral' },
};

export function getEnabledStrategies(settings) {
  const strategies = [];
  if (settings.strategyValueBetEnabled) strategies.push('Value Bet');
  if (settings.strategyScalpingEnabled) strategies.push('Pre-Off Scalping');
  if (settings.strategyFavOutsiderEnabled) strategies.push('Fav/Outsider');
  if (settings.strategyCrossMarketEnabled) strategies.push('Steam/Drift');
  return strategies;
}

export function impliedProb(odds) {
  return 1 / odds;
}

// EV_back = modelProbability * (odds - 1) * (1 - commissionRate) - (1 - modelProbability)
export function calcEVBack(modelProb, odds, commissionRate) {
  return modelProb * (odds - 1) * (1 - commissionRate) - (1 - modelProb);
}

export function calcEdge(modelProb, odds) {
  const implied = impliedProb(odds);
  return ((modelProb - implied) / implied) * 100;
}

export function createSignal(strategyName, market, runner, settings) {
  const odds = runner.bestBackPrice || runner.lastTradedPrice || 3.0;
  const baseProb = impliedProb(odds);
  const modelProb = Math.min(0.95, Math.max(0.05, baseProb * (0.92 + Math.random() * 0.2)));
  const ev = calcEVBack(modelProb, odds, settings.commissionRate || 0.05);
  const edge = calcEdge(modelProb, odds);
  const stake = Math.min(
    Math.round((settings.baseStake || 100) + Math.random() * ((settings.maxStake || 500) - (settings.baseStake || 100))),
    settings.maxStake || 500
  );
  const side = strategyName === 'Fav/Outsider'
    ? (runner.isFavourite ? 'BACK' : 'LAY')
    : (Math.random() > 0.35 ? 'BACK' : 'LAY');

  return {
    strategyName,
    marketId: market.id,
    runnerId: runner.id,
    side,
    odds,
    stakeSuggestion: stake,
    modelProbability: modelProb,
    impliedProbability: baseProb,
    fairOdds: 1 / modelProb,
    edgePercent: edge,
    expectedValue: ev,
    confidence: 0.5 + Math.random() * 0.4,
    signalStatus: 'active',
    reason: `${strategyName}: edge ${edge.toFixed(2)}%, EV $${ev.toFixed(2)}`,
  };
}

export function runRiskCheck(signal, settings, bankrollStats, paperOrders) {
  const reasons = [];

  if (signal.odds < (settings.minOdds || 1.5)) reasons.push(`Odds below minimum (${settings.minOdds})`);
  if (signal.odds > (settings.maxOdds || 20)) reasons.push(`Odds above maximum (${settings.maxOdds})`);
  if (signal.stakeSuggestion > (settings.maxStake || 500)) reasons.push('Stake exceeds max');
  if (bankrollStats.todayPL < -(settings.dailyLossLimit || 500)) reasons.push('Daily loss limit reached');

  const openOrders = paperOrders.filter(o => ['submitted', 'matched', 'partially_matched'].includes(o.status));
  if (openOrders.length >= (settings.maxOpenOrders || 10)) reasons.push('Max open orders reached');

  const exposure = openOrders.reduce((sum, o) => sum + (o.matchedStake || o.requestedStake || 0), 0);
  if (exposure >= (settings.maxMarketExposure || 1000)) reasons.push('Market exposure limit reached');

  const todayOrders = paperOrders.filter(o => {
    try { return new Date(o.created_date).toDateString() === new Date().toDateString(); }
    catch { return false; }
  });
  if (todayOrders.length >= (settings.maxTradesPerDay || 50)) reasons.push('Max trades per day reached');

  if (Math.random() < 0.08) reasons.push('Strategy guard: CLV below threshold');

  return { passed: reasons.length === 0, reasons };
}

export function createPaperOrder(signal, market, runner, settings) {
  const matched = Math.random() > 0.15;
  return {
    strategyName: signal.strategyName,
    marketId: signal.marketId,
    runnerId: signal.runnerId,
    runnerName: runner?.runnerName || signal.runnerId,
    marketName: market?.marketName || signal.marketId,
    side: signal.side,
    orderType: 'LIMIT',
    requestedOdds: signal.odds,
    matchedOdds: matched ? signal.odds : null,
    requestedStake: signal.stakeSuggestion,
    matchedStake: matched ? signal.stakeSuggestion : 0,
    status: matched ? 'matched' : 'unmatched',
    expectedValue: signal.expectedValue,
    result: 'pending',
    grossProfit: 0,
    commission: 0,
    netProfit: 0,
  };
}

export function settleOrder(order, settings) {
  const won = Math.random() > 0.45;
  const commissionRate = settings.commissionRate || 0.05;

  if (won) {
    if (order.side === 'BACK') {
      const gross = (order.matchedOdds - 1) * order.matchedStake;
      return { ...order, result: 'won', grossProfit: gross, commission: gross * commissionRate, netProfit: gross * (1 - commissionRate), status: 'settled' };
    } else {
      const gross = order.matchedStake;
      return { ...order, result: 'won', grossProfit: gross, commission: gross * commissionRate, netProfit: gross * (1 - commissionRate), status: 'settled' };
    }
  } else {
    if (order.side === 'BACK') {
      return { ...order, result: 'lost', grossProfit: -order.matchedStake, commission: 0, netProfit: -order.matchedStake, status: 'settled' };
    } else {
      const liability = (order.matchedOdds - 1) * order.matchedStake;
      return { ...order, result: 'lost', grossProfit: -liability, commission: 0, netProfit: -liability, status: 'settled' };
    }
  }
}

export function getStrategyLabel(stats) {
  if (!stats || stats.totalPaperOrders < 10) return 'needs_more_data';
  if (stats.netProfit <= 0 || stats.roi <= 0) return 'failing';
  if (stats.profitFactor < 1) return 'failing';
  if (stats.maxDrawdown < -500) return 'risky';
  if (stats.longestLosingStreak >= 5) return 'unstable';
  if (stats.closingLineValue <= 0) return 'risky';
  return 'promising';
}