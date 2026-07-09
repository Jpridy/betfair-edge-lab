/**
 * Merge Betfair market data from multiple sources.
 *
 * Sources:
 * - Stream: real-time WebSocket data (prices update live, but runner names often missing for AU racing)
 * - Catalogue: REST API data (proper names, metadata, snapshot prices)
 * - Cached: previously loaded data that may be stale
 *
 * Merge rules:
 * - Stream prices take priority over catalogue prices
 * - Catalogue names/metadata take priority over stream names
 * - If stream is disconnected but catalogue has prices, use catalogue prices
 * - Do not wipe catalogue data when stream disconnects
 * - Mark each market/runner with source: 'stream' | 'catalogue' | 'merged' | 'cached'
 */

/**
 * @param {object} params
 * @param {Array} [params.existingMarkets=[]] - Markets currently in AppContext state
 * @param {Array} [params.existingRunners=[]] - Runners currently in AppContext state
 * @param {Array} [params.catalogueMarkets=[]] - Markets from betfairMarkets REST
 * @param {Array} [params.catalogueRunners=[]] - Runners from betfairMarkets REST
 * @param {Array} [params.streamMarkets=[]] - Markets from Betfair stream WebSocket
 * @param {Array} [params.streamRunners=[]] - Runners from Betfair stream WebSocket
 * @returns {{ markets: Array, runners: Array }}
 */
export function mergeBetfairMarkets({
  existingMarkets = [],
  existingRunners = [],
  catalogueMarkets = [],
  catalogueRunners = [],
  streamMarkets = [],
  streamRunners = [],
}) {
  const marketMap = new Map();
  const runnerMap = new Map();
  const now = new Date().toISOString();

  // 1. Start with catalogue data — has proper names, metadata, snapshot prices
  for (const m of catalogueMarkets) {
    const id = m.betfairMarketId || m.id;
    if (!id) continue;
    marketMap.set(id, {
      ...m,
      source: 'catalogue',
      lastUpdatedAt: m.fetchedAt || now,
    });
  }
  for (const r of catalogueRunners) {
    const mid = r.marketId;
    const sid = String(r.betfairSelectionId || r.selectionId || '');
    if (!mid || !sid) continue;
    const key = `${mid}_${sid}`;
    runnerMap.set(key, {
      ...r,
      marketId: mid,
      betfairSelectionId: sid,
      source: 'catalogue',
      lastUpdatedAt: r.fetchedAt || now,
    });
  }

  // 2. Preserve existing data that catalogue doesn't cover (cached from previous fetches)
  for (const m of existingMarkets) {
    const id = m.betfairMarketId || m.id;
    if (!id || marketMap.has(id)) continue;
    marketMap.set(id, {
      ...m,
      source: m.source || 'cached',
      lastUpdatedAt: m.lastUpdatedAt || null,
    });
  }
  for (const r of existingRunners) {
    const mid = r.marketId;
    const sid = String(r.betfairSelectionId || r.selectionId || '');
    if (!mid || !sid) continue;
    const key = `${mid}_${sid}`;
    if (runnerMap.has(key)) continue;
    runnerMap.set(key, {
      ...r,
      source: r.source || 'cached',
      lastUpdatedAt: r.lastUpdatedAt || null,
    });
  }

  // 3. Overlay stream data — real-time prices and status override catalogue
  for (const m of streamMarkets) {
    const id = m.betfairMarketId || m.id;
    if (!id) continue;
    const existing = marketMap.get(id);
    if (existing) {
      marketMap.set(id, {
        ...existing,
        ...m,
        // Keep catalogue name/venue/eventName if stream doesn't have them
        marketName: m.marketName || existing.marketName || '',
        venue: m.venue || existing.venue || '',
        eventName: m.eventName || existing.eventName || '',
        marketType: m.marketType || existing.marketType || '',
        marketTypeCode: m.marketTypeCode || existing.marketTypeCode || m.marketType || '',
        source: 'merged',
        lastUpdatedAt: now,
      });
    } else {
      marketMap.set(id, {
        ...m,
        source: 'stream',
        lastUpdatedAt: now,
      });
    }
  }
  for (const r of streamRunners) {
    const mid = r.marketId;
    const sid = String(r.betfairSelectionId || r.selectionId || '');
    if (!mid || !sid) continue;
    const key = `${mid}_${sid}`;
    const existing = runnerMap.get(key);
    if (existing) {
      runnerMap.set(key, {
        ...existing,
        ...r,
        // Keep catalogue name/metadata if stream doesn't have them
        runnerName: r.runnerName || existing.runnerName || `Selection ${sid}`,
        raceFormProfile: r.raceFormProfile || existing.raceFormProfile || null,
        formDataStatus: r.formDataStatus || existing.formDataStatus || 'MARKET_ONLY',
        formDataCompleteness: r.formDataCompleteness ?? existing.formDataCompleteness ?? 0,
        source: 'merged',
        lastUpdatedAt: now,
      });
    } else {
      runnerMap.set(key, {
        ...r,
        marketId: mid,
        betfairSelectionId: sid,
        source: 'stream',
        lastUpdatedAt: now,
      });
    }
  }

  // 4. Tag each market with hasPriceData based on its runners
  const runnerList = [...runnerMap.values()];
  const mergedMarkets = [...marketMap.values()].map(m => {
    const mid = m.betfairMarketId || m.id;
    const marketRunners = runnerList.filter(r =>
      r.marketId === mid || r.marketId === m.id
    );
    const hasPriceData = marketRunners.some(r =>
      (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0)
    );
    return { ...m, hasPriceData };
  });

  return { markets: mergedMarkets, runners: runnerList };
}

/**
 * Determine the overall market data source label for display.
 * @param {Array} markets
 * @param {string} streamStatus
 * @returns {string} 'stream_live' | 'rest_catalogue' | 'merged' | 'cached_stale' | 'none'
 */
export function getMarketDataSourceLabel(markets, streamStatus) {
  if (!markets || markets.length === 0) return 'none';

  const streamConnected = streamStatus === 'connected' || streamStatus === 'polling';
  const sources = new Set(markets.map(m => m.source || 'cached'));

  if (streamConnected && sources.has('merged')) return 'merged';
  if (streamConnected && sources.has('stream')) return 'stream_live';
  if (sources.has('catalogue') || sources.has('merged')) return 'rest_catalogue';
  return 'cached_stale';
}