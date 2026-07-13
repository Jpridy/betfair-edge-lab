import { describe, expect, it } from 'vitest';
import { reconcileRiskExposure } from './riskExposure';

describe('risk exposure reconciliation', () => {
  it('includes awaiting_result orders', () => {
    const result = reconcileRiskExposure([{
      status: 'awaiting_result',
      settlementStatus: 'awaiting_result',
      result: 'pending',
      side: 'BACK',
      matchedStake: 10,
      eventId: 'e',
      raceNumber: 2,
      raceStartTime: '2026-07-12T04:00:00Z',
    }]);
    expect(result).toMatchObject({
      activeOrderCount: 1,
      unresolvedMatchedOrderCount: 1,
      totalBackExposure: 10,
      totalExposure: 10,
    });
  });

  it('does not double-count economically settled legacy orders as open exposure', () => {
    const result = reconcileRiskExposure([{
      status: 'awaiting_result',
      settlementStatus: 'awaiting_result',
      result: 'lost',
      grossProfit: -10,
      commission: 0,
      netProfit: -10,
      settledAt: '2026-07-12T05:00:00Z',
      side: 'BACK',
      matchedStake: 10,
      matchedOdds: 3,
      eventId: 'e',
      raceNumber: 2,
      raceStartTime: '2026-07-12T04:00:00Z',
    }]);
    expect(result).toMatchObject({
      activeOrderCount: 0,
      unresolvedMatchedOrderCount: 0,
      totalBackExposure: 0,
      totalExposure: 0,
    });
  });

  it('uses matched liability plus reserved unmatched liability for partial LAY orders', () => {
    const result = reconcileRiskExposure([{
      status: 'partially_matched',
      settlementStatus: 'awaiting_result',
      result: 'pending',
      side: 'LAY',
      requestedStake: 2,
      matchedStake: 1,
      remaining_size: 1,
      matchedOdds: 10,
      matchedCalculation: { stake: 1, odds: 10, liability: 9 },
      remainingUnmatchedCalculation: { stake: 1, odds: 10, liability: 9 },
      eventId: 'e',
      raceNumber: 3,
      raceStartTime: '2026-07-12T05:00:00Z',
    }]);
    expect(result).toMatchObject({
      activeOrderCount: 1,
      totalLayLiability: 18,
      totalExposure: 18,
    });
  });
});
