import { describe, it, expect } from 'vitest';
import { groupRaceDayData, getRaceKey } from './raceDayLoader';
import { buildRacePackCache, buildDynamicPriceHash, getCachedAiResult, setCachedAiResult, hasMajorPriceMove } from './racePackCache';
import { scheduleRaceScan } from './raceScanScheduler';
import { applyMarketBookUpdates, selectMarketsForRefresh } from './dynamicMarketUpdater';
import { loadRaceDayCache, pruneRaceDayCache } from './raceDayCache';

const start = ms => new Date(Date.now() + ms).toISOString();
const market = (id, type, ms = 120000) => {
  const raceStart = start(ms);
  return {
    id,
    betfairMarketId: id,
    eventId: 'e1',
    eventName: 'Race 1',
    venue: 'Eagle Farm',
    raceNumber: 1,
    marketName: type,
    marketTypeCode: type,
    startTime: raceStart,
    marketStartTime: raceStart,
    status: 'OPEN',
    inPlay: false,
    hasPriceData: true,
    lastUpdateAt: new Date().toISOString(),
  };
};
const runner = (marketId, id = '1', price = 3) => ({
  id: `${marketId}_${id}`,
  marketId,
  betfairSelectionId: id,
  runnerName: `Runner ${id}`,
  status: 'ACTIVE',
  bestBackPrice: price,
  bestBackSize: 20,
  bestLayPrice: price + 0.1,
  bestLaySize: 20,
});

const onlyRaceKey = grouped => [...grouped.racesByRaceKey.keys()][0];

describe('race day cache architecture', () => {
  it('groups WIN PLACE and H2H into one race', () => {
    const raceStart = start(120000);
    const markets = [market('w', 'WIN'), market('p', 'PLACE'), market('h', 'MATCH_BET')].map(item => ({ ...item, startTime: raceStart, marketStartTime: raceStart }));
    const grouped = groupRaceDayData(markets, [runner('w')]);
    expect(grouped.summary).toMatchObject({ totalRacesLoaded: 1, winMarketsLoaded: 1, placeMarketsLoaded: 1, h2hMarketsLoaded: 1 });
  });

  it('never groups unrelated fallback markets under unknown', () => {
    expect(getRaceKey({ id: 'a' })).toBe('a');
    expect(getRaceKey({ id: 'b' })).toBe('b');
  });

  it('builds one static pack per canonical race and hydrates separately', () => {
    const grouped = groupRaceDayData([market('w', 'WIN')], [runner('w')]);
    const key = onlyRaceKey(grouped);
    const packs = buildRacePackCache(grouped.racesByRaceKey, [runner('w')]);
    expect(packs.size).toBe(1);
    expect(packs.get(key).staticMarkets).toHaveLength(1);
  });

  it('scheduler selects nearest race inside window', () => {
    const grouped = groupRaceDayData([market('w', 'WIN', 120000)], [runner('w')]);
    const key = onlyRaceKey(grouped);
    expect(scheduleRaceScan(grouped.racesByRaceKey).selectedRaceForScan.raceKey).toBe(key);
  });

  it('scheduler ignores missing start time for automatic scans', () => {
    const item = market('w', 'WIN');
    delete item.startTime;
    delete item.marketStartTime;
    const grouped = groupRaceDayData([item], []);
    expect(scheduleRaceScan(grouped.racesByRaceKey).selectedRaceForScan).toBeNull();
  });

  it('reports the next window when no race is inside', () => {
    const grouped = groupRaceDayData([market('w', 'WIN', 3600000)], []);
    const result = scheduleRaceScan(grouped.racesByRaceKey);
    expect(result.selectedRaceForScan).toBeNull();
    expect(result.nextRaceWindowOpensAt).toBeTruthy();
  });

  it('calculates the next window across UTC and Brisbane date boundaries', () => {
    const now = new Date('2026-07-11T13:58:00.000Z').getTime();
    const startTime = '2026-07-11T14:08:00.000Z';
    const race = { raceKey: 'boundary', startTime, markets: [{ ...market('boundary', 'WIN'), startTime, marketStartTime: startTime }] };
    const result = scheduleRaceScan(new Map([['boundary', race]]), { now, windowStart: 500, windowEnd: 30 });
    expect(result.nextRace?.raceKey).toBe('boundary');
    expect(result.nextRaceWindowOpensAt).toBe('2026-07-11T13:59:40.000Z');
  });

  it('refreshes only selected nearby market ids', () => {
    const grouped = groupRaceDayData([market('w', 'WIN', 120000), { ...market('later', 'WIN', 10800000), eventId: 'e2' }], []);
    expect(selectMarketsForRefresh([...grouped.racesByRaceKey.values()], { force: true })).toEqual(['w']);
  });

  it('hydrates dynamic book values without replacing names', () => {
    const result = applyMarketBookUpdates([market('w', 'WIN')], [runner('w')], {
      marketStatusUpdates: [{ marketId: 'w', totalMatched: 99 }],
      runnerPriceUpdates: [{ marketId: 'w', selectionId: '1', bestBackPrice: 2.5 }],
    });
    expect(result.markets[0].eventName).toBe('Race 1');
    expect(result.runners[0].bestBackPrice).toBe(2.5);
  });

  it('reuses AI within TTL and invalidates changed hashes', () => {
    setCachedAiResult('e1', { ok: true }, 'a', 90, 1000);
    expect(getCachedAiResult('e1', 'a', 90, 2000)).toBeTruthy();
    expect(getCachedAiResult('e1', 'b', 90, 2000)).toBeNull();
  });

  it('detects major price movement', () => {
    expect(hasMajorPriceMove([runner('w', '1', 2)], [runner('w', '1', 4)], 5)).toBe(true);
    expect(buildDynamicPriceHash([], [runner('w')])).toContain('w');
  });

  it('pruning retains races with awaiting settlement', () => {
    const old = market('old', 'WIN', -10 * 3600000);
    old.eventId = 'oldRace';
    loadRaceDayCache({ markets: [old], runners: [], fetchedAt: new Date().toISOString() });
    const orders = [{ marketId: 'old', status: 'awaiting_result' }];
    pruneRaceDayCache({ orders, retentionHours: 6 });
    expect(pruneRaceDayCache({ orders, retentionHours: 6 })).toBe(1);
  });
});
