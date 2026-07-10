import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useApp } from '@/lib/AppContext';
import { groupRaceDayData } from '@/lib/raceDayLoader';
import { clearRaceDayCache, getRaceDayCache, loadRaceDayCache, setRacePacks, updateRaceDayDynamic } from '@/lib/raceDayCache';
import { buildRacePackCache, clearRacePackAiCache } from '@/lib/racePackCache';
import { selectMarketsForRefresh } from '@/lib/dynamicMarketUpdater';
import { requestForcedRaceScan, scheduleRaceScan } from '@/lib/raceScanScheduler';
import { setCachedExternalSearch } from '@/lib/externalSearchCache';

export default function useRaceDayManager() {
  const app = useApp();
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState('idle');
  const lastRefreshRef = useRef({});
  const researchPrewarmedRef = useRef(new Set());
  const cacheClearedRef = useRef(false);
  const sync = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (!app.markets.length || cacheClearedRef.current) return;
    const cache = getRaceDayCache();
    if (!cache.loadedAt) {
      const grouped = groupRaceDayData(app.markets, app.runners);
      const packs = buildRacePackCache(grouped.racesByRaceKey, app.runners);
      loadRaceDayCache({ markets: app.markets, runners: app.runners, racePacksByRaceKey: packs, fetchedAt: app.betfairConnection.lastCatalogueRefreshAt || new Date().toISOString(), jurisdiction: 'AU' });
      setRacePacks(packs); sync();
    } else {
      updateRaceDayDynamic({ markets: app.markets, runners: app.runners, source: app.betfairConnection.streamConnectionStatus === 'connected' ? 'stream' : 'rest_book', updatedAt: app.betfairConnection.lastMarketSyncTime || new Date().toISOString() }); sync();
    }
  }, [app.markets, app.runners, app.betfairConnection.lastCatalogueRefreshAt, app.betfairConnection.lastMarketSyncTime, app.betfairConnection.streamConnectionStatus, sync]);

  const refreshNearby = useCallback(async (force = true) => {
    const cache = getRaceDayCache(); if (!app.betfairSessionToken || !cache.loadedAt) return { error: 'Load Race Day first' };
    const races = [...cache.racesByRaceKey.values()];
    const ids = selectMarketsForRefresh(races, { windowStart: app.featherlessSettings.timeWindowStart, lastRefreshByRace: lastRefreshRef.current, force, maxMarkets: 40 });
    if (!ids.length) return { updatedMarkets: 0 };
    setStatus('refreshing');
    const response = await base44.functions.invoke('betfairMarkets', { action: 'refresh_nearby_races', sessionToken: app.betfairSessionToken, marketIds: ids, maxMarkets: 40 });
    if (response.data?.error) { setStatus('error'); return response.data; }
    updateRaceDayDynamic({ markets: response.data.marketStatusUpdates, runners: response.data.runnerPriceUpdates, source: 'rest_book', updatedAt: response.data.fetchedAt });
    const refreshed = new Set(ids); const now = Date.now(); races.forEach(race => { if (race.markets.some(m => refreshed.has(String(m.betfairMarketId || m.id)))) lastRefreshRef.current[race.raceKey] = now; });
    setStatus('ready'); sync(); return { updatedMarkets: response.data.marketStatusUpdates?.length || 0 };
  }, [app.betfairSessionToken, app.featherlessSettings.timeWindowStart, sync]);

  useEffect(() => { if (!app.apiConnected) return; const timer = setInterval(() => refreshNearby(false), 5000); return () => clearInterval(timer); }, [app.apiConnected, refreshNearby]);
  useEffect(() => { const timer = setInterval(sync, 15000); return () => clearInterval(timer); }, [sync]);
  useEffect(() => {
    if (!app.featherlessSettings.externalSearchEnabled || !app.betfairSessionToken) return;
    const cache = getRaceDayCache(); const within = (app.featherlessSettings.prewarmOpenAIWithinMinutes || 30) * 60;
    const race = [...cache.racesByRaceKey.values()].find(r => { const seconds = r.startTime ? (new Date(r.startTime).getTime() - Date.now()) / 1000 : null; return seconds > 0 && seconds <= within && !researchPrewarmedRef.current.has(r.raceKey); });
    if (!race) return; researchPrewarmedRef.current.add(race.raceKey);
    const market = race.winMarkets[0] || race.placeMarkets[0] || race.h2hMarkets[0]; const marketId = String(market?.betfairMarketId || market?.id || ''); const runners = cache.runnersByMarketId.get(marketId) || [];
    base44.functions.invoke('openAIWebSearch', { market, runners, settings: app.featherlessSettings }).then(response => { const result = response.data?.externalSearchResult; if (result) setCachedExternalSearch(race.eventId, race.eventName, race.startTime, runners, result, (app.featherlessSettings.racePackCacheTtlMinutes || 30) * 60000); }).catch(() => {});
  }, [version, app.betfairSessionToken, app.featherlessSettings]);
  const load = async () => { cacheClearedRef.current = false; clearRaceDayCache(); clearRacePackAiCache(); setStatus('loading'); const result = await app.refreshBetfairData(); setStatus(result?.error ? 'error' : 'ready'); return result; };
  const manualNext = async () => { requestForcedRaceScan(); clearRacePackAiCache(); await refreshNearby(true); return app.runManualScan(); };
  const debugNext = async () => { requestForcedRaceScan(); await refreshNearby(true); return app.runDebugScanCycle(); };
  const clear = () => { cacheClearedRef.current = true; clearRaceDayCache(); clearRacePackAiCache(); setStatus('idle'); sync(); };
  const cache = getRaceDayCache();
  const schedule = scheduleRaceScan(cache.racesByRaceKey, { windowStart: app.featherlessSettings.timeWindowStart, windowEnd: app.featherlessSettings.timeWindowEnd });
  return { version, status, cache, schedule, load, refreshNearby, manualNext, debugNext, clear };
}