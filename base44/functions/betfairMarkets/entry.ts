import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const appKey = Deno.env.get("BETFAIR_APP_KEY");
    const jurisdiction = Deno.env.get("BETFAIR_JURISDICTION") || "AU";

    let body;
    try { body = await req.json(); } catch { body = {}; }

    // Use SSOID from env (preferred) or from request body
    const sessionToken = body?.sessionToken || Deno.env.get("BETFAIR_SSOID");

    if (!appKey || !sessionToken) {
      return Response.json({ error: 'Betfair SSOID or App Key not configured' }, { status: 400 });
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
        'MARKET_DESCRIPTION',
        'RUNNER_METADATA',
        'RUNNER_DESCRIPTION',
        'MARKET_START_TIME',
      ],
    };

    const catalogueRes = await fetch(`${bettingBase}/listMarketCatalogue/`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(catalogueBody),
    });

    const catalogueText = await catalogueRes.text();

    // Session expired?
    if (catalogueText.includes('UNAUTHORIZED') || catalogueText.includes('INVALID_SESSION') || catalogueText.includes('NO_SESSION')) {
      return Response.json({ status: 'error', sessionExpired: true, error: 'Betfair SSOID expired' }, { status: 401 });
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

    const bookRes = await fetch(`${bettingBase}/listMarketBook/`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(bookBody),
    });

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
        watched: false,
      });

      // Sort runners by best back price to determine favourite rank
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