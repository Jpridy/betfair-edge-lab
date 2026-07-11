import { normalizedMarketId, raceKeyOf } from './raceExposure';

const WIN_TYPES = new Set(['WIN', 'WIN_MARKET']);
const PLACE_TYPES = new Set(['PLACE', 'PLACE_MARKET', 'TO_BE_PLACED', 'TOP_2_FINISH', 'TOP_3_FINISH', 'TOP_4_FINISH']);
const H2H_TYPES = new Set(['MATCH_ODDS', 'MATCH_BET', 'AVB', 'HEAD_TO_HEAD']);

export function detectMarketType(market) {
  const exact = String(market?.marketTypeCode || market?.marketType || '').trim().toUpperCase();
  if (WIN_TYPES.has(exact)) return 'WIN';
  if (PLACE_TYPES.has(exact)) return 'PLACE';
  if (H2H_TYPES.has(exact)) return 'H2H';
  return 'UNKNOWN';
}

export function extractPlaceTerms(market) {
  if (detectMarketType(market) === 'H2H') return 1;
  const exact = String(market?.marketTypeCode || market?.marketType || '').toUpperCase();
  const name = String(market?.marketName || '');
  const match = `${exact} ${name}`.match(/(?:TOP_|TOP\s*|\(|FIRST\s*)([234])/i);
  if (match) return Number(match[1]);
  const runnerCount = Number(market?.numberOfRunners || market?.numberOfActiveRunners || 0);
  return runnerCount >= 16 ? 4 : runnerCount >= 8 ? 3 : 2;
}

const timeDifference = (a, b) => Math.abs(new Date(a || 0).getTime() - new Date(b || 0).getTime());
export function relatedMarketRejectionReason(anchor, candidate, toleranceMs = 10 * 60 * 1000) {
  if (!normalizedMarketId(candidate)) return 'MARKET_ID_MISSING';
  const aEvent = String(anchor?.eventId || anchor?.betfairEventId || '');
  const cEvent = String(candidate?.eventId || candidate?.betfairEventId || '');
  if (aEvent && cEvent && aEvent !== cEvent) return 'EVENT_ID_MISMATCH';
  if (anchor?.raceNumber && candidate?.raceNumber && Number(anchor.raceNumber) !== Number(candidate.raceNumber)) return 'RACE_NUMBER_MISMATCH';
  const aStart = anchor?.startTime || anchor?.marketStartTime;
  const cStart = candidate?.startTime || candidate?.marketStartTime;
  if (aStart && cStart && timeDifference(aStart, cStart) > toleranceMs) return 'START_TIME_MISMATCH';
  if (detectMarketType(candidate) === 'UNKNOWN') return 'UNSUPPORTED_MARKET_TYPE';
  return null;
}

export function clusterMarketsByEvent(markets = []) {
  const clusters = new Map();
  const seenMarketIds = new Set();
  for (const market of markets) {
    const marketId = normalizedMarketId(market);
    if (!marketId || seenMarketIds.has(marketId)) continue;
    seenMarketIds.add(marketId);
    const raceKey = raceKeyOf(market);
    if (!clusters.has(raceKey)) clusters.set(raceKey, { raceKey, eventId:market.eventId || market.betfairEventId || null, eventTypeId:market.eventTypeId || null, eventName:market.eventName || '', venue:market.venue || '', startTime:market.startTime || market.marketStartTime || null, raceNumber:market.raceNumber || 0, markets:[], winMarkets:[], placeMarkets:[], h2hMarkets:[], otherMarkets:[], rejectedRelatedMarkets:[] });
    const cluster = clusters.get(raceKey);
    const prepared = { ...market, normalizedMarketId:marketId, detectedMarketType:detectMarketType(market) };
    cluster.markets.push(prepared);
    if (prepared.detectedMarketType === 'WIN') cluster.winMarkets.push(prepared);
    else if (prepared.detectedMarketType === 'PLACE') cluster.placeMarkets.push(prepared);
    else if (prepared.detectedMarketType === 'H2H') cluster.h2hMarkets.push(prepared);
    else { cluster.otherMarkets.push(prepared); cluster.rejectedRelatedMarkets.push({marketId, reason:'UNSUPPORTED_MARKET_TYPE', marketTypeCode:market.marketTypeCode || market.marketType || 'UNKNOWN'}); }
  }
  return [...clusters.values()];
}

export function getPrimaryMarket(cluster) {
  const wins = (cluster?.winMarkets || []).map((market, catalogueIndex) => ({ market, catalogueIndex })).sort((a, b) => {
    const exact = Number(String(b.market.marketTypeCode || b.market.marketType).toUpperCase() === 'WIN') - Number(String(a.market.marketTypeCode || a.market.marketType).toUpperCase() === 'WIN');
    if (exact) return exact;
    const single = Number(Number(b.market.numberOfWinners) === 1) - Number(Number(a.market.numberOfWinners) === 1);
    if (single) return single;
    const liquidity = Number(b.market.totalMatched || 0) - Number(a.market.totalMatched || 0);
    if (liquidity) return liquidity;
    if (a.catalogueIndex !== b.catalogueIndex) return a.catalogueIndex - b.catalogueIndex;
    return normalizedMarketId(a.market).localeCompare(normalizedMarketId(b.market));
  });
  return wins[0]?.market || cluster?.placeMarkets?.[0] || cluster?.h2hMarkets?.[0] || null;
}
export function getAllMarketsInCluster(cluster) { return [...(cluster?.winMarkets || []), ...(cluster?.placeMarkets || []), ...(cluster?.h2hMarkets || []), ...(cluster?.otherMarkets || [])]; }

export function rejectedRelatedMarkets(cluster, catalogueMarkets = []) {
  const anchor = getPrimaryMarket(cluster) || getAllMarketsInCluster(cluster)[0];
  if (!anchor) return [];
  const clusterIds = new Set(getAllMarketsInCluster(cluster).map(normalizedMarketId));
  return catalogueMarkets.filter(candidate => !clusterIds.has(normalizedMarketId(candidate))).flatMap(candidate => {
    const sameEvent = String(candidate.eventId || candidate.betfairEventId || '') === String(anchor.eventId || anchor.betfairEventId || '');
    const sameVenueRace = String(candidate.venue || '').toLowerCase() === String(anchor.venue || '').toLowerCase() && Number(candidate.raceNumber || 0) === Number(anchor.raceNumber || 0);
    if (!sameEvent && !sameVenueRace) return [];
    const reason = relatedMarketRejectionReason(anchor, candidate);
    return reason ? [{ marketId:normalizedMarketId(candidate) || null, marketTypeCode:candidate.marketTypeCode || candidate.marketType || 'UNKNOWN', reason }] : [];
  });
}

export function marketCoverage(cluster, runners = []) {
  const markets = getAllMarketsInCluster(cluster);
  const unique = new Map(markets.map(m => [normalizedMarketId(m), m]));
  const count = type => [...unique.values()].filter(m => detectMarketType(m) === type).length;
  return { catalogueMarketsFound:unique.size, uniqueMarketIds:[...unique.keys()], uniqueWinMarketCount:count('WIN'), uniquePlaceMarketCount:count('PLACE'), uniqueH2HMarketCount:count('H2H'), unknownMarketCount:count('UNKNOWN'), totalUniqueMarketCount:unique.size, totalRunnerCount:runners.length, runnersPerMarket:Object.fromEntries([...unique.keys()].map(id=>[id,runners.filter(r=>normalizedMarketId(r)===id).length])), marketsRejectedBeforeEngine:cluster?.rejectedRelatedMarkets?.length || 0, rejectionReasons:cluster?.rejectedRelatedMarkets || [] };
}