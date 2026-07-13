import { it, expect } from 'vitest';
import { generateOpportunitiesForEvent } from './crossMarketValueScanner';
import { calcBackEV, calcLayEV } from './exchangeMath';
import { calculateFavouriteContext } from './favouriteValueContext';

it('uses favourite-adjusted probability in EV, ROI, edge, fair odds and sorting fields', () => {
  const start = new Date(Date.now() + 120000).toISOString();
  const market = { id: 'm1', betfairMarketId: 'm1', eventId: 'e1', eventName: 'Race', venue: 'Test', raceNumber: 1, marketName: 'Win', marketTypeCode: 'WIN', marketType: 'WIN', status: 'OPEN', inPlay: false, startTime: start, marketStartTime: start, numberOfRunners: 2, numberOfActiveRunners: 2, totalMatched: 10000, marketBaseRate: 0.05 };
  const runners = [
    { id: 'r1', marketId: 'm1', betfairSelectionId: '1', selectionId: '1', runnerName: 'Favourite', status: 'ACTIVE', bestBackPrice: 2, bestBackSize: 500, bestLayPrice: 2.02, bestLaySize: 500, tradedVolumeAmount: 5000 },
    { id: 'r2', marketId: 'm1', betfairSelectionId: '2', selectionId: '2', runnerName: 'Rival', status: 'ACTIVE', bestBackPrice: 5, bestBackSize: 100, bestLayPrice: 5.2, bestLaySize: 100, tradedVolumeAmount: 500 },
  ];
  const cluster = { eventId: 'e1', canonicalRaceKey: 'e1:R1', raceKey: 'e1:R1', eventName: 'Race', venue: 'Test', raceNumber: 1, startTime: start, winMarkets: [market], placeMarkets: [], h2hMarkets: [], otherMarkets: [] };
  const favouriteContext = calculateFavouriteContext(runners);
  expect(favouriteContext?.favouriteLooksStrong).toBe(true);
  const ai = { dataQuality: 90, raceSummary: '', runnerProbabilities: [{ selectionId: '1', pWin: 0.55, pPlace: 0.7, confidence: 90 }, { selectionId: '2', pWin: 0.2, pPlace: 0.4, confidence: 80 }] };
  const settings = { paperBankroll: 10000, baseStake: 10, maxStake: 100, maxLayLiability: 1000, maxMarketExposure: 1000, maxOpenOrders: 10, defaultCommissionRate: 0.05, defaultTimeWindowStartSeconds: 500, defaultTimeWindowEndSeconds: 30 };
  const fs = { favouriteContextEnabled: true, favouriteContextMaxProbabilityAdjustment: 0.03, favouriteStrongConfidenceBoost: 5, favouriteWeakConfidencePenalty: 10, allowFavouriteLayOnlyWhenVulnerable: true, minConfidence: 0, winMinOdds: 1.01, winMaxOdds: 50, winMinLiquidity: 2, winMaxSpreadTicks: 20, winMinEdge: -100, winMinROI: -100 };
  const opportunities = generateOpportunitiesForEvent(cluster, runners, ai, settings, {}, fs, { bankroll: 10000, available: 10000, openPaperExposure: 0, todayPL: 0 }, [], null);
  const adjusted = opportunities.filter(opportunity => Math.abs(opportunity.favouriteContextAdjustment || 0) > 0);
  expect(opportunities.length).toBeGreaterThan(0);
  expect(adjusted.length, JSON.stringify(opportunities.map(item => ({ id: item.opportunityId, side: item.side, runner: item.runnerName, adj: item.favouriteContextAdjustment, reason: item.contextAdjustmentReason, finalProbabilityUsedInEV: item.finalProbabilityUsedInEV, modelProbability: item.modelProbability })))).toBeGreaterThan(0);
  for (const opportunity of adjusted) {
    const expected = opportunity.side === 'BACK'
      ? calcBackEV(opportunity.finalProbabilityUsedInEV, opportunity.odds, opportunity.commissionRate, opportunity.stake)
      : calcLayEV(opportunity.finalProbabilityUsedInEV, opportunity.odds, opportunity.commissionRate, opportunity.stake);
    expect(opportunity.modelProbability).toBeCloseTo(opportunity.finalProbabilityUsedInEV, 8);
    expect(opportunity.ev).toBeCloseTo(expected.ev, 8);
    expect(opportunity.roi).toBeCloseTo(expected.roi, 8);
    expect(opportunity.fairOdds).toBeCloseTo(1 / opportunity.finalProbabilityUsedInEV, 8);
  }
});
