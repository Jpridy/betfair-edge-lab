/**
 * Frontend Betfair API service.
 *
 * All Betfair API calls are routed through a Cloudflare Worker proxy
 * (BETFAIR_PROXY_URL) which:
 *   1. Runs on Cloudflare's edge network → bypasses Betfair's Cloudflare bot protection
 *   2. Adds CORS headers → allows the browser to read the responses
 *
 * Login is done server-side (betfairLogin backend function) through the same proxy.
 * Market data is fetched browser-side through the proxy.
 */

import { base44 } from '@/api/base44Client';
import { BetfairStreamClient } from '@/lib/betfairStream';

let _config = null;

export async function getBetfairConfig() {
  if (_config) return _config;
  const res = await base44.functions.invoke('betfairLogin', {});
  if (res.data?.appKey) {
    _config = res.data;
    return _config;
  }
  throw new Error(res.data?.error || 'Failed to get Betfair config');
}

/**
 * Connect to Betfair using a session token obtained from the browser.
 * The user logs into Betfair in their browser, retrieves their session token,
 * and pastes it here. This bypasses the login flow entirely (Betfair's login
 * endpoints block serverless/cloud IPs).
 */
export async function connectWithSessionToken(sessionToken) {
  let res;
  try {
    res = await base44.functions.invoke('betfairLogin', { sessionToken });
  } catch (err) {
    throw new Error(err.response?.data?.error || `Connection failed (${err.response?.status || err.message}). Try refreshing the page and pasting a fresh session token.`);
  }
  const data = res.data;

  if (data.status === 'error') {
    throw new Error(data.error);
  }

  _config = data;

  return {
    sessionToken: data.sessionToken,
    jurisdiction: data.jurisdiction,
    balance: data.account?.balance ?? null,
    exposure: data.account?.exposure ?? null,
    exposureLimit: data.account?.exposureLimit ?? null,
    discountRate: data.account?.discountRate ?? null,
    pointsBalance: data.account?.pointsBalance ?? null,
    currency: data.account?.currency ?? null,
    firstName: data.account?.firstName ?? null,
    lastName: data.account?.lastName ?? null,
    locale: data.account?.locale ?? null,
  };
}

/**
 * Connect to Betfair by logging in through the backend (which uses the proxy).
 * Returns account info + session token on success, throws on failure.
 */
export async function connectToBetfair(username, password) {
  const res = await base44.functions.invoke('betfairLogin', { username, password });
  const data = res.data;

  if (data.status === 'error') {
    throw new Error(data.error);
  }

  _config = data;

  return {
    sessionToken: data.sessionToken,
    jurisdiction: data.jurisdiction,
    balance: data.account?.balance ?? null,
    exposure: data.account?.exposure ?? null,
    exposureLimit: data.account?.exposureLimit ?? null,
    discountRate: data.account?.discountRate ?? null,
    pointsBalance: data.account?.pointsBalance ?? null,
    currency: data.account?.currency ?? null,
    firstName: data.account?.firstName ?? null,
    lastName: data.account?.lastName ?? null,
    locale: data.account?.locale ?? null,
  };
}

/**
 * Create a real-time stream connection to Betfair's Stream API.
 * Uses WebSocket — bypasses CORS and WAF (browser TLS fingerprint passes).
 * Returns the BetfairStreamClient instance for lifecycle management.
 */
export async function createBetfairStream(sessionToken, callbacks) {
  const config = await getBetfairConfig();
  const client = new BetfairStreamClient(config.appKey, sessionToken, config.jurisdiction, config.proxyUrl);
  client.onMarketsUpdate = callbacks.onMarketsUpdate;
  client.onStatusChange = callbacks.onStatusChange;
  client.onError = callbacks.onError;
  client.onMarketSettled = callbacks.onMarketSettled;
  client.onHeartbeat = callbacks.onHeartbeat;
  client.connect();
  return { client, config };
}

function parseRaceNumber(marketName, eventName) {
  const text = `${marketName || ''} ${eventName || ''}`;
  const match = text.match(/\bR(\d+)\b/i);
  return match ? parseInt(match[1], 10) : 0;
}

/** Build a proxied URL for browser-to-Betfair calls */
function proxied(targetUrl, config) {
  if (config.proxyUrl) {
    return `${config.proxyUrl}?url=${encodeURIComponent(targetUrl)}`;
  }
  return targetUrl;
}

/**
 * Fetch live horse racing markets and runner prices.
 * Returns { status, markets, runners, fetchedAt, isDelayed }.
 */
