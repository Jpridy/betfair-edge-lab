import { detectMarketType } from './marketClusterer';

export function getRaceKey(market, index = 0) {
  const eventId = String(market?.eventId || market?.betfairEventId || '').trim();
  if (eventId) return eventId;
  const place = String(market?.venue || market?.eventName || '').trim();
  const start = market?.marketStartTime || market?.startTime;
  if (place && start) return `${place}:${start}`;
  const marketId = String(market?.betfairMarketId || market?.marketId || market?.id || '').trim();
  return marketId || `isolated-market-${index}`;
}

export function groupRaceDayData(markets = [], runners = []) {
  const marketsById = new Map();
  const runnersByMarketId = new Map();
  const racesByRaceKey = new Map();
  markets.forEach((market, index) => {
    const marketId = String(market.betfairMarketId || market.marketId || market.id);
    const raceKey = getRaceKey(market, index);
    const type = detectMarketType(market);
    const hasPriceData = market.hasPriceData || runners.some(r => String(r.marketId || r.betfairMarketId) === marketId && (r.bestBackPrice > 0 || r.bestLayPrice > 0));
    const prepared = { ...market, raceKey, hasPriceData };
    marketsById.set(marketId, prepared);
    if (!racesByRaceKey.has(raceKey)) racesByRaceKey.set(raceKey, { raceKey, eventId: market.eventId || market.betfairEventId || null, eventName: market.eventName || market.venue || market.marketName || marketId, venue: market.venue || '', raceNumber: market.raceNumber || 0, startTime: market.marketStartTime || market.startTime || null, markets: [], winMarkets: [], placeMarkets: [], h2hMarkets: [], otherMarkets: [] });
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
  const typeCount = type => markets.filter(m => detectMarketType(m) === type).length;
  return { marketsById, runnersByMarketId, racesByRaceKey, summary: { totalMarketsLoaded: markets.length, winMarketsLoaded: typeCount('WIN'), placeMarketsLoaded: typeCount('PLACE'), h2hMarketsLoaded: typeCount('H2H'), totalRacesLoaded: races.length, totalRunnersLoaded: runners.length, marketsWithInitialPrices: markets.filter(m => m.hasPriceData || runners.some(r => String(r.marketId) === String(m.id || m.betfairMarketId) && (r.bestBackPrice > 0 || r.bestLayPrice > 0))).length, racesWithWinMarket: races.filter(r => r.winMarkets.length).length, racesWithPlaceMarket: races.filter(r => r.placeMarkets.length).length, racesWithH2HMarket: races.filter(r => r.h2hMarkets.length).length } };
}