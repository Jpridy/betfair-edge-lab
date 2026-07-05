import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Manual tar parser — no external deps, works reliably in Deno
function parseTarBuffer(buffer) {
  const files = [];
  let offset = 0;
  const decoder = new TextDecoder();

  while (offset + 512 <= buffer.length) {
    // End of archive: two consecutive zero blocks
    if (buffer[offset] === 0) break;

    // Filename: 100 bytes at offset 0
    const name = decoder.decode(buffer.subarray(offset, offset + 100)).replace(/\0/g, '');
    if (!name) { offset += 512; continue; }

    // File size: 12 bytes at offset 124, octal
    const sizeStr = decoder.decode(buffer.subarray(offset + 124, offset + 136)).replace(/\0/g, '').trim();
    const size = parseInt(sizeStr, 8) || 0;

    // File data starts at offset + 512
    const dataStart = offset + 512;
    const data = buffer.subarray(dataStart, dataStart + size);
    files.push({ name, data });

    // Next entry: data padded to 512-byte boundary
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return files;
}

// Extract best back/lay from runner change — handles all Betfair field variants
function extractPrices(rc) {
  let bestBack = null, bestBackSize = null, bestLay = null, bestLaySize = null;

  // atb/atl: [[price, size], ...]
  if (rc.atb && rc.atb.length) { bestBack = rc.atb[0][0]; bestBackSize = rc.atb[0][1]; }
  // batb/batl: [[level, price, size], ...]
  if (rc.batb && rc.batb.length) {
    const sorted = rc.batb.sort((a, b) => a[0] - b[0]);
    bestBack = sorted[0][1]; bestBackSize = sorted[0][2];
  }
  if (rc.atl && rc.atl.length) { bestLay = rc.atl[0][0]; bestLaySize = rc.atl[0][1]; }
  if (rc.batl && rc.batl.length) {
    const sorted = rc.batl.sort((a, b) => a[0] - b[0]);
    bestLay = sorted[0][1]; bestLaySize = sorted[0][2];
  }

  const tradedVol = rc.trd ? rc.trd.reduce((sum, t) => sum + t[1], 0) : 0;

  return {
    ltp: rc.ltp || null,
    tv: rc.tv || tradedVol,
    bestBack,
    bestBackSize,
    bestLay,
    bestLaySize,
    tradedVol,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    // Download the .tar file
    const response = await fetch(file_url);
    if (!response.ok) return Response.json({ error: `Download failed: ${response.status}` }, { status: 500 });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const files = parseTarBuffer(buffer);

    if (files.length === 0) {
      return Response.json({ error: 'No files found in tar archive' }, { status: 400 });
    }

    const markets = [];
    const runners = [];
    const snapshots = [];

    for (const file of files) {
      const text = new TextDecoder().decode(file.data);
      const lines = text.split('\n').filter(l => l.trim());

      let marketDef = null;
      let runnerDefs = [];
      const allSnaps = [];
      // Track latest price per runner (final state)
      const latestPrices = {};

      for (const line of lines) {
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }

        if (msg.op !== 'mcm' || !msg.mc) continue;

        for (const mc of msg.mc) {
          // Market definition — usually first message in stream
          if (mc.marketDefinition) {
            marketDef = mc.marketDefinition;
            runnerDefs = (marketDef.runners || []).map(r => ({
              betfairSelectionId: String(r.id),
              runnerName: r.name || `Selection ${r.id}`,
              handicap: r.hc || 0,
              status: r.status || 'ACTIVE',
              sortPriority: r.sortPriority || 0,
              adjustmentFactor: r.adjustmentFactor || null,
            }));
          }

          // Runner price changes
          if (mc.rc) {
            for (const rc of mc.rc) {
              const selId = String(rc.id);
              const prices = extractPrices(rc);

              latestPrices[selId] = prices;

              allSnaps.push({
                marketId: mc.id,
                selectionId: selId,
                publishTime: msg.pt,
                ...prices,
              });
            }
          }
        }
      }

      if (!marketDef) continue;

      // Sample snapshots — cap at ~200 per market for manageability
      const maxSnaps = 200;
      const interval = Math.max(1, Math.floor(allSnaps.length / maxSnaps));
      const sampled = allSnaps.filter((_, i) => i % interval === 0);

      // Build runner objects with final prices
      for (const rd of runnerDefs) {
        const lp = latestPrices[rd.betfairSelectionId] || {};
        runners.push({
          ...rd,
          marketId: marketDef.marketId || file.name,
          lastPriceTraded: lp.ltp || null,
          totalMatched: lp.tv || 0,
          bestBackPrice: lp.bestBack || null,
          bestBackSize: lp.bestBackSize || null,
          bestLayPrice: lp.bestLay || null,
          bestLaySize: lp.bestLaySize || null,
          lastTradedPrice: lp.ltp || null,
          tradedVolumeAmount: lp.tv || 0,
          status: rd.status,
        });
      }

      markets.push({
        betfairMarketId: marketDef.marketId || file.name,
        eventName: marketDef.eventName || marketDef.venue || '',
        marketName: marketDef.name || '',
        marketType: marketDef.marketType || '',
        venue: marketDef.venue || '',
        country: marketDef.countryCode || '',
        timezone: marketDef.timezone || '',
        marketStartTime: marketDef.marketTime || '',
        numberOfRunners: marketDef.runners?.length || 0,
        numberOfActiveRunners: marketDef.runners?.filter(r => r.status === 'ACTIVE').length || 0,
        numberOfWinners: marketDef.numberOfWinners || 1,
        betDelay: marketDef.betDelay || 0,
        bspMarket: marketDef.bspMarket || false,
        turnInPlayEnabled: marketDef.turnInPlayEnabled || false,
        marketBaseRate: marketDef.marketBaseRate || 0.05,
        status: marketDef.status || 'CLOSED',
        inPlay: marketDef.inPlay || false,
        totalMatched: marketDef.totalMatched || 0,
        eventTypeId: marketDef.eventTypeId || '',
        eventType: marketDef.eventType || '',
      });

      snapshots.push(...sampled);
    }

    return Response.json({
      status: 'success',
      marketsProcessed: markets.length,
      runnersExtracted: runners.length,
      snapshotCount: snapshots.length,
      markets,
      runners,
      snapshots,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});