export async function fetchBetfairMarkets(ssoid) {
  const config = await getBetfairConfig();

  if (!config.proxyUrl) {
    return { status: 'error', error: 'BETFAIR_PROXY_URL not configured. Market data requires the Cloudflare Worker proxy.' };
  }

  const bettingBase = `${config.apiBase}/exchange/betting/rest/v1.0`;

  const authHeaders = {
    'X-Authentication': ssoid,
    'X-Application': config.appKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const now = new Date();
  const fromTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const toTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();

  // 1. List Market Catalogue
  const catalogueBody = {
    filter: {
      eventTypeIds: ['7'],
      marketTypeCodes: ['WIN'],
      marketStartTime: { from: fromTime, to: toTime },
    },
    maxResults: '50',
    sort: 'FIRST_TO_START',
    marketProjection: ['EVENT', 'MARKET_DESCRIPTION', 'RUNNER_METADATA', 'RUNNER_DESCRIPTION', 'MARKET_START_TIME'],
  };

  const catalogueRes = await fetch(proxied(`${bettingBase}/listMarketCatalogue/`, config), {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(catalogueBody),
  });

  const catalogueText = await catalogueRes.text();

  if (catalogueText.includes('UNAUTHORIZED') || catalogueText.includes('INVALID_SESSION') || catalogueText.includes('NO_SESSION')) {
    return { status: 'error', sessionExpired: true, error: 'Betfair session expired' };
  }

  if (!catalogueRes.ok) {
    return { status: 'error', error: `Catalogue fetch failed (HTTP ${catalogueRes.status})` };
  }

  let catalogues;
  try { catalogues = JSON.parse(catalogueText); } catch {
    return { status: 'error', error: 'Betfair returned non-JSON response for catalogue' };
  }

  if (!Array.isArray(catalogues) || catalogues.length === 0) {
    return { status: 'success', markets: [], runners: [], fetchedAt: new Date().toISOString() };
  }

  // 2. List Market Book — get live prices
  const marketIds = catalogues.map(c => c.marketId);
  const bookBody = {
    marketIds,
    priceProjection: { priceData: ['EX_BEST_OFFERS', 'EX_TRADED'], virtualise: 'true' },
  };

  const bookRes = await fetch(proxied(`${bettingBase}/listMarketBook/`, config), {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(bookBody),
  });

  let books = [];
  if (bookRes.ok) {
    try { books = await bookRes.json(); } catch { books = []; }
  }

  // 3. Transform into app format
  const markets = [];
  const runners = [];

  for (const cat of catalogues) {
    const book = books.find(b => b.marketId === cat.marketId);
    if (!book) continue;
    if (book.status === 'CLOSED' || book.status === 'SETTLED') continue;

    const venue = cat.event?.venue || '';
    const eventName = cat.event?.name || '';
    const marketName = cat.marketName || eventName || cat.marketId;

    markets.push({
      id: cat.marketId,
      betfairMarketId: cat.marketId,
      eventType: 'Horse Racing',
      country: cat.event?.countryCode || '',
      venue,
      eventName,
      marketName,
      marketType: cat.description?.marketType || 'WIN',
      startTime: cat.marketStartTime || cat.description?.marketTime || null,
      marketStartTime: cat.marketStartTime || cat.description?.marketTime || null,
      raceNumber: parseRaceNumber(marketName, eventName),
      status: book.status || 'OPEN',
      inPlay: book.inplay || false,
      totalMatched: book.totalMatched || 0,
      numberOfRunners: (cat.runners || []).length,
      watched: false,
    });

    const sortedRunners = [...(cat.runners || [])].sort((a, b) => {
      const aBook = book.runners?.find(r => r.selectionId === a.selectionId);
      const bBook = book.runners?.find(r => r.selectionId === b.selectionId);
      const aPrice = aBook?.ex?.availableToBack?.[0]?.price || 9999;
      const bPrice = bBook?.ex?.availableToBack?.[0]?.price || 9999;
      return aPrice - bPrice;
    });

    for (let idx = 0; idx < sortedRunners.length; idx++) {
      const runner = sortedRunners[idx];
      const runnerBook = book.runners?.find(r => r.selectionId === runner.selectionId);
      const bestBack = runnerBook?.ex?.availableToBack?.[0];
      const bestLay = runnerBook?.ex?.availableToLay?.[0];
      const lastTraded = runnerBook?.lastPriceTraded;
      const tradedVol = runnerBook?.totalMatched || 0;
      const bestBackPrice = bestBack?.price || 0;
      const bestLayPrice = bestLay?.price || 0;
      const impliedProb = bestBackPrice > 0 ? (1 / bestBackPrice) * 100 : 0;

      runners.push({
        id: `${cat.marketId}_${runner.selectionId}`,
        marketId: cat.marketId,
        betfairSelectionId: String(runner.selectionId),
        runnerName: runner.runnerName || `Selection ${runner.selectionId}`,
        horseNumber: runner.sortPriority || 0,
        status: runnerBook?.status || runner.status || 'ACTIVE',
        bestBackPrice,
        bestBackSize: bestBack?.size || 0,
        bestLayPrice,
        bestLaySize: bestLay?.size || 0,
        lastTradedPrice: lastTraded || 0,
        tradedVolume: tradedVol,
        impliedProbability: impliedProb,
        favouriteRank: idx + 1,
        isFavourite: idx === 0,
        isOutsider: idx === sortedRunners.length - 1,
      });
    }
  }

  return {
    status: 'success',
    markets,
    runners,
    fetchedAt: new Date().toISOString(),
    isDelayed: books[0]?.isMarketDataDelayed || false,
  };
}