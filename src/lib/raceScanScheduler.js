import { summarizeRaceFreshness } from './marketFreshness';

let forceNextScan = false;
export function requestForcedRaceScan() { forceNextScan = true; }
export function consumeForcedRaceScan() { const value = forceNextScan; forceNextScan = false; return value; }

export function scheduleRaceScan(racesInput, { now = Date.now(), windowStart = 500, windowEnd = 30, forceNext = false, recentScanMs = 90000 } = {}) {
  const races = (racesInput instanceof Map ? [...racesInput.values()] : racesInput || []).map(race => {
    const startMs = race.startTime ? new Date(race.startTime).getTime() : NaN;
    const secondsToJump = Number.isFinite(startMs) ? Math.round((startMs - now) / 1000) : null;
    const openMarkets = race.markets.filter(m => m.status === 'OPEN' && !m.inPlay);
    const hasValidPrices = openMarkets.some(m => m.hasPriceData || m.runners?.some(r => r.bestBackPrice > 0 || r.bestLayPrice > 0));
    return { ...race, secondsToJump, openMarkets, hasValidPrices, freshnessStatus: summarizeRaceFreshness(openMarkets, now) };
  });
  const timed = races.filter(r => r.secondsToJump != null).sort((a, b) => a.secondsToJump - b.secondsToJump);
  const inside = timed.filter(r => r.secondsToJump > windowEnd && r.secondsToJump <= windowStart && r.openMarkets.length && r.hasValidPrices);
  const eligible = inside.filter(r => !r.lastScannedAt || now - r.lastScannedAt >= recentScanMs);
  const selected = forceNext ? timed.find(r => r.secondsToJump > 0 && r.openMarkets.length && r.hasValidPrices) : (eligible.find(r => r.freshnessStatus === 'fresh') || eligible[0] || null);
  const nextRace = timed.find(r => r.secondsToJump > windowStart && r.openMarkets.length) || timed.find(r => r.secondsToJump > 0) || null;
  return { racesLoaded: races.length, racesAwaitingWindow: timed.filter(r => r.secondsToJump > windowStart).length, racesInsideWindow: inside.length, racesTooLate: timed.filter(r => r.secondsToJump <= windowEnd && r.secondsToJump > 0).length, racesAlreadyClosed: races.filter(r => !r.openMarkets.length || (r.secondsToJump != null && r.secondsToJump <= 0)).length, missingStartTime: races.filter(r => r.secondsToJump == null).length, nextRace, selectedRaceForScan: selected, selectionReason: selected ? (forceNext ? 'Manual scan selected next cached race' : 'Nearest OPEN cached race inside scan window') : (races.some(r => !r.startTime) ? 'No cached race currently inside scan window; missing-start races are cached but not auto-scannable' : 'No cached race currently inside scan window'), nextRaceWindowOpensAt: nextRace?.startTime ? new Date(new Date(nextRace.startTime).getTime() - windowStart * 1000).toISOString() : null };
}