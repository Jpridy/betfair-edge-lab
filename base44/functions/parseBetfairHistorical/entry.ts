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

// Inlined bzip2 decompressor (antimatter15/bzip2.js, MIT license)
// Returns decompressed data as Uint8Array
function decompressBz2(data) {
  var BITMASK = [0, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF];
  var bit = 0, byteIdx = 0;
  function bits(n) {
    var result = 0;
    while (n > 0) {
      var left = 8 - bit;
      if (n >= left) {
        result <<= left;
        result |= (BITMASK[left] & data[byteIdx++]);
        bit = 0;
        n -= left;
      } else {
        result <<= n;
        result |= ((data[byteIdx] & (BITMASK[n] << (8 - n - bit))) >> (8 - n - bit));
        bit += n;
        n = 0;
      }
    }
    return result;
  }

  // Header
  if (bits(24) !== 4348520) throw new Error('No bzip2 magic number');
  var size = bits(8) - 48;
  if (size < 1 || size > 9) throw new Error('Invalid bzip2 block size');

  var MAX_HUFCODE_BITS = 20;
  var MAX_SYMBOLS = 258;
  var SYMBOL_RUNA = 0;
  var SYMBOL_RUNB = 1;
  var GROUP_SIZE = 50;
  var bufsize = 100000 * size;
  var allBuf = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    var h = '';
    for (var hi = 0; hi < 6; hi++) h += bits(8).toString(16);
    if (h === '177245385090') break; // last block
    if (h !== '314159265359') throw new Error('Invalid bzip2 block header');
    bits(32); // CRC
    if (bits(1)) throw new Error('Unsupported obsolete bzip2 version');
    var origPtr = bits(24);
    if (origPtr > bufsize) throw new Error('Initial position larger than buffer');

    var t = bits(16);
    var symToByte = new Uint8Array(256);
    var symTotal = 0;
    for (var i = 0; i < 16; i++) {
      if (t & (1 << (15 - i))) {
        var k = bits(16);
        for (var j = 0; j < 16; j++) {
          if (k & (1 << (15 - j))) symToByte[symTotal++] = (16 * i) + j;
        }
      }
    }

    var groupCount = bits(3);
    if (groupCount < 2 || groupCount > 6) throw new Error('Invalid group count');
    var nSelectors = bits(15);
    if (nSelectors === 0) throw new Error('No selectors');
    var mtfSymbol = [];
    for (var mi = 0; mi < groupCount; mi++) mtfSymbol[mi] = mi;
    var selectors = new Uint8Array(32768);

    for (var si = 0; si < nSelectors; si++) {
      for (var sj = 0; bits(1); sj++) if (sj >= groupCount) throw new Error('Selector error');
      var uc = mtfSymbol[sj];
      mtfSymbol.splice(sj, 1);
      mtfSymbol.splice(0, 0, uc);
      selectors[si] = uc;
    }

    var symCount = symTotal + 2;
    var groups = [];
    for (var gj = 0; gj < groupCount; gj++) {
      var length = new Uint8Array(MAX_SYMBOLS);
      var temp = new Uint8Array(MAX_HUFCODE_BITS + 1);
      t = bits(5);
      for (var li = 0; li < symCount; li++) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (t < 1 || t > MAX_HUFCODE_BITS) throw new Error('Invalid Huffman code length');
          if (!bits(1)) break;
          if (!bits(1)) t++; else t--;
        }
        length[li] = t;
      }
      var minLen, maxLen;
      minLen = maxLen = length[0];
      for (var ci = 1; ci < symCount; ci++) {
        if (length[ci] > maxLen) maxLen = length[ci];
        else if (length[ci] < minLen) minLen = length[ci];
      }
      var hufGroup = {};
      hufGroup.permute = new Uint32Array(MAX_SYMBOLS);
      hufGroup.limit = new Uint32Array(MAX_HUFCODE_BITS + 1);
      hufGroup.base = new Uint32Array(MAX_HUFCODE_BITS + 1);
      hufGroup.minLen = minLen;
      hufGroup.maxLen = maxLen;
      var base = hufGroup.base.subarray(1);
      var limit = hufGroup.limit.subarray(1);
      var pp = 0;
      for (var bi = minLen; bi <= maxLen; bi++)
        for (var bt = 0; bt < symCount; bt++)
          if (length[bt] === bi) hufGroup.permute[pp++] = bt;
      for (i = minLen; i <= maxLen; i++) temp[i] = limit[i] = 0;
      for (i = 0; i < symCount; i++) temp[length[i]]++;
      pp = t = 0;
      for (i = minLen; i < maxLen; i++) {
        pp += temp[i];
        limit[i] = pp - 1;
        pp <<= 1;
        base[i + 1] = pp - (t += temp[i]);
      }
      limit[maxLen] = pp + temp[maxLen] - 1;
      base[minLen] = 0;
      groups[gj] = hufGroup;
    }

    var byteCount = new Uint32Array(256);
    for (i = 0; i < 256; i++) mtfSymbol[i] = i;
    var runPos = 0, count = 0, symCount2 = 0, selector = 0;
    var buf = new Uint32Array(bufsize);
    var nextSym;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!(symCount2--)) {
        symCount2 = GROUP_SIZE - 1;
        if (selector >= nSelectors) throw new Error('Too many selectors');
        hufGroup = groups[selectors[selector++]];
        base = hufGroup.base.subarray(1);
        limit = hufGroup.limit.subarray(1);
      }
      i = hufGroup.minLen;
      j = bits(i);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (i > hufGroup.maxLen) throw new Error('Huffman decode error');
        if (j <= limit[i]) break;
        i++;
        j = (j << 1) | bits(1);
      }
      j -= base[i];
      if (j < 0 || j >= MAX_SYMBOLS) throw new Error('Symbol out of range');
      nextSym = hufGroup.permute[j];
      if (nextSym === SYMBOL_RUNA || nextSym === SYMBOL_RUNB) {
        if (!runPos) { runPos = 1; t = 0; }
        if (nextSym === SYMBOL_RUNA) t += runPos; else t += 2 * runPos;
        runPos <<= 1;
        continue;
      }
      if (runPos) {
        runPos = 0;
        if (count + t >= bufsize) throw new Error('Buffer overflow');
        uc = symToByte[mtfSymbol[0]];
        byteCount[uc] += t;
        while (t--) buf[count++] = uc;
      }
      if (nextSym > symTotal) break;
      if (count >= bufsize) throw new Error('Buffer overflow');
      i = nextSym - 1;
      uc = mtfSymbol[i];
      mtfSymbol.splice(i, 1);
      mtfSymbol.splice(0, 0, uc);
      uc = symToByte[uc];
      byteCount[uc]++;
      buf[count++] = uc;
    }

    if (origPtr < 0 || origPtr >= count) throw new Error('Invalid origPtr');
    j = 0;
    for (i = 0; i < 256; i++) { k = j + byteCount[i]; byteCount[i] = j; j = k; }
    for (i = 0; i < count; i++) { uc = buf[i] & 0xff; buf[byteCount[uc]] |= (i << 8); byteCount[uc]++; }

    var pos = buf[origPtr];
    var current = pos & 0xff;
    pos >>= 8;
    var run = -1;
    var copies, previous, outbyte;

    while (count) {
      count--;
      previous = current;
      pos = buf[pos];
      current = pos & 0xff;
      pos >>= 8;
      if (run++ === 3) { copies = current; outbyte = previous; current = -1; }
      else { copies = 1; outbyte = current; }
      while (copies--) { allBuf.push(outbyte); }
      if (current !== previous) run = 0;
    }
  }

  var result = new Uint8Array(allBuf.length);
  for (var ri = 0; ri < allBuf.length; ri++) result[ri] = allBuf[ri];
  return result;
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