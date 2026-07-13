import { describe, expect, it } from 'vitest';
import { clusterMarketsByEvent, detectMarketType } from './marketClusterer';
import { buildRacePack } from './racePackBuilder';
import { calcLayEV } from './exchangeMath';
import { compareOpportunities } from './opportunityRanking';
import { exposureBlock } from './raceExposure';
import { strategyForDecisionSource, DECISION_SOURCES } from './decisionProvenance';
import { runExchangeCycle } from './exchangeOpportunityEngine';

const start = new Date(Date.now() + 300000).toISOString();
const market = (id, type, count = 8) => ({ id, betfairMarketId: id, eventId: 'e1', eventTypeId: '7', venue: 'Test', raceNumber: 2, startTime: start, marketStartTime: start, marketTypeCode: type, marketType: type, marketName: type, status: 'OPEN', numberOfRunners: count, totalMatched: 5000 });
const backPrices = [2, 3, 4, 5, 6, 7, 8, 9];
const layPrices = [2.02, 3.05, 4.1, 5.1, 6.2, 7.2, 8.2, 9.2];
const runners = (id, count) => Array.from({ length: count }, (_, index) => ({ id: `${id}_${index}`, marketId: id, betfairSelectionId: String(index + 1), runnerName: `Runner ${index + 1}`, status: 'ACTIVE', bestBackPrice: backPrices[index], bestLayPrice: layPrices[index], bestBackSize: 100, bestLaySize: 100 }));

describe('decision architecture', () => {
  it('counts eight runners as one WIN market', () => { const clusters = clusterMarketsByEvent([market('m1', 'WIN')]); expect(clusters[0].winMarkets).toHaveLength(1); });
  it('stores multiple runners inside one market object', () => { const cluster = clusterMarketsByEvent([market('m1', 'WIN')])[0]; const pack = buildRacePack(cluster, runners('m1', 8), [market('m1', 'WIN')], {}, {}, {}, [], null); expect(pack.markets).toHaveLength(1); expect(pack.markets[0].runners).toHaveLength(8); });
  it('blocks another order anywhere in the race', () => { const existing = [{ eventId: 'e1', status: 'matched', marketId: 'm1' }]; expect(exposureBlock(existing, market('m2', 'PLACE'), {})).toBe('DUPLICATE_RACE_EXPOSURE'); });
  it('does not move to another runner after an order', () => { const existing = [{ eventId: 'e1', settlementStatus: 'awaiting_result', marketId: 'm1' }]; expect(exposureBlock(existing, { ...market('m1', 'WIN'), id: 'm1' }, {})).toBe('DUPLICATE_MARKET_EXPOSURE'); expect(exposureBlock(existing, market('m2', 'PLACE'), {})).toBe('DUPLICATE_RACE_EXPOSURE'); });
  it('allows LAY to outrank BACK by comparable score', () => { const base = { decision: 'BET', confidence: 80, dataQuality: 80, fillProbability: 0.9, liquidityScore: 0.9, priceFreshnessScore: 1, spreadTicks: 1, delayRiskScore: 0.1, ev: 2, availableSize: 100, marketId: 'm1', selectionId: '1' }; const back = { ...base, side: 'BACK', roi: 0.04 }; const lay = { ...base, side: 'LAY', roi: 0.08 }; expect([back, lay].sort(compareOpportunities)[0].side).toBe('LAY'); });
  it('uses liability as LAY ROI denominator', () => { const result = calcLayEV(0.2, 4, 0.05, 10); expect(result.roi).toBeCloseTo(result.ev / 30); });
  it('keeps PLACE and H2H in race packs', () => { const markets = [market('w', 'WIN'), market('p', 'PLACE'), market('h', 'MATCH_BET', 2)]; const cluster = clusterMarketsByEvent(markets)[0]; const pack = buildRacePack(cluster, [...runners('w', 3), ...runners('p', 3), ...runners('h', 2)], markets, {}, {}, {}, [], null); expect(pack.markets.map(item => item.marketType)).toEqual(['WIN', 'PLACE', 'H2H']); });
  it('does not classify unknown racing markets as WIN', () => expect(detectMarketType(market('x', 'SOMETHING_NEW'))).toBe('UNKNOWN'));

  it('blocks an AI-required strategy when AI is unavailable', async () => {
    const currentMarket = market('ai-required', 'WIN', 2);
    const result = await runExchangeCycle({ markets: [currentMarket], runners: runners('ai-required', 2), settings: { defaultTimeWindowStartSeconds: 500, defaultTimeWindowEndSeconds: 30 }, botSettings: { selectedStrategies: ['Featherless AI Value Decision Engine'] }, featherlessSettings: { featherlessAlwaysRequired: true, allowDeterministicFallback: false, debugScanMode: true }, bankrollStats: { available: 10000 }, connectionState: { apiConnected: true, lastActualPriceUpdateAt: new Date().toISOString() }, callAI: async () => null });
    expect(result.bestOpportunity).toBeNull();
    expect(result.diagnostics.noBetReason).toBe('AI_REQUIRED_BUT_NOT_AVAILABLE');
  });

  it('labels deterministic fallback as diagnostic data and never as a normal bet', async () => {
    const currentMarket = market('fallback', 'WIN', 2);
    const result = await runExchangeCycle({ markets: [currentMarket], runners: runners('fallback', 2), settings: { defaultTimeWindowStartSeconds: 500, defaultTimeWindowEndSeconds: 30, baseStake: 2, maxStake: 5 }, botSettings: { selectedStrategies: ['Featherless AI Value Decision Engine'] }, featherlessSettings: { allowDeterministicFallback: true, debugScanMode: true, minConfidence: 0, winMinEdge: -100, winMinROI: -100, winMinLiquidity: 2, winMaxSpreadTicks: 100 }, bankrollStats: { available: 10000 }, connectionState: { apiConnected: true, lastActualPriceUpdateAt: new Date().toISOString() }, callAI: null });
    expect(result.diagnostics.marketOnlyResultsCreated).toBeGreaterThan(0);
    expect(result.bestOpportunity).toBeNull();
    expect(result.allOpportunities.every(item => item.decision !== 'BET')).toBe(true);
  });

  it('records metrics when AI is actually used', async () => { const currentMarket = market('ai-used', 'WIN', 2); const result = await runExchangeCycle({ markets: [currentMarket], runners: runners('ai-used', 2), settings: { defaultTimeWindowStartSeconds: 500, defaultTimeWindowEndSeconds: 30 }, botSettings: { selectedStrategies: ['Featherless AI Value Decision Engine'] }, featherlessSettings: { debugScanMode: true }, bankrollStats: { available: 10000 }, connectionState: { apiConnected: true, lastActualPriceUpdateAt: new Date().toISOString() }, callAI: async () => ({ runnerProbabilities: [{ selectionId: '1', pWin: 0.6, pPlace: 0.8, confidence: 70 }, { selectionId: '2', pWin: 0.4, pPlace: 0.7, confidence: 70 }], h2hProbabilities: [], dataQuality: 70 }) }); expect(result.diagnostics.aiCallsMade).toBe(1); expect(result.diagnostics.aiObservability[0]).toMatchObject({ aiRequested: true, aiCallStatus: 'success', aiRunnerCountReturned: 2 }); });
  it('labels deterministic and AI strategies truthfully', () => { expect(strategyForDecisionSource(DECISION_SOURCES.DETERMINISTIC_MARKET_ONLY)).toBe('Deterministic Market Value Engine'); expect(strategyForDecisionSource(DECISION_SOURCES.FEATHERLESS_AI)).toContain('Featherless'); });
});
