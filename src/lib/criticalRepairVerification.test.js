import { describe, expect, it } from 'vitest';
import { runExchangeCycle } from './exchangeOpportunityEngine';
import { clearRaceDayCache } from './raceDayCache';
import { clearRacePackAiCache } from './racePackCache';

const startTime = new Date(Date.now() + 300000).toISOString();
const market = (id, type, count) => ({ id, betfairMarketId: id, eventId: 'critical-verification-race', eventTypeId: '7', eventName: 'Verification R2', venue: 'Verification Park', raceNumber: 2, startTime, marketStartTime: startTime, marketTypeCode: type, marketType: type, marketName: type, status: 'OPEN', inPlay: false, numberOfRunners: count, numberOfActiveRunners: count, totalMatched: 5000, marketBaseRate: 0.05, source: 'catalogue' });
const runner = (marketId, id, name, back, lay, backSize = 100, laySize = 100) => ({ id: `${marketId}_${id}`, marketId, betfairSelectionId: String(id), selectionId: String(id), runnerName: name, status: 'ACTIVE', bestBackPrice: back, bestLayPrice: lay, bestBackSize: backSize, bestLaySize: laySize, lastTradedPrice: (back + lay) / 2, source: 'catalogue' });
const markets = [market('verify-win', 'WIN', 8), market('verify-place', 'PLACE', 8), market('verify-h2h', 'MATCH_BET', 2)];
const winPrices = [[1, 'Alpha', 2.02, 2.04, 40, 40], [2, 'Bravo', 3.9, 4, 50, 1000], [3, 'Charlie', 6, 6.2], [4, 'Delta', 8, 8.2], [5, 'Echo', 10, 10.5], [6, 'Foxtrot', 13, 13.5], [7, 'Golf', 18, 19], [8, 'Hotel', 25, 27]];
const allRunners = [...winPrices.map(item => runner('verify-win', ...item)), ...winPrices.map(item => runner('verify-place', ...item)), runner('verify-h2h', 1, 'Alpha', 1.9, 1.92, 100, 100), runner('verify-h2h', 2, 'Bravo', 2.08, 2.1, 100, 100)];
const aiResult = { runnerProbabilities: [{ selectionId: '1', pWin: 0.56, pPlace: 0.8, confidence: 85 }, { selectionId: '2', pWin: 0.18, pPlace: 0.55, confidence: 85 }, { selectionId: '3', pWin: 0.1, pPlace: 0.4, confidence: 75 }, { selectionId: '4', pWin: 0.06, pPlace: 0.3, confidence: 70 }, { selectionId: '5', pWin: 0.04, pPlace: 0.22, confidence: 65 }, { selectionId: '6', pWin: 0.03, pPlace: 0.16, confidence: 60 }, { selectionId: '7', pWin: 0.02, pPlace: 0.1, confidence: 55 }, { selectionId: '8', pWin: 0.01, pPlace: 0.07, confidence: 50 }], h2hProbabilities: [{ marketId: 'verify-h2h', selectionId: '1', opponentSelectionId: '2', pBeatsOpponent: 0.44, confidence: 80 }], dataQuality: 85, confidence: 85, raceSummary: 'Structured selection probabilities' };
const settings = { defaultTimeWindowStartSeconds: 500, defaultTimeWindowEndSeconds: 30, baseStake: 2, maxStake: 5, paperBankroll: 10000, maxLayLiability: 1500, maxMarketExposure: 1000, maxOpenOrders: 10, dailyLossLimit: 500, allowInPlay: false, defaultCommissionRate: 0.05, dataFreshnessLimit: 30 };
const featherlessSettings = { enabled: true, modelName: 'verification-model', featherlessAlwaysRequired: true, allowDeterministicFallback: false, minConfidence: 0, winMinOdds: 1.01, winMaxOdds: 50, winMinLiquidity: 2, winMaxSpreadTicks: 100, winMinEdge: 0, winMinROI: 0, placeMinOdds: 1.01, placeMaxOdds: 50, placeMinLiquidity: 2, placeMaxSpreadTicks: 100, placeMinEdge: 0, placeMinROI: 0, h2hMinOdds: 1.01, h2hMaxOdds: 50, h2hMinLiquidity: 2, h2hMaxSpreadTicks: 100, h2hMinEdge: 0, h2hMinROI: 0, favouriteContextEnabled: false };

async function run(orders = []) {
  clearRaceDayCache();
  clearRacePackAiCache();
  return runExchangeCycle({
    markets,
    allMarkets: markets,
    runners: allRunners,
    settings,
    botSettings: { selectedStrategies: ['Featherless AI Value Decision Engine'] },
    featherlessSettings,
    bankrollStats: { bankroll: 10000, available: 10000, openPaperExposure: 0 },
    paperOrders: orders,
    connectionState: { apiConnected: true, streamConnected: true, lastActualPriceUpdateAt: new Date().toISOString() },
    callAI: async () => aiResult,
    maxEventsToScan: 1,
  });
}

describe('critical repair verification', () => {
  it('proves grouping, side-neutral candidate generation and race exposure blocking', async () => {
    const first = await run();
    const representative = first.bestOpportunity || first.topRankedOpportunity || first.bestRejectedCandidate;
    expect(first.diagnostics.selectedRaceMarketCoverage).toMatchObject({ uniqueWinMarketCount: 1, uniquePlaceMarketCount: 1, uniqueH2HMarketCount: 1, totalUniqueMarketCount: 3 });
    expect(first.diagnostics.candidateCountByMarketTypeAndSide).toMatchObject({ WIN_BACK: 8, WIN_LAY: 8, PLACE_BACK: 8, PLACE_LAY: 8, H2H_BACK: 2, H2H_LAY: 2 });
    expect(first.diagnostics.sideSelectionDiagnostics.bestBackOpportunityId || first.allOpportunities.find(item => item.side === 'BACK')?.opportunityId).toBeTruthy();
    expect(first.diagnostics.sideSelectionDiagnostics.bestLayOpportunityId || first.allOpportunities.find(item => item.side === 'LAY')?.opportunityId).toBeTruthy();
    expect(representative).toBeTruthy();

    const existing = { eventId: 'critical-verification-race', marketId: representative.marketId, betfairMarketId: representative.betfairMarketId, status: 'matched', settlementStatus: 'awaiting_result', selectionId: representative.selectionId, side: representative.side };
    const second = await run([existing]);
    expect(second.bestOpportunity).toBeNull();
    expect(second.allOpportunities.every(item => item.decision === 'REJECT' && ['DUPLICATE_MARKET_EXPOSURE', 'DUPLICATE_RACE_EXPOSURE'].includes(item.failedGate))).toBe(true);
    console.log('CRITICAL_REPAIR_REPORT', JSON.stringify({ raceKey: 'critical-verification-race', coverage: first.diagnostics.selectedRaceMarketCoverage, candidates: first.diagnostics.candidateCountByMarketTypeAndSide, ai: first.diagnostics.aiObservability[0], representative: { opportunityId: representative.opportunityId, marketType: representative.marketType, side: representative.side, runner: representative.runnerName, score: representative.riskAdjustedScore, ev: representative.ev, roi: representative.roi, reason: first.diagnostics.sideSelectionDiagnostics.selectedSideReason, decisionSource: representative.decisionSource, decision: representative.decision, failedGate: representative.failedGate }, sideValidation: first.diagnostics.sideSelectionDiagnostics, secondOrder: { blocked: second.bestOpportunity === null, failedGates: [...new Set(second.allOpportunities.map(item => item.failedGate))] } }));
  });
});
