import { buildStaticRacePack, hydrateRacePackForScan } from './racePackBuilder';
import { countTicksBetween } from './tickLadder';

const aiCache = new Map();

export function buildRacePackCache(racesByRaceKey, runners) {
  const packs = new Map();
  for (const [raceKey, race] of racesByRaceKey) packs.set(raceKey, buildStaticRacePack(race, runners));
  return packs;
}

export function hydrateCachedRacePack(staticPack, context) { return hydrateRacePackForScan(staticPack, context); }
export function getCachedAiResult(raceKey, dynamicPriceHash, ttlSeconds = 90, now = Date.now()) { const hit = aiCache.get(raceKey); return hit && hit.expiresAt > now && hit.dynamicPriceHash === dynamicPriceHash ? hit : null; }
export function setCachedAiResult(raceKey, result, dynamicPriceHash, ttlSeconds = 90, now = Date.now()) { const entry = { raceKey, featherlessResult: result, featherlessCalledAt: new Date(now).toISOString(), dynamicPriceHash, expiresAt: now + ttlSeconds * 1000 }; aiCache.set(raceKey, entry); return entry; }
export function clearRacePackAiCache() { aiCache.clear(); }
export function getRaceAiCache(raceKey, currentRunners = [], thresholdTicks = 5, rerunOnMove = true, now = Date.now()) { const hit = aiCache.get(raceKey); if (!hit || hit.expiresAt <= now) return null; if (rerunOnMove && hasMajorPriceMove(hit.runnersSnapshot || [], currentRunners, thresholdTicks)) return null; return hit; }
export function setRaceAiCache(raceKey, result, currentRunners = [], ttlSeconds = 90, now = Date.now()) { const entry = { raceKey, featherlessResult: result, featherlessCalledAt: new Date(now).toISOString(), inputHash: buildDynamicPriceHash([], currentRunners), dynamicPriceHash: buildDynamicPriceHash([], currentRunners), runnersSnapshot: currentRunners.map(r => ({ marketId: r.marketId, selectionId: r.betfairSelectionId || r.selectionId, status: r.status, bestBackPrice: r.bestBackPrice, bestLayPrice: r.bestLayPrice })), expiresAt: now + ttlSeconds * 1000 }; aiCache.set(raceKey, entry); return entry; }

export function buildDynamicPriceHash(markets = [], runners = []) { return JSON.stringify({ m: markets.map(m => [m.id || m.betfairMarketId, m.status, m.inPlay]), r: runners.map(r => [r.marketId, r.betfairSelectionId || r.selectionId, r.status, r.bestBackPrice || 0, r.bestLayPrice || 0]) }); }
export function hasMajorPriceMove(previousRunners = [], currentRunners = [], thresholdTicks = 5) { const previous = new Map(previousRunners.map(r => [`${r.marketId}:${r.betfairSelectionId || r.selectionId}`, r])); return currentRunners.some(r => { const old = previous.get(`${r.marketId}:${r.betfairSelectionId || r.selectionId}`); if (!old) return false; return countTicksBetween(old.bestBackPrice || old.bestLayPrice || 0, r.bestBackPrice || r.bestLayPrice || 0) >= thresholdTicks || old.status !== r.status; }); }