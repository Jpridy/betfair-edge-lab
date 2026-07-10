import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
    const envApiBase = body?.apiBase;

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

    // ── Step 2: List Market Catalogue ──
    // Horse Racing (eventType 7). Fetch per market type with smaller batches
    // to avoid Betfair's TOO_MUCH_DATA (ANGX-0001) error, which triggers when
    // a single listMarketCatalogue call would return too many markets with
    // full runner metadata.
    const requestedMarketTypes = body?.requestedMarketTypes || ['WIN', 'PLACE'];

    const now = new Date();
    const fromTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const toTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

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

    const rawMarketCount = catalogues.length;

    if (!Array.isArray(catalogues) || rawMarketCount === 0) {
      return Response.json({
        status: 'success',
        markets: [],
        runners: [],
        sessionToken,
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
    const marketIds = catalogues.map(c => c.marketId);
    let books = [];
    const BATCH_SIZE = 100;
    for (let i = 0; i < marketIds.length; i += BATCH_SIZE) {
      const batchIds = marketIds.slice(i, i + BATCH_SIZE);
      const bookBody = {
        marketIds: batchIds,
        priceProjection: {
          priceData: ['EX_BEST_OFFERS', 'EX_TRADED'],
          virtualise: 'true',
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
            errors.push(`listMarketBook batch ${Math.floor(i / BATCH_SIZE) + 1} returned non-JSON`);
          }
        } else {
          errors.push(`listMarketBook batch ${Math.floor(i / BATCH_SIZE) + 1} failed (HTTP ${bookRes.status})`);
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
        eventType: 'Horse Racing',
        country: cat.event?.countryCode || '',
        venue,
        eventName,
        marketName,
        marketType: cat.description?.marketType || 'WIN',
        marketTypeCode,
        startTime: cat.marketStartTime || cat.description?.marketTime || null,
        marketStartTime: cat.marketStartTime || cat.description?.marketTime || null,
        status: book.status || 'OPEN',
        inPlay: book.inplay || false,
        totalMatched: book.totalMatched || 0,
        numberOfRunners: (cat.runners || []).length,
        numberOfActiveRunners: (cat.runners || []).filter(r => r.status === 'ACTIVE').length,
        betDelay: cat.description?.betDelay || 0,
        bspMarket: cat.description?.bspMarket || false,
        marketBaseRate: cat.description?.marketBaseRate ?? null,
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
        const impliedProb = bestBackPrice > 0 ? (1 / bestBackPrice) * 100 : 0;

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
          impliedProbability: impliedProb,
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

    return Response.json({
      status: 'success',
      markets,
      runners,
      sessionToken,
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