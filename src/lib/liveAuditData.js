/**
 * Derives live strategy audit data from real paper orders and strategy stats.
 * Replaces the static STRATEGY_AUDIT_DATA with database-driven values.
 */

/**
 * Build an audit object (compatible with computeTrafficLight) from a StrategyStats DB record.
 * Returns null if no stats record exists.
 */
export function buildAuditFromStats(stat) {
  if (!stat) return null;
  return {
    totalSignals: stat.totalSignals || 0,
    totalPaperOrders: stat.totalPaperOrders || 0,
    matchedOrders: stat.totalPaperOrders || 0,
    unmatchedOrders: 0,
    wins: stat.wins || 0,
    losses: stat.losses || 0,
    strikeRate: stat.strikeRate || 0,
    totalStake: stat.averageStake ? stat.averageStake * (stat.totalPaperOrders || 0) : 0,
    totalLiability: stat.averageStake ? stat.averageStake * (stat.totalPaperOrders || 0) : 0,
    grossProfit: stat.grossProfit || 0,
    commissionPaid: 0,
    netProfit: stat.netProfit || 0,
    grossLoss: stat.netProfit < 0 ? Math.abs(stat.netProfit) : 0,
    roi: stat.roi || 0,
    liabilityRoi: stat.roi || 0,
    profitFactor: stat.profitFactor || 0,
    maxDrawdown: stat.maxDrawdown || 0,
    longestLosingStreak: stat.longestLosingStreak || 0,
    averageOdds: stat.averageOdds || 0,
    averageStake: stat.averageStake || 0,
    averageEdge: stat.averageEdge || 0,
    averageMatchedPrice: stat.averageOdds || 0,
    closingPrice: 0,
    closingLineValue: stat.closingLineValue || 0,
    slippage: 0,
    averageTimeBeforeStart: 0,
    lastRunDate: stat.updatedAt || null,
    hasDataWarnings: false,
    hasSettlementGap: false,
    commissionError: false,
    dataQualityError: false,
    equityCurve: [],
    drawdownCurve: [],
    clvHistory: [],
    strikeRateHistory: [],
    weeklyROI: [],
    profitByMarketType: [],
    profitByOddsRange: [],
    profitByTimeWindow: [],
  };
}

/**
 * Derive audit data for a strategy from settled paper orders (live source).
 * Falls back to StrategyStats record if provided.
 */
export function buildAuditFromOrders(strategyName, paperOrders, stat) {
  const settled = paperOrders.filter(o => o.status === 'settled' && o.strategyName === strategyName);
  const wins = settled.filter(o => o.result === 'won').length;
  const losses = settled.filter(o => o.result === 'lost').length;
  const totalPaperOrders = settled.length;
  const totalStake = settled.reduce((s, o) => s + (o.matchedStake || o.matched_size || o.requestedStake || 0), 0);
  const netProfit = settled.reduce((s, o) => s + (o.netProfit || 0), 0);
  const grossProfit = settled.filter(o => (o.netProfit || 0) > 0).reduce((s, o) => s + (o.netProfit || 0), 0);
  const grossLoss = settled.filter(o => (o.netProfit || 0) < 0).reduce((s, o) => s + Math.abs(o.netProfit || 0), 0);
  const commissionPaid = settled.reduce((s, o) => s + (o.commission || 0), 0);
  const strikeRate = totalPaperOrders > 0 ? (wins / totalPaperOrders) * 100 : 0;
  const roi = totalStake > 0 ? (netProfit / totalStake) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99 : 0);
  const averageOdds = totalPaperOrders > 0 ? settled.reduce((s, o) => s + (o.matchedOdds || o.requestedOdds || 0), 0) / totalPaperOrders : 0;
  const averageStake = totalPaperOrders > 0 ? totalStake / totalPaperOrders : 0;
  const averageEdge = totalPaperOrders > 0 ? settled.reduce((s, o) => s + (o.edge || 0), 0) / totalPaperOrders : 0;
  const clvOrders = settled.filter(o => o.clv != null);
  const closingLineValue = clvOrders.length > 0 ? clvOrders.reduce((s, o) => s + (o.clv || 0), 0) / clvOrders.length : 0;

  // Build equity curve from settled orders sorted by date
  const sorted = settled.slice().sort((a, b) => (a.settled_date || a.created_date || '').localeCompare(b.settled_date || b.created_date || ''));
  let running = 0;
  const equityCurve = sorted.map((o, i) => {
    running += (o.netProfit || 0);
    return { week: `T${i + 1}`, value: running };
  });

  // Max drawdown
  let peak = 0;
  let maxDD = 0;
  let run = 0;
  for (const o of sorted) {
    run += (o.netProfit || 0);
    if (run > peak) peak = run;
    const dd = run - peak;
    if (dd < maxDD) maxDD = dd;
  }

  // Longest losing streak
  let streak = 0;
  let longestStreak = 0;
  for (const o of sorted) {
    if ((o.netProfit || 0) < 0) {
      streak++;
      if (streak > longestStreak) longestStreak = streak;
    } else {
      streak = 0;
    }
  }

  // If we have a stat record, merge in any missing fields
  const statAudit = stat ? buildAuditFromStats(stat) : {};

  return {
    ...statAudit,
    totalPaperOrders,
    wins,
    losses,
    strikeRate,
    totalStake,
    netProfit,
    grossProfit,
    grossLoss,
    commissionPaid,
    roi,
    profitFactor,
    maxDrawdown: maxDD,
    longestLosingStreak: longestStreak,
    averageOdds,
    averageStake,
    averageEdge,
    closingLineValue,
    equityCurve,
    hasDataWarnings: false,
    hasSettlementGap: false,
    commissionError: false,
    dataQualityError: false,
  };
}

/**
 * Get live audit data for a strategy.
 * @param {string} strategyName
 * @param {Array} paperOrders - all paper orders from context
 * @param {Array} strategyStats - strategy stats from DB
 * @returns {object|null} audit object or null if no data
 */
export function getLiveAuditData(strategyName, paperOrders, strategyStats) {
  const stat = strategyStats?.find(s => s.strategyName === strategyName);
  const hasOrders = paperOrders.some(o => o.status === 'settled' && o.strategyName === strategyName);
  if (!stat && !hasOrders) return null;
  return buildAuditFromOrders(strategyName, paperOrders, stat);
}