import { describe, expect, it, vi } from 'vitest';
import { authorizeAndCreatePaperOrder } from './orderAuthority';
import { validateCompleteMarketBook } from './marketBookValidation';
import { normalizeCommissionStrict } from './strictCommission';
import { createProposedStrategySignal, updateStrategySignal } from './strategySignalLifecycle';
import { completeAiTrace, beginAiTrace } from './aiObservability';
import { buildCalculationResult } from './exchangeMath';

const start = seconds => new Date(Date.now() + seconds * 1000).toISOString();
const runners = [
  { id:'r1', marketId:'m1', selectionId:'1', runnerName:'One', status:'ACTIVE', bestBackPrice:2.02, bestLayPrice:2.04, bestBackSize:100, bestLaySize:100 },
  { id:'r2', marketId:'m1', selectionId:'2', runnerName:'Two', status:'ACTIVE', bestBackPrice:2.04, bestLayPrice:2.06, bestBackSize:100, bestLaySize:100 },
];
const base = () => {
  const calculationResult=buildCalculationResult({side:'BACK',probability:.6,odds:2.02,normalizedCommissionRate:.05,stake:2});
  return { opportunity:{decision:'BET',gatesPassed:true,...calculationResult,modelProbability:.6,finalProbabilityUsedInEV:.6,maxLoss:calculationResult.lossIfLose,confidence:80,side:'BACK',marketId:'m1',betfairMarketId:'m1',selectionId:'1',marketType:'WIN',commissionRate:.05,calculationResult,mathematicalInvariantsPassed:true,dataSource:'FEATHERLESS',reasons:[]}, market:{id:'m1',betfairMarketId:'m1',status:'OPEN',inPlay:false,startTime:start(300),marketStartTime:start(300),marketBaseRate:.05},runner:runners[0],marketRunners:runners,settings:{dataFreshnessLimit:30,defaultTimeWindowStartSeconds:500,defaultTimeWindowEndSeconds:30,maxStake:10,maxStakePercent:5,maxMarketExposure:1000,maxOpenOrders:10},featherlessSettings:{minEdge:1,minConfidence:50},bankrollStats:{bankroll:1000,available:1000},existingOrders:[],apiConnected:true,connectionState:{apiConnected:true,lastActualPriceUpdateAt:new Date().toISOString()},positiveEvOpportunityCount:1,strategyRequiresAI:false,strategyName:'Test',entityApi:{create:vi.fn(async value=>({id:'o1',...value}))} };
};

describe('V9 absolute order authority',()=>{
  it('stale prices cannot create an order',async()=>{const c=base();c.connectionState.lastActualPriceUpdateAt=new Date(Date.now()-60000).toISOString();const r=await authorizeAndCreatePaperOrder(c);expect(r.failedGate).toBe('STALE_PRICE_DATA');expect(c.entityApi.create).not.toHaveBeenCalled();});
  it('disconnected API cannot create an order',async()=>{const c=base();c.apiConnected=false;const r=await authorizeAndCreatePaperOrder(c);expect(r.failedGate).toBe('BETFAIR_API_DISCONNECTED');});
  it('zero or negative EV cannot create an order',async()=>{const c=base();c.opportunity.ev=0;expect((await authorizeAndCreatePaperOrder(c)).failedGate).toBe('NON_POSITIVE_EV');});
  it('recalculates the order window immediately before persistence',async()=>{const c=base();c.market.startTime=c.market.marketStartTime=start(900);expect((await authorizeAndCreatePaperOrder(c)).failedGate).toBe('TOO_EARLY_FOR_ORDER');});
  it('rejects a corrupt 614 percent book',()=>{const corrupt=Array.from({length:7},(_,i)=>({...runners[0],id:`r${i}`,selectionId:String(i),bestBackPrice:1.14,bestLayPrice:1.15}));const result=validateCompleteMarketBook(corrupt);expect(result.backBookPercentage).toBeGreaterThan(600);expect(result.valid).toBe(false);});
  it('stops on mathematical invariant violations',async()=>{const c=base();c.opportunity.maxLoss=99;expect((await authorizeAndCreatePaperOrder(c)).failedGate).toBe('MATH_INVARIANT_VIOLATION');});
  it('debug mode is read only and retains candidate calculations',async()=>{const c=base();c.debugMode=true;const r=await authorizeAndCreatePaperOrder(c);expect(r.failedGate).toBe('DEBUG_MODE_READ_ONLY');expect(c.opportunity.ev).toBeGreaterThan(0);expect(c.entityApi.create).not.toHaveBeenCalled();});
  it('persists nonzero resolved commission and matching ranked maths',async()=>{const c=base();c.market.marketBaseRate=6;const calculationResult=buildCalculationResult({side:'BACK',probability:.6,odds:2.02,normalizedCommissionRate:.06,stake:2});c.opportunity={...c.opportunity,...calculationResult,maxLoss:calculationResult.lossIfLose,calculationResult};const r=await authorizeAndCreatePaperOrder(c);expect(r.authorized).toBe(true);expect(r.order.normalizedCommissionRate).toBe(.06);expect(r.order.rawCommissionRate).toBe(6);});
  it('rejects final maths that differs from ranking',async()=>{const c=base();c.opportunity.calculationResult={...c.opportunity.calculationResult,ev:c.opportunity.ev+.01};expect((await authorizeAndCreatePaperOrder(c)).failedGate).toBe('MATH_INVARIANT_VIOLATION');});
});

describe('V9 contracts',()=>{
  it('strictly normalizes commission',()=>{expect(normalizeCommissionStrict(6).rate).toBe(.06);expect(normalizeCommissionStrict(8).rate).toBe(.08);expect(normalizeCommissionStrict(.06).rate).toBe(.06);expect(normalizeCommissionStrict(NaN).valid).toBe(false);expect(normalizeCommissionStrict(-1).valid).toBe(false);expect(normalizeCommissionStrict(.21).valid).toBe(false);});
  it('creates a signal once and then updates it',async()=>{const api={create:vi.fn(async x=>({id:'s1',...x})),update:vi.fn(async(id,x)=>({id,...x}))};const signal=await createProposedStrategySignal(api,{strategyName:'x'});await updateStrategySignal(api,signal.id,'active');expect(api.create).toHaveBeenCalledTimes(1);expect(api.update).toHaveBeenCalledTimes(1);});
  it('uses the canonical AI runner-count field and reads the legacy alias',()=>{const trace=beginAiTrace({raceKey:'x'});expect(completeAiTrace(trace,{aiTelemetry:{aiResponseRunnerCount:2},runnerProbabilities:[]})).toMatchObject({aiRunnerCountReturned:2});});
});