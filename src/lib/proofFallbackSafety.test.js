import { describe, expect, it } from 'vitest';
import { buildProofOpportunity, getProofFallbackHardGate } from './paperProofScanner';
import { buildRaceMonitoringDiagnostics } from './raceMonitoringDiagnostics';

const now = new Date('2026-07-11T02:00:00.000Z').getTime();
const startTime = new Date(now + 120000).toISOString();
const market = { id:'1.100', betfairMarketId:'1.100', eventId:'e1', eventName:'Race 1', venue:'Eagle Farm', raceNumber:1, marketName:'Win', marketTypeCode:'WIN', numberOfWinners:1, status:'OPEN', inPlay:false, startTime, marketStartTime:startTime, totalMatched:1000 };
const runners = [
  { id:'r1', marketId:'1.100', selectionId:'1', runnerName:'One', status:'ACTIVE', bestBackPrice:2, bestBackSize:50, bestLayPrice:2.02, bestLaySize:50 },
  { id:'r2', marketId:'1.100', selectionId:'2', runnerName:'Two', status:'ACTIVE', bestBackPrice:3, bestBackSize:50, bestLayPrice:3.05, bestLaySize:50 },
];
const cluster = { eventId:'e1', eventName:'Race 1', venue:'Eagle Farm', raceNumber:1, startTime, winMarkets:[market], placeMarkets:[], h2hMarkets:[] };
const settings = { defaultCommissionRate:0.05, useMarketBaseRate:false, baseStake:2, maxStake:10, maxStakePercent:5, defaultTimeWindowStartSeconds:500, defaultTimeWindowEndSeconds:30 };
const unlocked = { raceLocked:false, activeOrderExistsForRace:false, duplicateMarketRecordDetected:false };
const context = extra => ({ priceFeedStatus:'LIVE', raceMonitoring:unlocked, now, windowStart:500, windowEnd:30, ...extra });

const build = (orders = [], safety = context()) => buildProofOpportunity([cluster], runners, orders, settings, safety);

describe('paper proof fallback hard gates', () => {
  it('does not create proof fallback when prices are unavailable', () => { expect(getProofFallbackHardGate(context({priceFeedStatus:'UNAVAILABLE'}))).toBe('PRICE_DATA_UNAVAILABLE'); expect(build([],context({priceFeedStatus:'UNAVAILABLE'}))).toBeNull(); });
  it('does not create proof fallback when the race is locked', () => { const locked={...unlocked,raceLocked:true,activeOrderExistsForRace:true}; expect(build([],context({raceMonitoring:locked}))).toBeNull(); });
  it('does not create a second order while awaiting a result', () => { expect(build([{id:'o1',eventId:'e1',status:'awaiting_result'}])).toBeNull(); });
  it('creates a proof candidate only when every hard gate passes', () => { expect(build()).toMatchObject({decision:'BET',proofMode:true,marketType:'WIN'}); });
  it('keeps PLACE proof orders blocked', () => { const place={...market,id:'1.200',betfairMarketId:'1.200',marketTypeCode:'PLACE',marketName:'Place',numberOfWinners:2}; const placeCluster={...cluster,winMarkets:[],placeMarkets:[place]}; const placeRunners=runners.map(item=>({...item,marketId:'1.200'})); expect(buildProofOpportunity([placeCluster],placeRunners,[],settings,context())).toBeNull(); });
});

describe('accepted engine market diagnostics', () => {
  it('marks the market sent to the engine as accepted', () => { const selectedRace={...cluster,raceKey:'e1',markets:[market]}; const report=buildRaceMonitoringDiagnostics({selectedRace,runners,acceptedMarketIds:['1.100'],now}); expect(report.selectedRaceMarketDetails).toEqual([expect.objectContaining({normalizedMarketId:'1.100',accepted:true})]); });
});