/**
 * Derives all performance chart data from live settled paper orders.
 * Replaces static DEMO_* constants with database-driven values.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getOrderDate(o) {
  return o.settled_date || o.matched_date || o.placed_date || o.created_date;
}

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch { return null; }
}

function getMonthLabel(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return MONTH_NAMES[d.getMonth()];
  } catch { return null; }
}

/**
 * Equity curve from plData (already derived in AppContext).
 * Returns [{ label, bankroll, pl }]
 */
export function buildEquityCurve(plData) {
  if (!plData || plData.length === 0) return [];
  return plData.map(p => ({
    label: p.label || (p.date ? p.date.slice(5) : ''),
    bankroll: Math.round(p.bankroll * 100) / 100,
    pl: Math.round((p.pl || 0) * 100) / 100,
  }));
}

/**
 * Monthly growth from settled orders grouped by month.
 * Returns [{ month, netPL, growth }]
 */
export function buildMonthlyGrowth(settledOrders, startingBankroll) {
  if (!settledOrders || settledOrders.length === 0) return [];
  const byMonth = {};
  for (const o of settledOrders) {
    const key = getMonthKey(getOrderDate(o));
    if (!key) continue;
    if (!byMonth[key]) byMonth[key] = { month: getMonthLabel(getOrderDate(o)), netPL: 0 };
    byMonth[key].netPL += (o.netProfit || 0);
  }
  const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
  let running = startingBankroll;
  return sorted.map(([key, val]) => {
    const prevRunning = running;
    running += val.netPL;
    const growth = prevRunning > 0 ? (val.netPL / prevRunning) * 100 : 0;
    return { month: val.month, netPL: Math.round(val.netPL * 100) / 100, growth: Math.round(growth * 100) / 100 };
  });
}

/**
 * Win/loss distribution grouped by strategy.
 * Returns [{ strategy, wins, losses }]
 */
export function buildWinLossDistribution(settledOrders) {
  if (!settledOrders || settledOrders.length === 0) return [];
  const byStrategy = {};
  for (const o of settledOrders) {
    const name = o.strategyName || 'Unknown';
    if (!byStrategy[name]) byStrategy[name] = { strategy: name, wins: 0, losses: 0 };
    if (o.result === 'won') byStrategy[name].wins++;
    else if (o.result === 'lost') byStrategy[name].losses++;
  }
  return Object.values(byStrategy).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));
}

/**
 * Drawdown curve from plData.
 * Returns [{ label, drawdown }]
 */
export function buildDrawdownCurve(plData) {
  if (!plData || plData.length === 0) return [];
  let peak = plData[0].bankroll - (plData[0].pl || 0);
  return plData.map(p => {
    if (p.bankroll > peak) peak = p.bankroll;
    const dd = p.bankroll - peak;
    return { label: p.label || (p.date ? p.date.slice(5) : ''), drawdown: Math.round(dd * 100) / 100 };
  });
}

/**
 * CLV over time per strategy — each settled order's CLV plotted chronologically.
 * Returns [{ strategyName, data: [{ trade, clv }] }]
 */
export function buildCLVByStrategy(settledOrders) {
  if (!settledOrders || settledOrders.length === 0) return [];
  const byStrategy = {};
  for (const o of settledOrders) {
    const name = o.strategyName || 'Unknown';
    if (!byStrategy[name]) byStrategy[name] = [];
    byStrategy[name].push(o);
  }
  return Object.entries(byStrategy).map(([name, orders]) => {
    const sorted = orders.filter(o => Number.isFinite(Number(o.closingOdds)) && Number(o.closingOdds) > 1).slice().sort((a, b) => (getOrderDate(a) || '').localeCompare(getOrderDate(b) || ''));
    const data = sorted.map((o, i) => ({
      trade: `T${i + 1}`,
      clv: Math.round((o.clv || 0) * 100) / 100,
    }));
    const avgCLV = sorted.length > 0 ? sorted.reduce((s, o) => s + (o.clv || 0), 0) / sorted.length : 0;
    return { strategyName: name, avgCLV: Math.round(avgCLV * 100) / 100, data };
  }).filter(s => s.data.some(d => d.clv !== 0));
}

/**
 * Strike rate over time per strategy — rolling strike rate after each settled order.
 * Returns [{ strategyName, currentRate, data: [{ trade, rate }] }]
 */
export function buildStrikeRateByStrategy(settledOrders) {
  if (!settledOrders || settledOrders.length === 0) return [];
  const byStrategy = {};
  for (const o of settledOrders) {
    const name = o.strategyName || 'Unknown';
    if (!byStrategy[name]) byStrategy[name] = [];
    byStrategy[name].push(o);
  }
  return Object.entries(byStrategy).map(([name, orders]) => {
    const sorted = orders.slice().sort((a, b) => (getOrderDate(a) || '').localeCompare(getOrderDate(b) || ''));
    let wins = 0;
    const data = sorted.map((o, i) => {
      if (o.result === 'won') wins++;
      return { trade: `T${i + 1}`, rate: Math.round((wins / (i + 1)) * 1000) / 10 };
    });
    const currentRate = sorted.length > 0 ? (wins / sorted.length) * 100 : 0;
    return { strategyName: name, currentRate: Math.round(currentRate * 10) / 10, data };
  });
}

const ODDS_RANGES = [
  { label: '1.5-3.0', min: 1.5, max: 3.0 },
  { label: '3.0-5.0', min: 3.0, max: 5.0 },
  { label: '5.0-10.0', min: 5.0, max: 10.0 },
  { label: '10.0-20.0', min: 10.0, max: 20.0 },
  { label: '20.0+', min: 20.0, max: Infinity },
];

/**
 * Profit grouped by odds range.
 * Returns [{ range, profit }]
 */
export function buildProfitByOddsRange(settledOrders) {
  if (!settledOrders || settledOrders.length === 0) return [];
  return ODDS_RANGES.map(r => {
    const profit = settledOrders
      .filter(o => {
        const odds = o.matchedOdds || o.requestedOdds || 0;
        return odds >= r.min && odds < r.max;
      })
      .reduce((s, o) => s + (o.netProfit || 0), 0);
    return { range: r.label, profit: Math.round(profit * 100) / 100 };
  }).filter(r => r.profit !== 0);
}

/**
 * Profit grouped by venue.
 * Returns [{ venue, profit }]
 */
export function buildProfitByVenue(settledOrders) {
  if (!settledOrders || settledOrders.length === 0) return [];
  const byVenue = {};
  for (const o of settledOrders) {
    const venue = o.venue || 'Unknown';
    if (!byVenue[venue]) byVenue[venue] = 0;
    byVenue[venue] += (o.netProfit || 0);
  }
  return Object.entries(byVenue)
    .map(([venue, profit]) => ({ venue, profit: Math.round(profit * 100) / 100 }))
    .sort((a, b) => b.profit - a.profit);
}

/**
 * Profit grouped by side (BACK vs LAY).
 * Returns [{ side, profit }]
 */
export function buildProfitBySide(settledOrders) {
  if (!settledOrders || settledOrders.length === 0) return [];
  const bySide = { BACK: 0, LAY: 0 };
  for (const o of settledOrders) {
    const side = o.side || 'BACK';
    if (!bySide[side]) bySide[side] = 0;
    bySide[side] += (o.netProfit || 0);
  }
  return Object.entries(bySide).map(([side, profit]) => ({ side, profit: Math.round(profit * 100) / 100 }));
}