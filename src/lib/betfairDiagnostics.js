import { calculatePriceFeedStatus } from './marketFreshness';

const MARKET_STATUSES = new Set(['OPEN', 'SUSPENDED', 'CLOSED', 'SETTLED']);
const CONNECTION_STATES = new Set(['CONNECTED', 'CONNECTING', 'DISCONNECTED', 'ERROR', 'NOT_CONFIGURED']);

const array = (value) => Array.isArray(value) ? value : [];
const marketIdOf = (value) => value?.marketId || value?.betfairMarketId || value?.id || null;
const validDate = (value) => value && !Number.isNaN(new Date(value).getTime());
const hasPrice = (runner) => Number(runner?.bestBackPrice || runner?.ex?.availableToBack?.[0]?.price) > 0 || Number(runner?.bestLayPrice || runner?.ex?.availableToLay?.[0]?.price) > 0;
const sanitize = (value) => JSON.parse(JSON.stringify(value ?? null, (key, item) => /token|password|credential|appkey|authentication/i.test(key) ? '[REDACTED]' : item));

export function normalizeBetfairMarket(catalogueRecord, marketBook, streamMarket) {
  const cat = catalogueRecord && !Array.isArray(catalogueRecord) ? catalogueRecord : {};
  const book = marketBook && !Array.isArray(marketBook) ? marketBook : {};
  const stream = streamMarket && !Array.isArray(streamMarket) ? streamMarket : {};
  const marketId = marketIdOf(stream) || marketIdOf(book) || marketIdOf(cat);
  const rawStatus = stream.status ?? stream.marketDefinition?.status ?? book.status ?? cat.status;
  const status = MARKET_STATUSES.has(String(rawStatus).toUpperCase()) ? String(rawStatus).toUpperCase() : 'UNKNOWN';
  const rawInPlay = stream.inPlay ?? stream.inplay ?? stream.marketDefinition?.inPlay ?? book.inplay ?? book.inPlay ?? cat.inPlay;
  const inPlay = typeof rawInPlay === 'boolean' ? rawInPlay : null;
  const marketStartTime = stream.marketStartTime || stream.startTime || stream.marketDefinition?.marketTime || cat.marketStartTime || cat.startTime || cat.description?.marketTime || null;
  const runners = array(stream.runners).length ? array(stream.runners) : array(book.runners).length ? array(book.runners) : array(cat.runners);
  const dataSources = [];
  if (Object.keys(cat).length) dataSources.push('catalogue');
  if (Object.keys(book).length) dataSources.push('market_book');
  if (Object.keys(stream).length) dataSources.push('stream');
  const normalized = {
    marketId: marketId ? String(marketId) : null,
    eventId: stream.eventId || cat.eventId || cat.event?.id || null,
    eventName: stream.eventName || cat.eventName || cat.event?.name || '',
    marketName: stream.marketName || stream.marketDefinition?.name || cat.marketName || '',
    marketType: stream.marketType || stream.marketTypeCode || stream.marketDefinition?.marketType || cat.marketType || cat.marketTypeCode || cat.description?.marketType || 'UNKNOWN',
    status,
    inPlay,
    marketStartTime: validDate(marketStartTime) ? new Date(marketStartTime).toISOString() : null,
    runners,
    hasRunnerData: runners.length > 0,
    hasPriceData: runners.some(hasPrice),
    catalogueUpdatedAt: cat.catalogueUpdatedAt || cat.fetchedAt || (cat.source === 'catalogue' ? cat.lastUpdatedAt : null) || null,
    streamUpdatedAt: stream.streamUpdatedAt || (['stream', 'merged'].includes(stream.source) ? stream.lastUpdatedAt : null) || null,
    dataSources,
    missingMarketStartTime: !validDate(marketStartTime),
    shapeErrors: [],
  };
  if (!normalized.marketId) normalized.shapeErrors.push('Missing normalized marketId');
  if (!Array.isArray(normalized.runners)) normalized.shapeErrors.push('Runners is not an array');
  if (Array.isArray(catalogueRecord)) normalized.shapeErrors.push('Catalogue record has incorrect nested array shape');
  if (Array.isArray(marketBook)) normalized.shapeErrors.push('Market book has incorrect nested array shape');
  if (Array.isArray(streamMarket)) normalized.shapeErrors.push('Stream market has incorrect nested array shape');
  return normalized;
}

