// Unified risk and exposure calculations — single source of truth.
// Used by AppContext, RiskManager, RiskOverview, Orders, PerformanceAnalytics, Dashboard, Sidebar, Bot.
import { isActiveExposureOrder, reconcileRiskExposure } from './riskExposure';
const UNMATCHED_STATUSES = ['unmatched', 'partially_matched'];

/**
 * Calculate comprehensive risk metrics from paper orders.
 *
 * BACK exposure = matched stake (or requested stake if unmatched/pending)
 * LAY exposure/liability = stake × (odds - 1)
 *
 * @param {array} paperOrders - All paper orders
 * @param {object} settings - App settings (uses dailyResetAt if present)
 * @returns {object} Risk metrics
 */
export function calculateRiskMetrics(paperOrders, settings = {}) {
  const settled = paperOrders.filter(o => o.status === 'settled');
  const openOrders = paperOrders.filter(isActiveExposureOrder);
  const unmatchedOrders = paperOrders.filter(o => UNMATCHED_STATUSES.includes(o.status));
  const reconciledExposure=reconcileRiskExposure(paperOrders);

  // ── Separate BACK and LAY exposure ──
  const backOrders = openOrders.filter(o => (o.side || '').toUpperCase() === 'BACK');
  const layOrders = openOrders.filter(o => (o.side || '').toUpperCase() === 'LAY');

  // BACK exposure: matched stake, or requested stake if unmatched/pending
  const backExposure = backOrders.reduce((s, o) => {
    const isUnmatched = UNMATCHED_STATUSES.includes(o.status) || o.status === 'pending';
    return s + (isUnmatched ? (o.requestedStake || o.requested_size || 0) : (o.matchedStake || o.matched_size || o.requestedStake || 0));
  }, 0);

  // LAY liability: stake × (odds - 1) — this is the real risk for lay bets
  const layLiability = layOrders.reduce((s, o) => {
    const stake = o.matchedStake || o.matched_size || o.requestedStake || 0;
    const odds = o.matchedOdds || o.average_price_matched || o.requestedOdds || 0;
    return s + (Number(o.liability) > 0 ? Number(o.liability) : (odds > 1 ? stake * (odds - 1) : 0));
  }, 0);

  // ── Paper vs Live exposure ──
  const paperExposure = openOrders
    .filter(o => o.paper_mode !== false && o.liveMode !== true)
    .reduce((s, o) => {
      const isLAY = (o.side || '').toUpperCase() === 'LAY';
      const stake = o.matchedStake || o.matched_size || o.requestedStake || 0;
      const odds = o.matchedOdds || o.average_price_matched || o.requestedOdds || 0;
      return s + (isLAY ? (odds > 1 ? stake * (odds - 1) : 0) : stake);
    }, 0);

  const liveExposure = openOrders
    .filter(o => o.liveMode === true)
    .reduce((s, o) => {
      const isLAY = (o.side || '').toUpperCase() === 'LAY';
      const stake = o.matchedStake || o.matched_size || o.requestedStake || 0;
      const odds = o.matchedOdds || o.average_price_matched || o.requestedOdds || 0;
      return s + (isLAY ? (odds > 1 ? stake * (odds - 1) : 0) : stake);
    }, 0);

  // Total exposure = back exposure + lay liability (for all open orders)
  const totalExposure = backExposure + layLiability;

  // ── P/L Calculations ──
  const totalPL = settled.reduce((s, o) => s + (o.netProfit || 0), 0);

  // Daily reset cutoff — if set, only count orders settled after that timestamp
  const dailyResetAt = settings.dailyResetAt || null;
  const today = new Date().toISOString().slice(0, 10);

  const dailyPL = settled
    .filter(o => {
      const settledDate = o.settled_date || o.created_date || '';
      if (dailyResetAt) {
        return settledDate >= dailyResetAt;
      }
      return settledDate.slice(0, 10) === today;
    })
    .reduce((s, o) => s + (o.netProfit || 0), 0);

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weeklyPL = settled
    .filter(o => (o.settled_date || o.created_date || '') >= weekAgo)
    .reduce((s, o) => s + (o.netProfit || 0), 0);

  // ── Drawdown — peak-to-trough from starting bankroll ──
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

  // Daily counters (orders settled today or after reset)
  const dailySettled = settled.filter(o => {
    const settledDate = o.settled_date || o.created_date || '';
    return dailyResetAt ? settledDate >= dailyResetAt : settledDate.slice(0, 10) === today;
  });
  const dailyOrders = dailySettled.length;
  const dailyRejected = paperOrders.filter(o => {
    if (o.status !== 'rejected') return false;
    const createdDate = o.created_date || o.placed_date || '';
    return dailyResetAt ? createdDate >= dailyResetAt : createdDate.slice(0, 10) === today;
  }).length;

  return {
    backExposure,
    layLiability,
    paperExposure,
    liveExposure,
    openExposure: totalExposure,
    totalExposure,
    dailyPL,
    weeklyPL,
    totalPL,
    drawdown: maxDD,
    longestLosingStreak,
    activeOrderCount:reconciledExposure.activeOrderCount,
    unresolvedMatchedOrderCount:reconciledExposure.unresolvedMatchedOrderCount,
    totalBackExposure:reconciledExposure.totalBackExposure,
    totalLayLiability:reconciledExposure.totalLayLiability,
    exposureByRace:reconciledExposure.exposureByRace,
    exposureByMarket:reconciledExposure.exposureByMarket,
    unmatchedOrderCount: unmatchedOrders.length,
    settledCount: settled.length,
    dailyOrders,
    dailyRejected,
  };
}