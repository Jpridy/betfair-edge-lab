/**
 * Frontend Betfair API service.
 *
 * Makes direct browser-to-Betfair API calls using the user's SSOID.
 * This bypasses Cloudflare blocks on cloud server IPs because the request
 * comes from the user's residential IP with a real browser TLS fingerprint.
 *
 * The app key is fetched from the backend (it's not a true secret — Betfair
 * expects it in client-side headers per their documentation).
 */

import { base44 } from '@/api/base44Client';

let _config = null;

export async function getBetfairConfig() {
  if (_config) return _config;
  const res = await base44.functions.invoke('betfairLogin', {});
  if (res.data?.status === 'success') {
    _config = res.data;
    return _config;
  }
  throw new Error(res.data?.error || 'Failed to get Betfair config');
}

/**
 * Log in to Betfair using username and password.
 * Attempts direct browser-to-Betfair login first (bypasses Cloudflare blocks
 * on cloud server IPs). Falls back to a CORS proxy if the direct call is blocked.
 * Returns account info on success, throws on failure.
 */
export async function loginWithCredentials(username, password) {
  const config = await getBetfairConfig();
  const loginBody = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const directUrl = 'https://identitysso.betfair.com/api/login';
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(directUrl)}`;

  let loginData = null;
  let lastError = '';

  // Attempt 1: Direct browser-to-Betfair login
  try {
    const loginRes = await fetch(directUrl, {
      method: 'POST',
      headers: {
        'X-Application': config.appKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: loginBody,
    });
    const loginText = await loginRes.text();

    if (!loginText.includes('<!DOCTYPE') && !loginText.includes('<html')) {
      try {
        loginData = JSON.parse(loginText);
      } catch { lastError = `Unexpected response (HTTP ${loginRes.status})`; }
    } else {
      lastError = 'Cloudflare blocked the direct request';
    }
  } catch (err) {
    lastError = 'CORS blocked the direct request';
  }

  // Attempt 2: CORS proxy fallback
  if (!loginData) {
    try {
      const proxyRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'X-Application': config.appKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: loginBody,
      });
      const proxyText = await proxyRes.text();

      if (!proxyText.includes('<!DOCTYPE') && !proxyText.includes('<html')) {
        try { loginData = JSON.parse(proxyText); } catch { lastError = `Proxy returned unexpected response (HTTP ${proxyRes.status})`; }
      } else {
        lastError = 'Cloudflare blocked the proxy request too';
      }
    } catch (err) {
      lastError = `Proxy request failed: ${err.message}`;
    }
  }

  if (!loginData) {
    throw new Error(`Could not reach Betfair login. ${lastError}. Please use the SSOID method: log into betfair.com, copy the "ssoid" cookie from DevTools, and paste it in Settings.`);
  }

  if (loginData.status !== 'SUCCESS' || !loginData.token) {
    throw new Error(`Betfair login failed: ${loginData.error || 'Invalid credentials'}`);
  }

  // Login succeeded — validate the session token by fetching account funds
  return await validateSsoid(loginData.token);
}

/**
 * Validate an SSOID by fetching account funds.
 * Returns account info if valid, throws if invalid.
 */
export async function validateSsoid(ssoid) {
  const config = await getBetfairConfig();

  const fundsRes = await fetch(`${config.apiBase}/exchange/account/rest/v1.0/getAccountFunds/`, {
    method: 'POST',
    headers: {
      'X-Authentication': ssoid,
      'X-Application': config.appKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: '{}',
  });

  if (!fundsRes.ok) {
    const text = await fundsRes.text();
    if (fundsRes.status === 401 || text.includes('UNAUTHORIZED') || text.includes('INVALID_SESSION') || text.includes('NO_SESSION')) {
      throw new Error('SSOID is invalid or expired. Log into betfair.com again and get a fresh SSOID.');
    }
    // If we get HTML (Cloudflare block), CORS is blocking browser-side calls too
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error('Betfair API is blocking browser requests (CORS/Cloudflare). This may require a different network configuration.');
    }
    throw new Error(`Betfair API error (HTTP ${fundsRes.status})`);
  }

  const funds = await fundsRes.json();
  if (funds?.error) {
    throw new Error(`Betfair: ${funds.error}${funds.errorCode ? ` (${funds.errorCode})` : ''}`);
  }

  // Get account details (currency, name)
  let details = null;
  try {
    const detailsRes = await fetch(`${config.apiBase}/exchange/account/rest/v1.0/getAccountDetails/`, {
      method: 'POST',
      headers: {
        'X-Authentication': ssoid,
        'X-Application': config.appKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: '{}',
    });
    if (detailsRes.ok) details = await detailsRes.json();
  } catch (e) {
    // Optional
  }

  return {
    sessionToken: ssoid,
    jurisdiction: config.jurisdiction,
    balance: funds?.availableToBetBalance ?? null,
    exposure: funds?.exposure ?? null,
    exposureLimit: funds?.exposureLimit ?? null,
    discountRate: funds?.discountRate ?? null,
    pointsBalance: funds?.pointsBalance ?? null,
    currency: details?.currencyCode ?? null,
    firstName: details?.firstName ?? null,
    lastName: details?.lastName ?? null,
    locale: details?.localeCode ?? null,
  };
}

/**
 * Fetch live horse racing markets and runner prices.
 * Returns { markets, runners, fetchedAt, isDelayed }.
 */
export async function fetchBetfairMarkets(ssoid) {
  const config = await getBetfairConfig();
  const bettingBase = `${config.apiBase}/exchange/betting/rest/v1.0`;

  const authHeaders = {
    'X-Authentication': ssoid,
    'X-Application': config.appKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Date range: midnight today to midnight tomorrow+1
  const now = new Date();
  const fromTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const toTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();

  // 1. List Market Catalogue — Horse Racing (eventType 7), WIN markets
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

  const catalogueRes = await fetch(`${bettingBase}/listMarketCatalogue/`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(catalogueBody),
  });

  const catalogueText = await catalogueRes.text();

  if (catalogueText.includes('UNAUTHORIZED') || catalogueText.includes('INVALID_SESSION') || catalogueText.includes('NO_SESSION')) {
    return { status: 'error', sessionExpired: true, error: 'Betfair SSOID expired' };
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

  const bookRes = await fetch(`${bettingBase}/listMarketBook/`, {
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
      const bPrice = bBook?.ex?.availableToLay?.[0]?.price || 9999;
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