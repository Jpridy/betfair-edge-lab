export function getRaceRefreshTier(secondsToJump, windowStart = 500) {
  if (secondsToJump > 0 && secondsToJump <= windowStart) return { intervalSeconds: 5, tier: 'active_window' };
  if (secondsToJump > 0 && secondsToJump <= 1800) return { intervalSeconds: 15, tier: 'within_30_minutes' };
  if (secondsToJump > 0 && secondsToJump <= 7200) return { intervalSeconds: 60, tier: 'within_2_hours' };
  return { intervalSeconds: null, tier: 'later' };
}

export function selectMarketsForRefresh(races = [], { now = Date.now(), windowStart = 500, lastRefreshByRace = {}, force = false, maxMarkets = 40 } = {}) {
  const selected = [];
  for (const race of races) {
    if (!race.startTime) continue;
    const seconds = Math.round((new Date(race.startTime).getTime() - now) / 1000);
    const tier = getRaceRefreshTier(seconds, windowStart);
    if (!tier.intervalSeconds) continue;
    const last = lastRefreshByRace[race.raceKey] || 0;
    if (force || now - last >= tier.intervalSeconds * 1000) selected.push(...race.markets.map(m => String(m.betfairMarketId || m.id)));
    if (selected.length >= maxMarkets) break;
  }
  return [...new Set(selected)].slice(0, maxMarkets);
}

export function applyMarketBookUpdates(markets, runners, response, updatedAt = new Date().toISOString()) {
  const marketUpdates = response?.marketStatusUpdates || [];
  const runnerUpdates = response?.runnerPriceUpdates || [];
  const nextMarkets = markets.map(m => { const u = marketUpdates.find(x => String(x.marketId) === String(m.betfairMarketId || m.id)); return u ? { ...m, ...u, source: 'rest_book', lastUpdateAt: updatedAt, lastBookRefreshAt: updatedAt } : m; });
  const nextRunners = runners.map(r => { const u = runnerUpdates.find(x => String(x.marketId) === String(r.marketId) && String(x.selectionId) === String(r.betfairSelectionId || r.selectionId)); return u ? { ...r, ...u, source: 'rest_book', lastUpdateAt: updatedAt } : r; });
  return { markets: nextMarkets, runners: nextRunners, updatedMarkets: marketUpdates.length, updatedRunners: runnerUpdates.length };
}