export function validateBetfairDiagnostics(snapshot) {
  const errors = [...(snapshot.shapeErrors || [])];
  const total = snapshot.validHydratedMarkets;
  const statuses = snapshot.statusCounts;
  const inPlay = snapshot.inPlayCounts;
  const times = snapshot.startTimeCounts;
  const runners = snapshot.runnerCounts;
  const prices = snapshot.priceCounts;
  if (total > 0 && statuses.open + statuses.suspended + statuses.closed === 0) errors.push('Valid markets exist but all recognized status counts are zero');
  if (total > 0 && times.withStartTime + times.withoutStartTime === 0) errors.push('Valid markets exist but all start-time counts are zero');
  if (total > 0 && runners.withRunners === 0) errors.push('Valid markets exist but no market contains runner data');
  if (statuses.open + statuses.suspended + statuses.closed + statuses.unknown !== total) errors.push('Status totals do not equal valid-market total');
  if (inPlay.inPlay + inPlay.notInPlay + inPlay.unknownInPlay !== total) errors.push('In-play totals do not equal valid-market total');
  if (times.withStartTime + times.withoutStartTime !== total) errors.push('Start-time totals do not equal valid-market total');
  if (prices.withPriceData + prices.missingPriceData !== total) errors.push('Price totals do not equal valid-market total');
  if (snapshot.priceFeedStatus === 'LIVE' && !snapshot.timestamps.lastStreamUpdateAt) errors.push('Price feed cannot be LIVE without a stream timestamp');
  if (snapshot.connectionStates.stream === 'DISCONNECTED' && !snapshot.timestamps.lastStreamUpdateAt && snapshot.priceFeedStatus !== 'UNAVAILABLE') errors.push('Disconnected feed without a timestamp must be UNAVAILABLE');
  return errors;
}

function connectionState(value, configured = true) {
  if (!configured) return 'NOT_CONFIGURED';
  const raw = String(value || '').toLowerCase();
  if (['connected', 'polling', 'api_connected'].includes(raw)) return 'CONNECTED';
  if (['connecting', 'authenticating', 'subscribing', 'token_present_not_validated'].includes(raw)) return 'CONNECTING';
  if (['error', 'api_error', 'html_response', 'session_expired'].includes(raw)) return 'ERROR';
  return 'DISCONNECTED';
}

