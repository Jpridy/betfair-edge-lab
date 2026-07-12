import { describe, expect, it } from 'vitest';
import { reconcileRiskExposure } from './riskExposure';

describe('risk exposure reconciliation',()=>{it('includes awaiting_result orders',()=>{const result=reconcileRiskExposure([{status:'awaiting_result',settlementStatus:'awaiting_result',side:'BACK',matchedStake:10,eventId:'e',raceNumber:2,raceStartTime:'2026-07-12T04:00:00Z'}]);expect(result).toMatchObject({activeOrderCount:1,unresolvedMatchedOrderCount:1,totalBackExposure:10,totalExposure:10});});});