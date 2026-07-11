import { describe, expect, it } from 'vitest';
import { buildBetfairDiagnostics, normalizeBetfairMarket, validateBetfairDiagnostics } from './betfairDiagnostics';

const runner = { selectionId: '1', bestBackPrice: 2.4, bestLayPrice: 2.5 };
const market = { marketId: '1.1', status: 'OPEN', inPlay: false, marketStartTime: '2030-01-01T00:00:00Z', runners: [runner] };
const build = (overrides = {}) => buildBetfairDiagnostics({ mergedMarkets: [market], connectionState: { apiStatus: 'connected', streamStatus: 'connected', streamSubscribed: true }, timestamps: { lastStreamUpdateAt: '2029-12-31T23:59:00Z' }, ...overrides });

describe('Betfair diagnostics', () => {
  it('does not label 500 raw catalogue records as hydrated markets', () => { const d = buildBetfairDiagnostics({ rawCounts: { catalogueRecordsReturned: 500 } }); expect(d.catalogueRecordsReturned).toBe(500); expect(d.validHydratedMarkets).toBe(0); });
  it('counts normalized catalogue markets correctly', () => { const d = build({ catalogueMarkets: [market] }); expect(d.uniqueCatalogueMarketIds).toBe(1); expect(d.validHydratedMarkets).toBe(1); });
  it('keeps status totals equal to valid markets', () => { const d = build(); expect(Object.values(d.statusCounts).reduce((a, b) => a + b, 0)).toBe(d.validHydratedMarkets); });
  it('counts missing status as UNKNOWN', () => { expect(normalizeBetfairMarket({ marketId: 'x', runners: [] }).status).toBe('UNKNOWN'); });
  it('counts missing in-play as UNKNOWN', () => { const d = build({ mergedMarkets: [{ ...market, inPlay: undefined }] }); expect(d.inPlayCounts.unknownInPlay).toBe(1); });
  it('reports UNAVAILABLE when disconnected without a timestamp', () => { const d = build({ connectionState: { streamStatus: 'disconnected' }, timestamps: {} }); expect(d.priceFeedStatus).toBe('UNAVAILABLE'); });
  it('labels retained disconnected data as CACHED', () => { const d = build({ connectionState: { apiStatus: 'disconnected', streamStatus: 'disconnected' }, timestamps: {} }); expect(d.snapshotStatus).toBe('CACHED'); });
  it('derives every counter from one normalized snapshot', () => { const d = build(); expect(d.totalMarkets).toBe(d.validHydratedMarkets); expect(d.marketsWithPriceData + d.missingPriceData).toBe(d.validHydratedMarkets); });
  it('reports incorrect nested shapes explicitly', () => { const normalized = normalizeBetfairMarket([market], null, null); expect(normalized.shapeErrors.join(' ')).toContain('nested array shape'); });
  it('shows a real normalized priced market correctly', () => { const d = build(); expect(d.runnerCounts.withRunners).toBe(1); expect(d.priceCounts.withPriceData).toBe(1); expect(d.samples.normalized.marketId).toBe('1.1'); });
  it('detects contradictory snapshots', () => { const errors = validateBetfairDiagnostics({ validHydratedMarkets: 1, statusCounts: { open: 0, suspended: 0, closed: 0, settled: 0, unknown: 0 }, inPlayCounts: { inPlay: 0, notInPlay: 0, unknownInPlay: 1 }, startTimeCounts: { withStartTime: 1, withoutStartTime: 0 }, runnerCounts: { withRunners: 1, withoutRunners: 0 }, priceCounts: { withPriceData: 1, missingPriceData: 0 }, priceFeedStatus: 'UNAVAILABLE', connectionStates: { stream: 'DISCONNECTED' }, timestamps: {} }); expect(errors.length).toBeGreaterThan(0); });
});