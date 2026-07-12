import { detectMarketType } from './marketClusterer';
import { normalizedMarketId } from './raceExposure';
import { applyCanonicalRaceIdentity, canonicalRaceIdentity } from './raceIdentity';

export function getRaceKey(market, index = 0) {
  const key=canonicalRaceIdentity(market).canonicalRaceKey;
  return key.includes(':unknown:0:unknown') ? (normalizedMarketId(market) || `isolated-market-${index}`) : key;
}

export function groupRaceDayData(markets = [], runners = []) {
  const marketsById = new Map();
  const runnersByMarketId = new Map();
  const racesByRaceKey = new Map();
  applyCanonicalRaceIdentity(markets).forEach((market, index) => {
    const marketId = normalizedMarketId(market);
    const raceKey = getRaceKey(market, index);
    const type = detectMarketType(market);
    const hasPriceData = market.hasPriceData || runners.some(r => String(r.marketId || r.betfairMarketId) === marketId && (r.bestBackPrice > 0 || r.bestLayPrice > 0));
    const prepared = { ...market, raceKey, hasPriceData };
    marketsById.set(marketId, prepared);
    const identity=canonicalRaceIdentity(market);
    if (!racesByRaceKey.has(raceKey)) racesByRaceKey.set(raceKey, { raceKey, canonicalRaceKey:raceKey, eventId:identity.eventId || null, betfairEventId:identity.betfairEventId || null, eventName:market.eventName || identity.venue || market.marketName || marketId, venue:identity.venue, raceNumber:identity.raceNumber, startTime:identity.startTime, markets: [], winMarkets: [], placeMarkets: [], h2hMarkets: [], otherMarkets: [] });
    const race = racesByRaceKey.get(raceKey);
    race.markets.push(prepared);
    if (type === 'WIN') race.winMarkets.push(prepared); else if (type === 'PLACE') race.placeMarkets.push(prepared); else if (type === 'H2H') race.h2hMarkets.push(prepared); else race.otherMarkets.push(prepared);
  });
  runners.forEach(runner => {
    const marketId = String(runner.marketId || runner.betfairMarketId || '');
    if (!runnersByMarketId.has(marketId)) runnersByMarketId.set(marketId, []);
    runnersByMarketId.get(marketId).push(runner);
  });
  const races = [...racesByRaceKey.values()];
  const uniqueMarkets = [...marketsById.values()];
  const typeCount = type => uniqueMarkets.filter(m => detectMarketType(m) === type).length;
  return { marketsById, runnersByMarketId, racesByRaceKey, summary: { totalMarketsLoaded: uniqueMarkets.length, uniqueWinMarketCount: typeCount('WIN'), uniquePlaceMarketCount: typeCount('PLACE'), uniqueH2HMarketCount: typeCount('H2H'), unknownMarketCount:typeCount('UNKNOWN'), totalUniqueMarketCount:uniqueMarkets.length, totalRacesLoaded: races.length, totalRunnerCount: runners.length, winMarketsLoaded: typeCount('WIN'), placeMarketsLoaded: typeCount('PLACE'), h2hMarketsLoaded: typeCount('H2H'), totalRunnersLoaded: runners.length, marketsWithInitialPrices: uniqueMarkets.filter(m => m.hasPriceData || runners.some(r => String(r.marketId) === String(m.id || m.betfairMarketId) && (r.bestBackPrice > 0 || r.bestLayPrice > 0))).length, racesWithWinMarket: races.filter(r => r.winMarkets.length).length, racesWithPlaceMarket: races.filter(r => r.placeMarkets.length).length, racesWithH2HMarket: races.filter(r => r.h2hMarkets.length).length } };
}