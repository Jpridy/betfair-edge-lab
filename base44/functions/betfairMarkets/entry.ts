import { createClientFromRequest } from 'npm:@base44/sdk@0.8.37';

// ── Betfair API endpoints ──
// AU/NZ: https://api.betfair.com.au  (CORRECT)
// Global: https://api.betfair.com
// NEVER use https://api-au.betfair.com — it returns HTML 403
const ENDPOINT_AU = 'https://api.betfair.com.au';
const ENDPOINT_GLOBAL = 'https://api.betfair.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized — please log in again.' }, { status: 401 });

    const appKey = Deno.env.get("BETFAIR_APP_KEY");
    const jurisdiction = Deno.env.get("BETFAIR_JURISDICTION") || "AU";
    const proxyUrl = Deno.env.get("BETFAIR_PROXY_URL");

    let body;
    try { body = await req.json(); } catch { body = {}; }

    const sessionToken = body?.sessionToken;
    const action = body?.action;
    // Optional override from request body — allowed values: https://api.betfair.com.au | https://api.betfair.com
    const envApiBase = [ENDPOINT_AU, ENDPOINT_GLOBAL].includes(body?.apiBase) ? body.apiBase : null;

    // Determine the configured endpoint
    const configuredApiBase = envApiBase || (jurisdiction === 'AU' ? ENDPOINT_AU : ENDPOINT_GLOBAL);

    // ── Endpoint validation helper ──
    // Calls listEventTypes (lightweight) to verify the endpoint works.
    async function testEndpoint(apiBase) {
      const requestUrl = `${apiBase}/exchange/betting/rest/v1.0/listEventTypes/`;
      const headers = {
        'X-Application': appKey,
        'X-Authentication': sessionToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      const bodyStr = JSON.stringify({ filter: {} });

      const result = {
        apiBase,
        requestUrl,
        httpStatus: null,
        contentType: null,
        responseLooksJson: false,
        responseLooksHtml: false,
        betfairErrorCode: null,
        success: false,
        firstResponseSnippet: null,
        failureReason: null,
      };

      try {
        const proxyFetchUrl = `${proxyUrl}?url=${encodeURIComponent(requestUrl)}`;
        const res = await fetch(proxyFetchUrl, {
          method: 'POST',
          headers,
          body: bodyStr,
        });
        const text = await res.text();
        result.httpStatus = res.status;
        result.contentType = res.headers.get('content-type') || '';
        result.firstResponseSnippet = text.slice(0, 500);

        // HTML detection — Betfair WAF returns HTML on wrong endpoint or blocked proxy
        const looksHtml = text.trimStart().startsWith('<!DOCTYPE html') ||
                          text.includes('<html') ||
                          text.includes('<title>Betfair</title>');
        result.responseLooksHtml = looksHtml;

        if (looksHtml) {
          result.failureReason = 'BETFAIR_HTML_403_WRONG_ENDPOINT_OR_WAF';
          return result;
        }

        // Try to parse as JSON
        let parsed;
        try {
          parsed = JSON.parse(text);
          result.responseLooksJson = true;
        } catch {
          result.failureReason = 'Response is not JSON and not HTML — unknown format';
          return result;
        }

        // Betfair SOAP-style fault (ANGX-xxxx errors)?
        // Format: {"faultcode":"Client","faultstring":"ANGX-0003","detail":{"APINGException":{"errorCode":"INVALID_SESSION_INFORMATION"}}}
        if (parsed && typeof parsed === 'object' && parsed.faultcode) {
          const apingErr = parsed.detail?.APINGException;
          const errorCode = apingErr?.errorCode || parsed.faultstring || 'UNKNOWN_FAULT';
          result.betfairErrorCode = errorCode;
          if (errorCode.includes('INVALID_SESSION') || errorCode.includes('NO_SESSION')) {
            result.failureReason = 'Session token expired or invalid (INVALID_SESSION_INFORMATION)';
          } else {
            result.failureReason = `Betfair API fault: ${errorCode}`;
          }
          return result;
        }

        // Betfair error object?
        if (parsed && typeof parsed === 'object' && parsed.error) {
          const errStr = JSON.stringify(parsed);
          if (errStr.includes('INVALID_SESSION') || errStr.includes('NO_SESSION')) {
            result.betfairErrorCode = 'INVALID_SESSION';
            result.failureReason = 'Session token expired or invalid';
          } else {
            result.betfairErrorCode = parsed.error;
            result.failureReason = `Betfair API error: ${JSON.stringify(parsed.error).slice(0, 200)}`;
          }
          return result;
        }

        // Success — got a JSON array (listEventTypes returns an array)
        if (Array.isArray(parsed)) {
          result.success = true;
          return result;
        }

        result.failureReason = 'JSON response but unexpected structure';
        return result;
      } catch (err) {
        result.failureReason = `Network/proxy error: ${err.message}`;
        return result;
      }
    }

    // ── Action: test_direct_fetch ──
    // Tests whether Deno Deploy can reach Betfair directly WITHOUT a proxy
    if (action === 'test_direct_fetch') {
      const results = [];
      const endpoints = [ENDPOINT_AU, ENDPOINT_GLOBAL];

      for (const ep of endpoints) {
        const requestUrl = `${ep}/exchange/betting/rest/v1.0/listEventTypes/`;
        const r = {
          apiBase: ep,
          requestUrl,
          httpStatus: null,
          contentType: null,
          responseLooksJson: false,
          responseLooksHtml: false,
          success: false,
          snippet: null,
          failureReason: null,
        };

        try {
          const res = await fetch(requestUrl, {
            method: 'POST',
            headers: {
              'X-Application': appKey || 'test',
              'X-Authentication': sessionToken || 'test',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ filter: {} }),
          });
          const text = await res.text();
          r.httpStatus = res.status;
          r.contentType = res.headers.get('content-type') || '';
          r.snippet = text.slice(0, 300);
          r.responseLooksHtml = text.trimStart().startsWith('<!DOCTYPE') || text.includes('<html');

          if (!r.responseLooksHtml) {
            try {
              const parsed = JSON.parse(text);
              r.responseLooksJson = true;
              if (Array.isArray(parsed)) r.success = true;
              if (parsed?.error) r.failureReason = JSON.stringify(parsed.error).slice(0, 200);
            } catch {
              r.failureReason = 'Non-JSON, non-HTML response';
            }
          } else {
            r.failureReason = 'HTML 403 — WAF blocked direct fetch';
          }
        } catch (err) {
          r.failureReason = `Direct fetch error: ${err.message}`;
        }
        results.push(r);
      }

      const working = results.find(r => r.success);
      return Response.json({
        status: 'success',
        action: 'test_direct_fetch',
        results,
        workingApiBase: working?.apiBase || null,
        message: working
          ? 'Direct fetch from Deno Deploy WORKS — no proxy needed!'
          : 'Direct fetch blocked — still need an external proxy',
      }, { status: 200 });
    }

    // ── Action: diagnose_endpoint ──
    if (action === 'diagnose_endpoint') {
      if (!appKey || !sessionToken || !proxyUrl) {
        return Response.json({
          status: 'error',
          error: 'Missing prerequisites for endpoint diagnostic',
          sessionTokenPresent: !!sessionToken,
          appKeyPresent: !!appKey,
          proxyUrlPresent: !!proxyUrl,
          endpoints: [],
        }, { status: 200 });
      }

      const endpointsToTest = body?.testBothEndpoints
        ? [configuredApiBase, ENDPOINT_AU, ENDPOINT_GLOBAL]
        : [configuredApiBase];

      // Deduplicate
      const seen = new Set();
      const uniqueEndpoints = endpointsToTest.filter(e => {
        if (seen.has(e)) return false;
        seen.add(e);
        return true;
      });

      const endpointResults = [];
      let workingApiBase = null;

      for (const ep of uniqueEndpoints) {
        const r = await testEndpoint(ep);
        endpointResults.push(r);
        if (r.success && !workingApiBase) {
          workingApiBase = ep;
        }
      }

      return Response.json({
        status: 'success',
        action: 'diagnose_endpoint',
        configuredApiBase,
        endpoints: endpointResults,
        workingApiBase,
        html403Detected: endpointResults.some(r => r.responseLooksHtml),
        sessionTokenPresent: !!sessionToken,
        appKeyPresent: !!appKey,
        proxyUrlPresent: !!proxyUrl,
      }, { status: 200 });
    }

    // ── Action: list_market_types ──
    // Discovers what market types actually exist for horse racing
    if (action === 'list_market_types') {
      if (!appKey || !sessionToken || !proxyUrl) {
        return Response.json({ status: 'error', error: 'Missing prerequisites', sessionTokenPresent: !!sessionToken, appKeyPresent: !!appKey, proxyUrlPresent: !!proxyUrl }, { status: 200 });
      }

      const now = new Date();
      const fromTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const toTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();

      const mtBody = {
        filter: {
          eventTypeIds: ['7'],
          marketStartTime: { from: fromTime, to: toTime },
        },
      };

      const requestUrl = `${configuredApiBase}/exchange/betting/rest/v1.0/listMarketTypes/`;
      const proxyFetchUrl = `${proxyUrl}?url=${encodeURIComponent(requestUrl)}`;
      const res = await fetch(proxyFetchUrl, {
        method: 'POST',
        headers: { 'X-Application': appKey, 'X-Authentication': sessionToken, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(mtBody),
      });
      const text = await res.text();
      const looksHtml = text.trimStart().startsWith('<!DOCTYPE html') || text.includes('<html');

      if (looksHtml) {
        return Response.json({ status: 'error', errorCode: 'BETFAIR_HTML_RESPONSE', message: 'Betfair returned HTML instead of JSON', httpStatus: res.status, contentType: res.headers.get('content-type'), apiBase: configuredApiBase, responseSnippet: text.slice(0, 500) }, { status: 200 });
      }

      let parsed;
      try { parsed = JSON.parse(text); } catch {
        return Response.json({ status: 'error', error: 'Non-JSON response from listMarketTypes', httpStatus: res.status, responseSnippet: text.slice(0, 300) }, { status: 200 });
      }

      if (parsed?.error) {
        return Response.json({ status: 'error', error: `Betfair error: ${JSON.stringify(parsed.error)}`, sessionExpired: JSON.stringify(parsed.error).includes('INVALID_SESSION') || JSON.stringify(parsed.error).includes('NO_SESSION') }, { status: 200 });
      }

      const marketTypes = Array.isArray(parsed) ? parsed.map(m => m.marketType).filter(Boolean) : [];
      return Response.json({ status: 'success', marketTypes, rawCount: marketTypes.length, apiBase: configuredApiBase }, { status: 200 });
    }

    // ── Default action: fetch markets (catalogue + book) ──
    const errors = [];
    if (!appKey) errors.push('BETFAIR_APP_KEY missing. Configure BETFAIR_APP_KEY secret.');
    if (!sessionToken) errors.push('Betfair session token missing. Open Setup and connect with session token.');
    if (!proxyUrl) errors.push('BETFAIR_PROXY_URL missing. Configure the Railway proxy URL.');

    if (!appKey || !sessionToken || !proxyUrl) {
      return Response.json({
        status: 'error',
        error: errors.join(' '),
        errors,
        markets: [],
        runners: [],
        sessionTokenPresent: !!sessionToken,
        appKeyPresent: !!appKey,
        proxyUrlPresent: !!proxyUrl,
      }, { status: 200 });
    }

    // ── Step 1: Find a working endpoint ──
    // Test the configured endpoint first, then fall back to the other
    const fallbackEndpoints = configuredApiBase === ENDPOINT_AU
      ? [ENDPOINT_AU, ENDPOINT_GLOBAL]
      : [ENDPOINT_GLOBAL, ENDPOINT_AU];

    let workingApiBase = null;
    for (const ep of fallbackEndpoints) {
      const test = await testEndpoint(ep);
      if (test.success) {
        workingApiBase = ep;
        break;
      }
      if (test.responseLooksHtml) {
        errors.push(`Endpoint ${ep} returned HTML 403 (wrong endpoint or WAF block)`);
      }
    }

    if (!workingApiBase) {
      return Response.json({
        status: 'error',
        errorCode: 'NO_WORKING_ENDPOINT',
        error: 'No Betfair API endpoint returned valid JSON. All endpoints returned HTML 403 or errors. Run the Endpoint Diagnostic in Setup Wizard.',
        errors,
        configuredApiBase,
        endpointsTested: fallbackEndpoints,
        markets: [],
        runners: [],
        sessionTokenPresent: !!sessionToken,
        appKeyPresent: !!appKey,
        proxyUrlPresent: !!proxyUrl,
        nextAction: 'Run Betfair Endpoint Diagnostic',
      }, { status: 200 });
    }

    const bettingBase = `${workingApiBase}/exchange/betting/rest/v1.0`;

    // Clean auth headers — only these 4, nothing browser-like
    const authHeaders = {
      'X-Application': appKey,
      'X-Authentication': sessionToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Helper: call Betfair through the proxy
    async function callBetfair(targetUrl, bodyStr) {
      const proxyFetchUrl = `${proxyUrl}?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyFetchUrl, {
        method: 'POST',
        headers: authHeaders,
        body: bodyStr,
      });
      return res;
    }

    // ── Lightweight dynamic-book actions ──
    if (action === 'refresh_market_books' || action === 'refresh_nearby_races') {
      const requestedIds = Array.isArray(body?.marketIds) ? body.marketIds.map(String).filter(Boolean) : [];
      const maxMarkets = Math.min(Number(body?.maxMarkets) || 40, 40);
      const marketIds = requestedIds.slice(0, maxMarkets);
      if (marketIds.length === 0) return Response.json({ status: 'success', fetchedAt: new Date().toISOString(), books: [], runnerPriceUpdates: [], marketStatusUpdates: [], sessionTokenPresent: true, errors: [] });
      const refreshErrors = [];
      const books = [];
      for (let i = 0; i < marketIds.length; i += 10) {
        const ids = marketIds.slice(i, i + 10);
        try {
          const response = await callBetfair(`${bettingBase}/listMarketBook/`, JSON.stringify({ marketIds: ids, priceProjection: { priceData: ['EX_BEST_OFFERS', 'EX_TRADED'], virtualise: 'false' } }));
          const text = await response.text();
          if (text.trimStart().startsWith('<!DOCTYPE') || text.includes('<html')) { refreshErrors.push(`Book batch returned HTML (HTTP ${response.status})`); continue; }
          if (text.includes('INVALID_SESSION') || text.includes('NO_SESSION')) return Response.json({ status: 'error', sessionExpired: true, error: 'Betfair session expired', sessionTokenPresent: true, errors: ['Betfair session expired'] });
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) books.push(...parsed); else refreshErrors.push(`Book batch returned Betfair error: ${JSON.stringify(parsed).slice(0, 160)}`);
        } catch (error) { refreshErrors.push(error.message); }
      }
      const fetchedAt = new Date().toISOString();
      const marketStatusUpdates = books.map(book => ({ marketId: book.marketId, status: book.status, inPlay: book.inplay || false, totalMatched: book.totalMatched || 0, lastUpdateAt: fetchedAt, source: 'rest_book' }));
      const runnerPriceUpdates = books.flatMap(book => (book.runners || []).map(runner => ({ marketId: book.marketId, selectionId: String(runner.selectionId), status: runner.status || 'ACTIVE', bestBackPrice: runner.ex?.availableToBack?.[0]?.price || 0, bestBackSize: runner.ex?.availableToBack?.[0]?.size || 0, bestLayPrice: runner.ex?.availableToLay?.[0]?.price || 0, bestLaySize: runner.ex?.availableToLay?.[0]?.size || 0, lastTradedPrice: runner.lastPriceTraded || 0, tradedVolumeAmount: runner.totalMatched || 0, lastUpdateAt: fetchedAt, source: 'rest_book' })));
      return Response.json({ status: refreshErrors.length ? 'partial' : 'success', action, fetchedAt, books, runnerPriceUpdates, marketStatusUpdates, workingApiBase, sessionTokenPresent: true, errors: refreshErrors });
    }

    // ── Step 2: List Market Catalogue ──
    // Horse Racing (eventType 7). Fetch per market type in 6-hour time chunks
    // with smaller batches
    // to avoid Betfair's TOO_MUCH_DATA (ANGX-0001) error, which triggers when
    // a single listMarketCatalogue call would return too many markets with
    // full runner metadata.
    const requestedMarketTypes = [...new Set(body?.requestedMarketTypes || ['WIN', 'PLACE', 'TO_BE_PLACED', 'MATCH_BET'])];

    const now = new Date();
    const fromTime = body?.fromTime || now.toISOString();
    const toTime = body?.toTime || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    let catalogues = [];
    const catalogueErrors = [];

    // Split the 2-day window into 8 six-hour chunks to avoid TOO_MUCH_DATA.
    // Betfair's ANGX-0001 triggers when the combined response data (markets ×
    // runners × metadata fields) exceeds an internal limit — smaller time
    // windows + smaller maxResults keep each response well under that limit.
    const CHUNK_MS = 6 * 60 * 60 * 1000; // 6 hours
    const timeChunks = [];
    const startMs = new Date(fromTime).getTime();
    const endMs = new Date(toTime).getTime();
    for (let t = startMs; t < endMs; t += CHUNK_MS) {
      timeChunks.push({
        from: new Date(t).toISOString(),
        to: new Date(Math.min(t + CHUNK_MS, endMs)).toISOString(),
      });
    }

    for (const mt of requestedMarketTypes) {
      for (const chunk of timeChunks) {
        const batchBody = {
          filter: {
            eventTypeIds: ['7'],
            marketTypeCodes: [mt],
            marketStartTime: { from: chunk.from, to: chunk.to },
          },
          maxResults: '50',
          sort: 'FIRST_TO_START',
          marketProjection: [
            'EVENT',
            'EVENT_TYPE',
            'MARKET_START_TIME',
            'MARKET_DESCRIPTION',
            'RUNNER_DESCRIPTION',
            'RUNNER_METADATA',
          ],
        };

        try {
          const batchRes = await callBetfair(`${bettingBase}/listMarketCatalogue/`, JSON.stringify(batchBody));
          const batchText = await batchRes.text();

          // HTML detection
          if (batchText.trimStart().startsWith('<!DOCTYPE html') || batchText.includes('<html') || batchText.includes('<title>Betfair</title>')) {
            catalogueErrors.push(`${mt} ${chunk.from.slice(11,16)}: HTML 403`);
            continue;
          }

          // Session expired?
          if (batchText.includes('UNAUTHORIZED') || batchText.includes('INVALID_SESSION') || batchText.includes('NO_SESSION')) {
            return Response.json({ status: 'error', sessionExpired: true, error: 'Betfair session expired', errors: ['Betfair session expired'], markets: [], runners: [] }, { status: 200 });
          }

          if (!batchRes.ok) {
            catalogueErrors.push(`${mt} ${chunk.from.slice(11,16)}: HTTP ${batchRes.status}`);
            continue;
          }

          let batchParsed;
          try { batchParsed = JSON.parse(batchText); } catch {
            catalogueErrors.push(`${mt} ${chunk.from.slice(11,16)}: non-JSON`);
            continue;
          }

          // Betfair error in JSON body?
          if (batchParsed && !Array.isArray(batchParsed) && batchParsed.error) {
            const errStr = JSON.stringify(batchParsed.error);
            if (errStr.includes('INVALID_SESSION') || errStr.includes('NO_SESSION')) {
              return Response.json({ status: 'error', sessionExpired: true, error: 'Betfair session expired', errors: ['Betfair session expired'], markets: [], runners: [] }, { status: 200 });
            }
            catalogueErrors.push(`${mt} ${chunk.from.slice(11,16)}: ${errStr.slice(0, 120)}`);
            continue;
          }

          if (Array.isArray(batchParsed) && batchParsed.length > 0) {
            catalogues = catalogues.concat(batchParsed);
          }
        } catch (err) {
          catalogueErrors.push(`${mt} ${chunk.from.slice(11,16)}: ${err.message}`);
        }
      }
    }

    if (catalogueErrors.length > 0) {
      errors.push(...catalogueErrors);
    }

    // ── Cap at 200 markets max ──
    const MAX_MARKETS = 200;
    if (catalogues.length > MAX_MARKETS) {
      catalogues = catalogues.slice(0, MAX_MARKETS);
    }

    const rawMarketCount = catalogues.length;

    if (!Array.isArray(catalogues) || rawMarketCount === 0) {
      return Response.json({
        status: 'success',
        markets: [],
        runners: [],
        sessionTokenPresent: true,
        fetchedAt: new Date().toISOString(),
        isDelayed: false,
        requestedMarketTypes,
        receivedMarketTypes: [],
        winMarketsReturned: 0,
        placeMarketsReturned: 0,
        h2hMarketsReturned: 0,
        unknownMarketsReturned: 0,
        rawMarketCount: 0,
        rawBookCount: 0,
        workingApiBase,
        errors,
      });
    }

    // ── Step 3: List Market Book — get live prices ──
    // Horse racing markets have many runners (5-20+), so EX_BEST_OFFERS +
    // EX_TRADED + virtualisation triggers TOO_MUCH_DATA even at 40 markets.
    // Request EX_BEST_OFFERS only, no virtualisation, in batches of 10 to
    // keep each response small. Traded volume can be fetched separately
    // for specific markets if needed.
    const marketIds = catalogues.map(c => c.marketId);
    let books = [];
    const BATCH_SIZE = 10;
    for (let i = 0; i < marketIds.length; i += BATCH_SIZE) {
      const batchIds = marketIds.slice(i, i + BATCH_SIZE);
      const bookBody = {
        marketIds: batchIds,
        priceProjection: {
          priceData: ['EX_BEST_OFFERS'],
          virtualise: 'false',
        },
      };
      try {
        const bookRes = await callBetfair(`${bettingBase}/listMarketBook/`, JSON.stringify(bookBody));
        const bookText = await bookRes.text();

        // HTML check on book response too
        if (bookText.trimStart().startsWith('<!DOCTYPE html') || bookText.includes('<html')) {
          errors.push(`listMarketBook batch returned HTML (HTTP ${bookRes.status})`);
          continue;
        }

        if (bookRes.ok) {
          try {
            const batchBooks = JSON.parse(bookText);
            if (Array.isArray(batchBooks)) books = books.concat(batchBooks);
          } catch {
            errors.push(`listMarketBook batch ${Math.floor(i / BATCH_SIZE) + 1} returned non-JSON: ${bookText.slice(0, 200)}`);
          }
        } else {
          // Capture the actual Betfair error — don't just log the HTTP status
          let errorDetail = `HTTP ${bookRes.status}`;
          try {
            const errParsed = JSON.parse(bookText);
            if (errParsed?.detail?.APINGException?.errorCode) {
              errorDetail += ` ${errParsed.detail.APINGException.errorCode}`;
            } else if (errParsed?.faultstring) {
              errorDetail += ` ${errParsed.faultstring}`;
            } else if (errParsed?.error) {
              errorDetail += ` ${JSON.stringify(errParsed.error).slice(0, 150)}`;
            }
          } catch {
            errorDetail += ` ${bookText.slice(0, 150)}`;
          }
          errors.push(`listMarketBook batch ${Math.floor(i / BATCH_SIZE) + 1} (${batchIds.length} ids) failed: ${errorDetail}`);
        }
      } catch (e) {
        errors.push(`listMarketBook batch error: ${e.message}`);
      }
    }

    const rawBookCount = books.length;

    // ── Step 4: Transform into app format ──
    const markets = [];
    const runners = [];
    const receivedMarketTypesSet = new Set();
    let winCount = 0, placeCount = 0, h2hCount = 0, unknownCount = 0;
    let runnersWithBackPrice = 0, runnersWithLayPrice = 0;
    let firstPricedRunner = null;

    for (const cat of catalogues) {
      const book = books.find(b => b.marketId === cat.marketId);
      if (!book) continue;
      if (book.status === 'CLOSED' || book.status === 'SETTLED') continue;

      const venue = cat.event?.venue || '';
      const eventName = cat.event?.name || '';
      const marketName = cat.marketName || eventName || cat.marketId;
      const marketTypeCode = cat.description?.marketType || cat.marketName || 'UNKNOWN';

      receivedMarketTypesSet.add(marketTypeCode);

      const mtUpper = marketTypeCode.toUpperCase();
      if (mtUpper === 'WIN') winCount++;
      else if (mtUpper === 'PLACE' || mtUpper.includes('TO_BE_PLACED')) placeCount++;
      else if (mtUpper === 'MATCH_BET' || mtUpper.includes('HEAD') || mtUpper.includes('H2H') || mtUpper.includes('MATCH')) h2hCount++;
      else unknownCount++;

      markets.push({
        id: cat.marketId,
        betfairMarketId: cat.marketId,
        eventId: cat.event?.id || null,
        betfairEventId: cat.event?.id || null,
        eventType: 'Horse Racing',
        eventTypeId: '7',
        country: cat.event?.countryCode || '',
        venue,
        eventName,
        raceNumber: Number((eventName.match(/R(?:ace)?\s*(\d+)/i) || [])[1]) || 0,
        marketName,
        marketType: cat.description?.marketType || 'UNKNOWN',
        marketTypeCode,
        startTime: cat.marketStartTime || cat.description?.marketTime || null,
        marketStartTime: cat.marketStartTime || cat.description?.marketTime || null,
        status: book.status ? String(book.status).toUpperCase() : 'UNKNOWN',
        inPlay: typeof book.inplay === 'boolean' ? book.inplay : null,
        totalMatched: book.totalMatched || 0,
        numberOfRunners: (cat.runners || []).length,
        numberOfActiveRunners: (cat.runners || []).filter(r => r.status === 'ACTIVE').length,
        betDelay: cat.description?.betDelay || 0,
        bspMarket: cat.description?.bspMarket || false,
        marketBaseRate: cat.description?.marketBaseRate ?? null,
        rawCommissionRate: cat.description?.marketBaseRate ?? null,
        normalizedCommissionRate: Number.isFinite(Number(cat.description?.marketBaseRate)) && Number(cat.description?.marketBaseRate) >= 0 && (Number(cat.description.marketBaseRate) > 1 ? Number(cat.description.marketBaseRate) / 100 : Number(cat.description.marketBaseRate)) <= 0.20 ? (Number(cat.description.marketBaseRate) > 1 ? Number(cat.description.marketBaseRate) / 100 : Number(cat.description.marketBaseRate)) : null,
        commissionNormalizationApplied: Number(cat.description?.marketBaseRate) > 1,
        commissionSource: cat.description?.marketBaseRate != null ? 'market_base_rate' : 'missing',
        commissionValidationStatus: Number.isFinite(Number(cat.description?.marketBaseRate)) && Number(cat.description?.marketBaseRate) >= 0 && (Number(cat.description.marketBaseRate) > 1 ? Number(cat.description.marketBaseRate) / 100 : Number(cat.description.marketBaseRate)) <= 0.20 ? 'valid' : 'invalid',
        watched: false,
        source: 'catalogue',
        hasPriceData: false,
      });

      const sortedRunners = [...(cat.runners || [])].sort((a, b) => {
        const aBook = book.runners?.find(r => r.selectionId === a.selectionId);
        const bBook = book.runners?.find(r => r.selectionId === b.selectionId);
        const aPrice = aBook?.ex?.availableToBack?.[0]?.price || 9999;
        const bPrice = bBook?.ex?.availableToBack?.[0]?.price || 9999;
        return aPrice - bPrice;
      });

      let marketHasPrice = false;

      for (let idx = 0; idx < sortedRunners.length; idx++) {
        const runner = sortedRunners[idx];
        const runnerBook = book.runners?.find(r => r.selectionId === runner.selectionId);

        const bestBack = runnerBook?.ex?.availableToBack?.[0];
        const bestLay = runnerBook?.ex?.availableToLay?.[0];
        const lastTraded = runnerBook?.lastPriceTraded;
        const tradedVol = runnerBook?.totalMatched || 0;

        const bestBackPrice = bestBack?.price || 0;
        const bestLayPrice = bestLay?.price || 0;
        const impliedProb=bestBackPrice>1?1/bestBackPrice:0;

        if (bestBackPrice > 0) runnersWithBackPrice++;
        if (bestLayPrice > 0) runnersWithLayPrice++;
        if ((bestBackPrice > 0 || bestLayPrice > 0) && !firstPricedRunner) {
          firstPricedRunner = {
            runnerName: runner.runnerName || `Selection ${runner.selectionId}`,
            bestBackPrice,
            bestLayPrice,
          };
        }
        if (bestBackPrice > 0 || bestLayPrice > 0) marketHasPrice = true;

        const metadata = runner.metadata || null;
        let raceFormProfile = null;
        let formDataStatus = 'MARKET_ONLY';
        let formDataCompleteness = 0;

        if (metadata) {
          raceFormProfile = {
            runnerName: runner.runnerName || null,
            selectionId: String(runner.selectionId || ''),
            clothNumber: metadata.CLOTH_NUMBER ?? metadata.clothNumber ?? null,
            sortPriority: metadata.SORT_PRIORITY ?? metadata.sortPriority ?? null,
            age: metadata.AGE ?? metadata.age ?? null,
            sex: metadata.SEX_TYPE ?? metadata.sex ?? null,
            jockeyName: metadata.JOCKEY_NAME ?? metadata.jockeyName ?? null,
            trainerName: metadata.TRAINER_NAME ?? metadata.trainerName ?? null,
            stallDraw: metadata.STALL_DRAW ?? metadata.stallDraw ?? null,
            weightValue: metadata.WEIGHT_VALUE ?? metadata.weightValue ?? null,
            weightUnits: metadata.WEIGHT_UNITS ?? metadata.weightUnits ?? null,
            officialRating: metadata.OFFICIAL_RATING ?? metadata.officialRating ?? null,
            adjustedRating: metadata.ADJUSTED_RATING ?? metadata.adjustedRating ?? null,
            recentForm: metadata.RECENT_FORM ?? metadata.recentForm ?? null,
            daysSinceLastRun: metadata.DAYS_SINCE_LAST_RUN ?? metadata.daysSinceLastRun ?? null,
            wearing: metadata.WEARING ?? metadata.wearing ?? null,
            ownerName: metadata.OWNER_NAME ?? metadata.ownerName ?? null,
            sireName: metadata.SIRE_NAME ?? metadata.sireName ?? null,
            damName: metadata.DAM_NAME ?? metadata.damName ?? null,
            bredCountry: metadata.BRED_COUNTRY ?? metadata.bredCountry ?? null,
            colourType: metadata.COLOUR_TYPE ?? metadata.colourType ?? null,
            jockeyClaim: metadata.JOCKEY_CLAIM ?? metadata.jockeyClaim ?? null,
            forecastPriceNumerator: metadata.FORECAST_PRICE_NUMERATOR ?? metadata.forecastPriceNumerator ?? null,
            forecastPriceDenominator: metadata.FORECAST_PRICE_DENOMINATOR ?? metadata.forecastPriceDenominator ?? null,
            coloursDescription: metadata.COLOURS_DESCRIPTION ?? metadata.coloursDescription ?? null,
            coloursFilename: metadata.COLOURS_FILENAME ?? metadata.coloursFilename ?? null,
            externalFormData: null,
          };

          const usefulFields = ['age','sex','jockeyName','trainerName','stallDraw','weightValue','officialRating','adjustedRating','recentForm','daysSinceLastRun','wearing','sireName','damName','bredCountry','colourType','jockeyClaim','ownerName','clothNumber','sortPriority'];
          const populatedCount = usefulFields.filter(f => raceFormProfile[f] != null).length;
          if (populatedCount > 0) {
            formDataStatus = 'PARTIAL_BETFAIR_METADATA';
            formDataCompleteness = Math.round((populatedCount / usefulFields.length) * 100);
          }
        }

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
          impliedProbability:impliedProb,
          impliedProbabilityDecimal:impliedProb,
          favouriteRank: idx + 1,
          isFavourite: idx === 0,
          isOutsider: idx === sortedRunners.length - 1,
          formDataStatus,
          formDataCompleteness,
          raceFormProfile,
          source: 'catalogue',
        });
      }

      // Mark market as having price data
      const mIdx = markets.length - 1;
      markets[mIdx].hasPriceData = marketHasPrice;
    }

    const marketsWithPriceData = markets.filter(m => m.hasPriceData).length;
    const raceGroupMap = new Map();
    for (const market of markets) {
      const raceKey = market.eventId || ((market.venue || market.eventName) && market.marketStartTime ? `${market.venue || market.eventName}:${market.marketStartTime}` : market.betfairMarketId);
      if (!raceGroupMap.has(raceKey)) raceGroupMap.set(raceKey, { raceKey, eventId: market.eventId, eventName: market.eventName, venue: market.venue, raceNumber: market.raceNumber, marketStartTime: market.marketStartTime, marketIds: [], marketTypes: [] });
      const group = raceGroupMap.get(raceKey);
      group.marketIds.push(market.betfairMarketId);
      if (!group.marketTypes.includes(market.marketTypeCode)) group.marketTypes.push(market.marketTypeCode);
    }
    const raceGroups = [...raceGroupMap.values()];

    return Response.json({
      status: 'success',
      action: action || 'load_race_day',
      fromTime,
      toTime,
      markets,
      runners,
      raceGroups,
      sessionTokenPresent: true,
      fetchedAt: new Date().toISOString(),
      isDelayed: books[0]?.isMarketDataDelayed || false,
      requestedMarketTypes,
      receivedMarketTypes: [...receivedMarketTypesSet],
      winMarketsReturned: winCount,
      placeMarketsReturned: placeCount,
      h2hMarketsReturned: h2hCount,
      unknownMarketsReturned: unknownCount,
      rawMarketCount,
      rawBookCount,
      uniqueCatalogueMarketIds: new Set(catalogues.map((record) => record?.marketId).filter(Boolean)).size,
      sampleCatalogueRecord: catalogues[0] || null,
      sampleMarketBook: books[0] || null,
      marketsWithPriceData,
      runnersWithBackPrice,
      runnersWithLayPrice,
      firstPricedRunner,
      workingApiBase,
      configuredApiBase,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message, errors: [error.message], status: 'error', markets: [], runners: [] }, { status: 200 });
  }
});