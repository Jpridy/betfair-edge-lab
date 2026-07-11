import { groupRaceDayData } from './raceDayLoader';

const emptyStore = () => ({ loadedForDate: null, loadedAt: null, jurisdiction: 'AU', marketsById: new Map(), runnersByMarketId: new Map(), racesByRaceKey: new Map(), racePacksByRaceKey: new Map(), dynamicBooksByMarketId: new Map(), lastCatalogueRefreshAt: null, lastBookRefreshAt: null, lastStreamUpdateAt: null, dataSourceSummary: {}, loadErrors: [], freshnessWarnings: [], summary: {} });
let store = emptyStore();

export function loadRaceDayCache({ markets, runners, racePacksByRaceKey = new Map(), fetchedAt, jurisdiction = 'AU', errors = [] }) {
  const grouped = groupRaceDayData(markets, runners);
  store = { ...emptyStore(), ...grouped, racePacksByRaceKey, loadedForDate: (fetchedAt || new Date().toISOString()).slice(0, 10), loadedAt: fetchedAt || new Date().toISOString(), jurisdiction, lastCatalogueRefreshAt: fetchedAt || new Date().toISOString(), loadErrors: errors, summary: grouped.summary };
  return getRaceDayCache();
}

export function getRaceDayCache() { return store; }
export function clearRaceDayCache() { store = emptyStore(); return store; }
export function setRacePacks(racePacksByRaceKey) { store.racePacksByRaceKey = racePacksByRaceKey; }
export function markRaceScanned(raceKey, at = Date.now(), priceHash = '', cycleNumber = null) { const race = store.racesByRaceKey.get(raceKey); if (race) { race.lastScannedAt = at; race.lastScannedPriceHash = priceHash; race.cyclesScannedOnThisRace = Number(race.cyclesScannedOnThisRace || 0) + 1; const seen = cycleNumber ?? race.cyclesScannedOnThisRace; if (race.firstCycleSeenForRace == null) race.firstCycleSeenForRace = seen; race.latestCycleSeenForRace = seen; } return race || null; }

export function updateRaceDayDynamic({ markets = [], runners = [], source = 'rest_book', updatedAt = new Date().toISOString() }) {
  markets.forEach(update => { const id = String(update.betfairMarketId || update.marketId || update.id); const current = store.marketsById.get(id); const merged = current ? { ...current, ...update, source, lastUpdateAt: updatedAt, lastBookRefreshAt: source === 'stream' ? current.lastBookRefreshAt : updatedAt, lastStreamUpdateAt: source === 'stream' ? updatedAt : current.lastStreamUpdateAt } : null; if (merged) store.marketsById.set(id, merged); for (const race of store.racesByRaceKey.values()) race.markets = race.markets.map(m => String(m.betfairMarketId || m.id) === id ? (merged || m) : m); store.dynamicBooksByMarketId.set(id, { ...(store.dynamicBooksByMarketId.get(id) || {}), ...update, source, lastUpdateAt: updatedAt }); });
  runners.forEach(update => { const id = String(update.marketId || update.betfairMarketId || ''); const list = store.runnersByMarketId.get(id) || []; store.runnersByMarketId.set(id, list.map(r => String(r.betfairSelectionId || r.selectionId) === String(update.selectionId || update.betfairSelectionId) ? { ...r, ...update, source, lastUpdateAt: updatedAt } : r)); });
  if (source === 'stream') store.lastStreamUpdateAt = updatedAt; else store.lastBookRefreshAt = updatedAt;
}

export function pruneRaceDayCache({ orders = [], retentionHours = 6, now = Date.now() } = {}) {
  const protectedIds = new Set(orders.filter(o => o.status === 'awaiting_result' || o.settlementStatus === 'awaiting_result').map(o => String(o.betfairMarketId || o.marketId)));
  for (const [key, race] of store.racesByRaceKey) {
    const start = race.startTime ? new Date(race.startTime).getTime() : now;
    const needed = race.markets.some(m => protectedIds.has(String(m.betfairMarketId || m.id)));
    if (!needed && start < now - retentionHours * 3600000) { store.racesByRaceKey.delete(key); store.racePacksByRaceKey.delete(key); }
  }
  return store.racesByRaceKey.size;
}