import { it, expect } from 'vitest';
import { generateOpportunitiesForEvent } from './crossMarketValueScanner';
import { calcBackEV, calcLayEV } from './exchangeMath';

it('uses favourite-adjusted probability in EV, ROI, edge, fair odds and sorting fields', () => {
  const start = new Date(Date.now() + 120000).toISOString();
  const market = { id:'m1', betfairMarketId:'m1', eventId:'e1', eventName:'Race', marketName:'Win', marketTypeCode:'WIN', status:'OPEN', inPlay:false, startTime:start, marketBaseRate:0.05 };
  const runners = [
    { id:'r1', marketId:'m1', betfairSelectionId:'1', runnerName:'Favourite', status:'ACTIVE', bestBackPrice:2, bestBackSize:500, bestLayPrice:2.02, bestLaySize:500, tradedVolumeAmount:5000 },
    { id:'r2', marketId:'m1', betfairSelectionId:'2', runnerName:'Rival', status:'ACTIVE', bestBackPrice:5, bestBackSize:100, bestLayPrice:5.2, bestLaySize:100, tradedVolumeAmount:500 },
  ];
  const cluster = { eventId:'e1', eventName:'Race', venue:'Test', startTime:start, winMarkets:[market], placeMarkets:[], h2hMarkets:[], otherMarkets:[] };
  const ai = { dataQuality:90, raceSummary:'', runnerProbabilities:[{ selectionId:'1', pWin:0.55, pPlace:0.7, confidence:90 }, { selectionId:'2', pWin:0.2, pPlace:0.4, confidence:80 }] };
  const settings = { paperBankroll:10000, baseStake:10, maxStake:100, maxLayLiability:1000, maxMarketExposure:1000, maxOpenOrders:10, defaultCommissionRate:0.05, defaultTimeWindowStartSeconds:500, defaultTimeWindowEndSeconds:30 };
  const fs = { favouriteContextEnabled:true, favouriteContextMaxProbabilityAdjustment:0.03, favouriteStrongConfidenceBoost:5, favouriteWeakConfidencePenalty:10, allowFavouriteLayOnlyWhenVulnerable:true, minConfidence:0, winMinOdds:1.01, winMaxOdds:50, winMinLiquidity:2, winMaxSpreadTicks:20, winMinEdge:-100, winMinROI:-100 };
  const opportunities = generateOpportunitiesForEvent(cluster, runners, ai, settings, {}, fs, { bankroll:10000, available:10000, openPaperExposure:0, todayPL:0 }, [], null);
  for (const opp of opportunities.filter(o => Math.abs(o.favouriteContextAdjustment || 0) > 0)) {
    const expected = opp.side === 'BACK' ? calcBackEV(opp.finalProbabilityUsedInEV, opp.odds, opp.commissionRate, opp.stake) : calcLayEV(opp.finalProbabilityUsedInEV, opp.odds, opp.commissionRate, opp.stake);
    expect(opp.modelProbability).toBeCloseTo(opp.finalProbabilityUsedInEV, 8);
    expect(opp.ev).toBeCloseTo(expected.ev, 8);
    expect(opp.roi).toBeCloseTo(expected.roi, 8);
    expect(opp.fairOdds).toBeCloseTo(1 / opp.finalProbabilityUsedInEV, 8);
  }
  expect(opportunities.some(o => Math.abs(o.favouriteContextAdjustment || 0) > 0)).toBe(true);
});