export function buildBetfairDiagnostics({ catalogueMarkets = [], marketBooks = [], streamMarkets = [], mergedMarkets = [], runners = [], connectionState: connection = {}, timestamps = {}, rawCounts = {}, samples = {}, settings = {} } = {}) {
  const runnerMap = new Map();
  for (const runner of array(runners)) {
    const id = marketIdOf(runner) || runner?.marketId;
    if (!id) continue;
    const list = runnerMap.get(String(id)) || [];
    list.push(runner);
    runnerMap.set(String(id), list);
  }
  const normalizedMarkets = array(mergedMarkets).map((market) => normalizeBetfairMarket({ ...market, runners: runnerMap.get(String(marketIdOf(market))) || array(market.runners) }, null, market.source === 'stream' || market.source === 'merged' ? market : null));
  const shapeErrors = normalizedMarkets.flatMap((market, index) => market.shapeErrors.map(error => `Market ${index + 1}: ${error}`));
  const valid = normalizedMarkets.filter(market => market.marketId && Array.isArray(market.runners) && (market.marketStartTime || market.missingMarketStartTime === true));
  const statusCounts = { open: 0, suspended: 0, closed: 0, unknown: 0 };
  const inPlayCounts = { inPlay: 0, notInPlay: 0, unknownInPlay: 0 };
  const startTimeCounts = { withStartTime: 0, withoutStartTime: 0 };
  const runnerCounts = { withRunners: 0, withoutRunners: 0 };
  const priceCounts = { withPriceData: 0, missingPriceData: 0 };
  let insideTimeWindow = 0;
  const now = Date.now();
  const windowStart = Number(settings.defaultTimeWindowStartSeconds ?? 500);
  const windowEnd = Number(settings.defaultTimeWindowEndSeconds ?? 30);
  for (const market of valid) {
    if (market.status === 'OPEN') statusCounts.open++; else if (market.status === 'SUSPENDED') statusCounts.suspended++; else if (market.status === 'CLOSED' || market.status === 'SETTLED') statusCounts.closed++; else statusCounts.unknown++;
    if (market.inPlay === true) inPlayCounts.inPlay++; else if (market.inPlay === false) inPlayCounts.notInPlay++; else inPlayCounts.unknownInPlay++;
    if (market.marketStartTime) { startTimeCounts.withStartTime++; const seconds = (new Date(market.marketStartTime).getTime() - now) / 1000; if (seconds > windowEnd && seconds <= windowStart) insideTimeWindow++; } else startTimeCounts.withoutStartTime++;
    if (market.hasRunnerData) runnerCounts.withRunners++; else runnerCounts.withoutRunners++;
    if (market.hasPriceData) priceCounts.withPriceData++; else priceCounts.missingPriceData++;
  }
  const api = connectionState(connection.apiValidationStatus || connection.apiStatus, connection.apiConfigured !== false);
  const stream = connectionState(connection.streamConnectionStatus || connection.streamStatus, connection.streamConfigured !== false);
  const lastStreamUpdateAt = timestamps.lastStreamUpdateAt || connection.lastStreamUpdateAt || null;
  const lastCatalogueRefreshAt = timestamps.lastCatalogueRefreshAt || connection.lastCatalogueRefreshAt || null;
  const authoritativePrice = calculatePriceFeedStatus(connection.lastPriceFetchAt || lastStreamUpdateAt, Date.now(), settings.dataFreshnessLimit || 30, stream === 'ERROR');
  const priceFeedStatus = stream === 'CONNECTED' && !connection.streamSubscribed ? 'UNAVAILABLE' : authoritativePrice.priceFeedStatus;
  const snapshotStatus = api === 'CONNECTED' || stream === 'CONNECTED' ? 'LIVE' : valid.length ? 'CACHED' : 'EMPTY';
  const uniqueCatalogueMarketIds = Number(rawCounts.uniqueCatalogueMarketIds ?? new Set(array(catalogueMarkets).map(marketIdOf).filter(Boolean)).size);
  const snapshot = {
    catalogueRecordsReturned: Number(rawCounts.catalogueRecordsReturned ?? catalogueMarkets.length), uniqueCatalogueMarketIds,
    marketBooksReturned: Number(rawCounts.marketBooksReturned ?? marketBooks.length), streamMarketsUpdated: Number(rawCounts.streamMarketsUpdated ?? streamMarkets.length),
    mergedHydratedMarkets: normalizedMarkets.filter(m => m.marketId).length, validHydratedMarkets: valid.length,
    totalMarkets: valid.length, openMarkets: statusCounts.open, suspendedMarkets: statusCounts.suspended, closedMarkets: statusCounts.closed,
    inPlayMarkets: inPlayCounts.inPlay, notInPlayMarkets: inPlayCounts.notInPlay, marketsWithStartTime: startTimeCounts.withStartTime,
    marketsWithRunners: runnerCounts.withRunners, marketsWithPriceData: priceCounts.withPriceData, missingPriceData: priceCounts.missingPriceData, insideTimeWindow,
    statusCounts, inPlayCounts, startTimeCounts, runnerCounts, priceCounts,
    connectionStates: { api, stream }, apiConnected: api, streamConnected: stream,
    priceFeedStatus, priceAgeSeconds: authoritativePrice.priceAgeSeconds, staleThresholdSeconds: authoritativePrice.staleThresholdSeconds, authoritativePriceTimestamp: authoritativePrice.authoritativePriceTimestamp, priceFeedStale: authoritativePrice.priceFeedStale, snapshotStatus, snapshotCapturedAt: timestamps.snapshotCapturedAt || new Date().toISOString(),
    timestamps: { lastStreamUpdateAt, lastCatalogueRefreshAt, lastMarketBookRefreshAt: timestamps.lastMarketBookRefreshAt || connection.lastPriceFetchAt || null },
    errors: { catalogue: connection.marketCatalogueError || null, marketBooks: connection.marketBookError || null, stream: connection.streamError || null, connection: connection.lastConnectionError || null },
    stream: { subscribedMarkets: Number(connection.subscribedMarkets || 0), marketsUpdated: Number(rawCounts.streamMarketsUpdated ?? streamMarkets.length) },
    samples: { catalogue: sanitize(samples.catalogue || catalogueMarkets[0] || null), marketBook: sanitize(samples.marketBook || marketBooks[0] || null), stream: sanitize(samples.stream || streamMarkets[0] || null), normalized: sanitize(valid[0] || normalizedMarkets[0] || null) },
    sourceMap: {
      totalMarkets: 'validHydratedMarkets from this canonical snapshot', openMarkets: 'normalizedMarkets.status = OPEN', suspendedMarkets: 'normalizedMarkets.status = SUSPENDED', closedMarkets: 'normalizedMarkets.status = CLOSED or SETTLED',
      inPlayMarkets: 'normalizedMarkets.inPlay = true', notInPlayMarkets: 'normalizedMarkets.inPlay = false only', marketsWithStartTime: 'normalizedMarkets.marketStartTime is a valid date',
      marketsWithRunners: 'normalizedMarkets.runners is non-empty', marketsWithPriceData: 'a normalized runner has a positive BACK or LAY price', missingPriceData: 'valid markets without price data',
      insideTimeWindow: 'valid market start time falls inside configured trading window', apiConnected: 'betfairConnection.apiValidationStatus mapped to explicit state', streamConnected: 'betfairConnection.streamConnectionStatus mapped to explicit state',
      lastStreamUpdateAt: 'betfairConnection.lastStreamUpdateAt (stream messages or heartbeats only)', lastCatalogueRefreshAt: 'betfairConnection.lastCatalogueRefreshAt',
    },
    normalizedMarkets, shapeErrors,
  };
  snapshot.consistencyErrors = validateBetfairDiagnostics(snapshot);
  return snapshot;
}

export function getBetfairDiagnosticsVerification(snapshot) {
  return {
    catalogueRecordsReturned: snapshot.catalogueRecordsReturned, uniqueCatalogueMarketIds: snapshot.uniqueCatalogueMarketIds,
    marketBooksReturned: snapshot.marketBooksReturned, streamMarketsUpdated: snapshot.streamMarketsUpdated,
    mergedHydratedMarkets: snapshot.mergedHydratedMarkets, validHydratedMarkets: snapshot.validHydratedMarkets,
    statusCounts: snapshot.statusCounts, runnerCounts: snapshot.runnerCounts, priceCounts: snapshot.priceCounts,
    connectionStates: snapshot.connectionStates, timestamps: snapshot.timestamps, consistencyErrors: snapshot.consistencyErrors,
    sampleNormalizedMarket: snapshot.samples.normalized,
  };
}

export { CONNECTION_STATES };