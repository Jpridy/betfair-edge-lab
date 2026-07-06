import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Manual tar parser — no external deps, works reliably in Deno
function parseTarBuffer(buffer) {
  const files = [];
  let offset = 0;
  const decoder = new TextDecoder();

  while (offset + 512 <= buffer.length) {
    if (buffer[offset] === 0) break;
    const name = decoder.decode(buffer.subarray(offset, offset + 100)).replace(/\0/g, '');
    if (!name) { offset += 512; continue; }
    const sizeStr = decoder.decode(buffer.subarray(offset + 124, offset + 136)).replace(/\0/g, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    const dataStart = offset + 512;
    const data = buffer.subarray(dataStart, dataStart + size);
    files.push({ name, data });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return files;
}

// Manual zip parser — uses built-in DecompressionStream for deflate
function readUint16LE(buf, off) {
  return buf[off] | (buf[off + 1] << 8);
}
function readUint32LE(buf, off) {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}

async function inflateRaw(compressed) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(compressed);
      controller.close();
    }
  });
  const decompressed = stream.pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = decompressed.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { result.set(c, pos); pos += c.length; }
  return result;
}

async function parseZipBuffer(buffer) {
  const files = [];
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= buffer.length) {
    const sig = readUint32LE(buffer, offset);
    if (sig !== 0x04034b50) break;

    const flags = readUint16LE(buffer, offset + 6);
    const compression = readUint16LE(buffer, offset + 8);
    const compressedSize = readUint32LE(buffer, offset + 18);
    const filenameLen = readUint16LE(buffer, offset + 26);
    const extraLen = readUint16LE(buffer, offset + 28);

    const nameStart = offset + 30;
    const filename = decoder.decode(buffer.subarray(nameStart, nameStart + filenameLen));
    const dataStart = nameStart + filenameLen + extraLen;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    // If bit 3 of flags is set, size is in a data descriptor after the data — scan for it
    let actualSize = compressedSize;
    if (compressedSize === 0 && (flags & 0x08)) {
      // Scan for data descriptor signature or next local file header
      let scan = dataStart;
      while (scan + 4 <= buffer.length) {
        const nextSig = readUint32LE(buffer, scan);
        if (nextSig === 0x08074b50 && scan + 24 <= buffer.length) {
          // Data descriptor: sig(4) + crc32(4) + compressedSize(4) + uncompressedSize(4)
          actualSize = readUint32LE(buffer, scan + 8);
          break;
        }
        if (nextSig === 0x04034b50) {
          // Hit next local file header — no descriptor found, use data up to here
          actualSize = scan - dataStart;
          break;
        }
        scan++;
      }
    }

    const fileData = buffer.subarray(dataStart, dataStart + actualSize);
    offset = dataStart + actualSize;

    // Skip the data descriptor if present (12 or 16 bytes)
    if (flags & 0x08) {
      // Check if next bytes are a data descriptor signature
      if (offset + 4 <= buffer.length && readUint32LE(buffer, offset) === 0x08074b50) {
        offset += 16; // sig + crc + compSize + uncompSize
      } else {
        offset += 12; // crc + compSize + uncompSize (no sig)
      }
    }

    if (filename.endsWith('/')) continue;

    let data;
    if (compression === 0) {
      data = fileData;
    } else if (compression === 8) {
      data = await inflateRaw(fileData);
    } else {
      continue;
    }

    files.push({ name: filename, data });
  }
  return files;
}

// BZ2 detection — checks if data starts with 'BZ' magic bytes
function isBz2(data) {
  return data.length >= 2 && data[0] === 0x42 && data[1] === 0x5a;
}

// BZ2 decompression — uses esm.sh hosted bzip2 library
async function decompressBz2(data) {
  const bzip2Module = await import('https://esm.sh/bzip2@0.0.1');
  const bzip2 = bzip2Module.default || bzip2Module;
  const bits = bzip2.array(data);
  return bzip2.simple(bits);
}

// Extract best back/lay from runner change — handles all Betfair field variants
function extractPrices(rc) {
  let bestBack = null, bestBackSize = null, bestLay = null, bestLaySize = null;

  if (rc.atb && rc.atb.length) { bestBack = rc.atb[0][0]; bestBackSize = rc.atb[0][1]; }
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

    // Download the archive file
    const response = await fetch(file_url);
    if (!response.ok) return Response.json({ error: `Download failed: ${response.status}` }, { status: 500 });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Detect format: zip (PK\x03\x04) or tar
    let files;
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
      files = await parseZipBuffer(buffer);
    } else {
      files = parseTarBuffer(buffer);
    }

    if (files.length === 0) {
      return Response.json({ error: 'No files found in archive' }, { status: 400 });
    }

    // Decompress bz2 files if present (Betfair historical data is often bz2 inside zip)
    const fileInfos = [];
    files = await Promise.all(files.map(async (f) => {
      const info = { name: f.name, size: f.data.length, isBz2: isBz2(f.data) };
      fileInfos.push(info);
      if (isBz2(f.data)) {
        try {
          const decompressed = await decompressBz2(f.data);
          return { name: f.name, data: decompressed, decompressed: true };
        } catch (e) {
          fileInfos[fileInfos.length - 1].error = e.message;
          return f;
        }
      }
      return f;
    }));

    const markets = [];
    const runners = [];
    const snapshots = [];

    for (const file of files) {
      // Skip bz2 files we can't decompress yet
      if (isBz2(file.data)) continue;
      const text = new TextDecoder().decode(file.data);
      const lines = text.split('\n').filter(l => l.trim());

      let marketDef = null;
      let runnerDefs = [];
      const allSnaps = [];
      const latestPrices = {};

      for (const line of lines) {
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }

        if (msg.op !== 'mcm' || !msg.mc) continue;

        for (const mc of msg.mc) {
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

      const maxSnaps = 200;
      const interval = Math.max(1, Math.floor(allSnaps.length / maxSnaps));
      const sampled = allSnaps.filter((_, i) => i % interval === 0);

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
      fileInfos,
      markets,
      runners,
      snapshots,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});