import { describe, expect, it } from 'vitest';
import {
  benchmarkResults, buildSnapshotEvents, dataQualityScore, empiricalBayes,
  errorBudget, measureAdverseSelection, probabilityEnsemble, replayAt, runDeterministicReplay,
  retirementReason, selectBanditProfile, selectClosingSnapshot, selectRegimeProfile,
  robustOpportunity, simulatePaperFill, survivalMonteCarlo, tuningRowsExcludingHoldout,
  validateFeatureRegistry,
} from './edgeDiscovery';

const event = (timestamp, price = 2) => ({ timestamp, marketId:'m', selectionId:'s', bestBackPrice:price, bestLayPrice:price + .02, inPlay:false, dataFreshness:'LIVE' });

describe('advanced edge discovery integrity', () => {
  it('replay never uses future snapshots', () => { const replay=replayAt([event('2026-01-01T00:00:00Z'),event('2026-01-01T00:00:10Z',3)],'2026-01-01T00:00:05Z'); expect(replay.snapshots[0].bestBackPrice).toBe(2); expect(replay.replayIntegrityPassed).toBe(true); });
  it('replays the decision engine from timestamp-valid state', async () => { const result=await runDeterministicReplay({events:[event('2026-01-01T00:00:00Z'),event('2026-01-01T00:00:10Z',3)],replayTimestamp:'2026-01-01T00:00:05Z',decisionEngine:({snapshots})=>({candidates:snapshots})}); expect(result.candidatesProduced).toBe(1); expect(result.result.candidates[0].bestBackPrice).toBe(2); });
  it('builds timestamp-valid snapshot inputs', () => { const rows=buildSnapshotEvents({markets:[{id:'m',canonicalRaceKey:'r',status:'OPEN'}],runners:[{marketId:'m',selectionId:'s'}],timestamp:'2026-01-01T00:00:00Z'}); expect(rows[0]).toMatchObject({timestamp:'2026-01-01T00:00:00Z',canonicalRaceKey:'r'}); });
  it('allows no-trade to win', () => expect(benchmarkResults([{result:'lost',netProfit:-2}]).noTradeWins).toBe(true));
  it('closing price is strictly pre-race', () => expect(selectClosingSnapshot([event('2026-01-01T00:00:01Z')],'2026-01-01T00:00:00Z')).toBeNull());
  it('fill never exceeds available size', () => expect(simulatePaperFill({stake:10,availableSize:2},'OPTIMISTIC').simulatedMatchedStake).toBeLessThanOrEqual(2));
  it('conservative fill is no better than optimistic', () => { const candidate={stake:10,availableSize:10,ev:2}; expect(simulatePaperFill(candidate,'CONSERVATIVE').finalSimulatedPL).toBeLessThanOrEqual(simulatePaperFill(candidate,'OPTIMISTIC').finalSimulatedPL); });
  it('adverse selection uses after-entry data only', () => expect(measureAdverseSelection({timestamp:'2026-01-01T00:00:05Z',odds:2,side:'BACK'},[event('2026-01-01T00:00:00Z'),event('2026-01-01T00:00:10Z')]).measuredAfterEntryOnly).toBe(true));
  it('ensemble weights sum to one', () => { const ensemble=probabilityEnsemble({marketImplied:.5,aiRaceModel:.6},{marketImplied:1,aiRaceModel:1},100); expect(Object.values(ensemble.componentWeights).reduce((a,b)=>a+b,0)).toBeCloseTo(1); });
  it('small samples shrink to parent', () => expect(empiricalBayes(.9,1,.5).shrunkEstimate).toBeLessThan(.6));
  it('data quality hard-fails stale data', () => expect(dataQualityScore({bestBackPrice:2,bestLayPrice:2.02,dataFreshness:'STALE',commissionRate:.05,canonicalRaceKey:'r'}).passed).toBe(false));
  it('robust EV lower bound blocks uncertain bets', () => { const result=robustOpportunity({side:'BACK',odds:2,stake:2,impliedProbability:.5,modelProbability:.51,finalProbabilityUsedInEV:.51,commissionRate:.05,bestBackPrice:2,bestLayPrice:2.02,dataFreshness:'LIVE',canonicalRaceKey:'r',runnerName:'Runner',fieldSize:8,availableSize:20,confidence:70,mathematicalInvariantsPassed:true,decision:'BET',gatesPassed:true,blockers:[]},{sampleSize:1}); expect(result.decision).toBe('NO_BET'); expect(result.robustEVLowerBound).toBeLessThanOrEqual(0); });
  it('regime falls back to side parent', () => expect(selectRegimeProfile([{profileId:'p',status:'CHALLENGER',segment:'BACK_WIN'}],{side:'BACK'}).profileId).toBe('p'));
  it('holdout is inaccessible to tuning', () => expect(tuningRowsExcludingHoldout([{id:'1'},{id:'2'}],[{locked:true,consumed:false,orderIds:['2']}]).map(order=>order.id)).toEqual(['1']));
  it('feature leakage fails the run', () => expect(validateFeatureRegistry([{featureName:'result',timestampAvailable:'x',validAtDecisionTime:false,usesResultData:true}]).passed).toBe(false));
  it('Monte Carlo uses race/day blocks', () => expect(survivalMonteCarlo([{canonicalRaceKey:'r',netProfit:1}]).blockUnit).toBe('RACE_OR_DAY'));
  it('bandit rejects unapproved profiles', () => expect(selectBanditProfile([{profileId:'x',status:'CHALLENGER',approvedForBandit:false}]).selection).toBe('NO_TRADE'));
  it('error budget blocks promotion', () => expect(errorBudget([{severity:'critical',resolved:false}]).promotionBlocked).toBe(true));
  it('retired profiles cannot reactivate', () => expect(retirementReason({status:'RETIRED'})).toBe('ALREADY_RETIRED'));
  it('every decision has a calculable quality gate', () => expect(dataQualityScore({}).hardFails.length).toBeGreaterThan(0));
});