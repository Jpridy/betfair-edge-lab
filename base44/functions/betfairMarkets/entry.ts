import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    if (!appKey || !sessionToken) {
      return Response.json({ error: 'Betfair session token or App Key not configured' }, { status: 400 });
    }

    if (!proxyUrl) {
      return Response.json({ error: 'BETFAIR_PROXY_URL not configured. Market data requires the Cloudflare Worker proxy.' }, { status: 500 });
    }

    const apiBase = jurisdiction === 'AU'
      ? 'https://api-au.betfair.com'
      : 'https://api.betfair.com';
    const bettingBase = `${apiBase}/exchange/betting/rest/v1.0`;

    const authHeaders = {
      'X-Authentication': sessionToken,
      'X-Application': appKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Helper: call Betfair through the proxy (direct calls are WAF-blocked)
    async function callBetfair(targetUrl, headers, bodyStr) {
      const proxyFetchUrl = `${proxyUrl}?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyFetchUrl, {
        method: 'POST',
        headers,
        body: bodyStr,
      });
      return res;
    }

    // Date range: midnight today to midnight tomorrow+1 (covers in-play + upcoming)
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
      marketProjection: [
        'EVENT',
        'EVENT_TYPE',
        'MARKET_START_TIME',
        'MARKET_DESCRIPTION',
        'RUNNER_DESCRIPTION',
        'RUNNER_METADATA',
      ],
    };

    const catalogueRes = await callBetfair(`${bettingBase}/listMarketCatalogue/`, authHeaders, JSON.stringify(catalogueBody));
    const catalogueText = await catalogueRes.text();

    // Session expired?
    if (catalogueText.includes('UNAUTHORIZED') || catalogueText.includes('INVALID_SESSION') || catalogueText.includes('NO_SESSION')) {
      return Response.json({ status: 'error', sessionExpired: true, error: 'Betfair session expired' }, { status: 401 });
    }

    if (!catalogueRes.ok) {
      return Response.json({ error: `Catalogue fetch failed (HTTP ${catalogueRes.status}): ${catalogueText.slice(0, 200)}` }, { status: 502 });
    }

    let catalogues;
    try { catalogues = JSON.parse(catalogueText); } catch {
      return Response.json({ error: 'Betfair returned non-JSON response for catalogue' }, { status: 502 });
    }

    if (!Array.isArray(catalogues) || catalogues.length === 0) {
      return Response.json({ status: 'success', markets: [], runners: [], sessionToken, fetchedAt: new Date().toISOString() });
    }

    // 2. List Market Book — get live prices for all markets
    const marketIds = catalogues.map(c => c.marketId);
    const bookBody = {
      marketIds,
      priceProjection: {
        priceData: ['EX_BEST_OFFERS', 'EX_TRADED'],
        virtualise: 'true',
      },
    };

    const bookRes = await callBetfair(`${bettingBase}/listMarketBook/`, authHeaders, JSON.stringify(bookBody));
    const bookText = await bookRes.text();
    let books = [];
    if (bookRes.ok) {
      try { books = JSON.parse(bookText); } catch { books = []; }
    }

    // 3. Transform into app format
    const markets = [];
    const runners = [];

    for (const cat of catalogues) {
      const book = books.find(b => b.marketId === cat.marketId);
      if (!book) continue;

      // Skip settled/closed markets — no useful price data
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
        numberOfActiveRunners: (cat.runners || []).filter(r => r.status === 'ACTIVE').length,
        betDelay: cat.description?.betDelay || 0,
        bspMarket: cat.description?.bspMarket || false,
        marketBaseRate: cat.description?.marketBaseRate ?? null,
        watched: false,
      });

      // Sort runners by best back price to determine favourite rank
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

        // Extract RaceFormProfile from Betfair RUNNER_METADATA (optional — may be null)
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
        });
      }
    }

    return Response.json({
      status: 'success',
      markets,
      runners,
      sessionToken,
      fetchedAt: new Date().toISOString(),
      isDelayed: books[0]?.isMarketDataDelayed || false,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});