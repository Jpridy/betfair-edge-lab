// Unified risk and exposure calculations — single source of truth.
// Used by AppContext, RiskManager, RiskOverview, Orders, PerformanceAnalytics, Dashboard.

const OPEN_ORDER_STATUSES = ['pending', 'executable', 'matched', 'unmatched', 'partially_matched'];
const UNMATCHED_STATUSES = ['unmatched', 'partially_matched'];

export function calculateRiskMetrics(paperOrders, settings = {}) {
  const settled = paperOrders.filter(o => o.status === 'settled');
  const openOrders = paperOrders.filter(o => OPEN_ORDER_STATUSES.includes(o.status));
  const unmatchedOrders = paperOrders.filter(o => UNMATCHED_STATUSES.includes(o.status));

  const paperExposure = openOrders
    .filter(o => o.paper_mode !== false)
    .reduce((s, o) => s + (o.matched_size || o.matchedStake || o.requestedStake || 0), 0);

  const liveExposure = openOrders
    .filter(o => o.liveMode === true)
    .reduce((s, o) => s + (o.matched_size || o.matchedStake || o.requestedStake || 0), 0);

  const totalExposure = paperExposure + liveExposure;

  // Lay liability: stake * (odds - 1) for each open LAY order
  const layLiability = openOrders
    .filter(o => (o.side || '').toUpperCase() === 'LAY')
    .reduce((s, o) => {
      const stake = o.matched_size || o.matchedStake || o.requestedStake || 0;
      const odds = o.matchedOdds || o.average_price_matched || o.requestedOdds || 0;
      return s + stake * (odds - 1);
    }, 0);

  const totalPL = settled.reduce((s, o) => s + (o.netProfit || 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const dailyPL = settled
    .filter(o => (o.settled_date || o.created_date || '').slice(0, 10) === today)
    .reduce((s, o) => s + (o.netProfit || 0), 0);

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weeklyPL = settled
    .filter(o => (o.settled_date || o.created_date || '') >= weekAgo)
    .reduce((s, o) => s + (o.netProfit || 0), 0);

  // Drawdown — peak-to-trough from starting bankroll
  const startingBankroll = settings.paperBankroll || settings.bankroll || 0;
  let peak = startingBankroll;
  let maxDD = 0;
  let running = startingBankroll;
  const sorted = [...settled].sort((a, b) =>
    (a.settled_date || a.created_date || '').localeCompare(b.settled_date || b.created_date || '')
  );
  for (const o of sorted) {
    running += (o.netProfit || 0);
    if (running > peak) peak = running;
    const dd = running - peak;
    if (dd < maxDD) maxDD = dd;
  }

  // Longest losing streak
  let longestLosingStreak = 0;
  let currentStreak = 0;
  for (const o of sorted) {
    if (o.result === 'lost') {
      currentStreak++;
      if (currentStreak > longestLosingStreak) longestLosingStreak = currentStreak;
    } else if (o.result === 'won') {
      currentStreak = 0;
    }
  }

  return {
    openExposure: totalExposure,
    paperExposure,
    liveExposure,
    layLiability,
    dailyPL,
    weeklyPL,
    totalPL,
    drawdown: maxDD,
    longestLosingStreak,
    activeOrderCount: openOrders.length,
    unmatchedOrderCount: unmatchedOrders.length,
    settledCount: settled.length,
  };
}