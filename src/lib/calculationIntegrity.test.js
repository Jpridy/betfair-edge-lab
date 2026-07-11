import { describe,expect,it } from 'vitest';
import { resolveCommissionRate } from './commission';
import { buildCalculationResult, calcKellyStake, calcLayKellyStake } from './exchangeMath';
import { estimatePlaceProbabilities, normalizeH2HProbabilities, normalizeWinProbabilities } from './probabilityNormalizer';
import { calculateRiskMetrics } from './riskCalculations';

describe('calculation integrity primitives',()=>{
 it('normalizes Betfair commission before EV',()=>{expect(resolveCommissionRate({marketBaseRate:6},{defaultCommissionRate:.05}).normalizedRate).toBe(.06);expect(resolveCommissionRate({marketBaseRate:.06},{defaultCommissionRate:.05}).normalizedRate).toBe(.06);});
 it('enforces BACK and LAY loss bounds',()=>{const back=buildCalculationResult({side:'BACK',probability:.01,odds:2,normalizedCommissionRate:.06,stake:2});expect(back.ev).toBeGreaterThanOrEqual(-2);expect(back.roi).toBeGreaterThanOrEqual(-1);const lay=buildCalculationResult({side:'LAY',probability:.99,odds:5,normalizedCommissionRate:.06,stake:2});expect(lay.ev).toBeGreaterThanOrEqual(-lay.liability);});
 it('uses commission-adjusted Kelly and permits zero',()=>{expect(calcKellyStake(.4,2,1000,1,.25,.05).stake).toBe(0);expect(calcKellyStake(.6,2,1000,1,.25,.05).stake).toBeLessThan(calcKellyStake(.6,2,1000,1,.25,0).stake);expect(calcLayKellyStake(.6,2,1000,1,.25,.05).stake).toBe(0);});
 it('PLACE totals equal winners and dominate WIN',()=>{const win=normalizeWinProbabilities([{selectionId:'1',pWin:.5},{selectionId:'2',pWin:.3},{selectionId:'3',pWin:.2}]);const place=estimatePlaceProbabilities(win,2);expect(place.reduce((s,x)=>s+x.pPlace,0)).toBeCloseTo(2,8);place.forEach(x=>expect(x.pPlace).toBeGreaterThanOrEqual(x.pWin));});
 it('H2H pairs sum to one and conflicts reject',()=>{const pairs=normalizeH2HProbabilities([{marketId:'m',selectionId:'a',opponentSelectionId:'b',pBeatsOpponent:.6}]);expect(pairs[0].pBeatsOpponent+pairs[1].pBeatsOpponent).toBe(1);expect(normalizeH2HProbabilities([{marketId:'m',selectionId:'a',opponentSelectionId:'b',pBeatsOpponent:.6},{marketId:'m',selectionId:'b',opponentSelectionId:'a',pBeatsOpponent:.6}])).toEqual([]);});
 it('WIN totals one and awaiting result remains exposure',()=>{expect(normalizeWinProbabilities([{selectionId:'1',pWin:.8},{selectionId:'2',pWin:.4}]).reduce((s,x)=>s+x.pWin,0)).toBeCloseTo(1,12);expect(calculateRiskMetrics([{side:'LAY',status:'awaiting_result',requestedStake:2,requestedOdds:4}],{}).openExposure).toBe(6);});
});