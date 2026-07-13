import { describe, expect, it } from 'vitest';
import { calculatePortfolioAccounting } from './portfolioAccounting';

const settled = (id, result, gross, commission, side = 'BACK', stake = 2, odds = 2) => ({
  id,
  status: 'settled',
  settlementStatus: 'settled',
  result,
  grossProfit: gross,
  commission,
  netProfit: gross - commission,
  side,
  matchedStake: stake,
  matchedOdds: odds,
  settledAt: '2026-07-12T05:00:00Z',
});

describe('authoritative portfolio accounting', () => {
  it('keeps gross winnings, losses, gross P/L and net P/L distinct', () => {
    const orders = [
      settled('w1', 'won', 2, 0.12, 'LAY'),
      settled('w2', 'won', 2, 0.12, 'LAY'),
      settled('l1', 'lost', -7.2, 0),
      settled('l2', 'lost', -5.3, 0),
      settled('l3', 'lost', -2, 0),
      settled('l4', 'lost', -2, 0),
      settled('l5', 'lost', -2, 0),
      { id: 'p', status: 'matched', settlementStatus: 'awaiting_result', result: 'pending', side: 'BACK', matchedStake: 21.4, matchedOdds: 2, remaining_size: 0 },
    ];
    const accounting = calculatePortfolioAccounting(orders, 10000);
    expect(accounting).toMatchObject({
      grossWinnings: 4,
      grossLosses: -18.5,
      absoluteGrossLosses: 18.5,
      grossRealisedPL: -14.5,
      commissionPaid: 0.24,
      netRealisedPL: -14.74,
      currentEquity: 9985.26,
      totalOpenExposure: 21.4,
      availableBankroll: 9963.86,
      accountingReconciliationPassed: true,
    });
    expect(accounting.profitFactor).toBeCloseTo(0.2162, 4);
  });

  it('charges no commission on a loss and preserves zero values', () => {
    const accounting = calculatePortfolioAccounting([settled('zero', 'lost', 0, 0)], 100);
    expect(accounting.grossWinnings).toBe(0);
    expect(accounting.grossLosses).toBe(0);
    expect(accounting.netRealisedPL).toBe(0);
    expect(accounting.accountingReconciliationPassed).toBe(true);

    const invalid = calculatePortfolioAccounting([settled('bad-loss', 'lost', -2, 0.12)], 100);
    expect(invalid.reconciliationErrors).toContain('LOSING_ORDER_COMMISSION:bad-loss');
  });

  it('reconciles winning gross less commission', () => {
    const accounting = calculatePortfolioAccounting([settled('win', 'won', 2, 0.12, 'LAY')], 100);
    expect(accounting.netRealisedPL).toBe(1.88);
  });

  it('includes economically resolved legacy records while flagging stale status fields', () => {
    const legacy = {
      id: 'legacy-loss',
      result: 'lost',
      status: 'awaiting_result',
      settlementStatus: 'awaiting_result',
      grossProfit: -2,
      commission: 0,
      netProfit: -2,
      side: 'BACK',
      matchedStake: 2,
      matchedOdds: 3,
      settledAt: '2026-07-12T05:00:00Z',
    };
    const accounting = calculatePortfolioAccounting([legacy], 100);
    expect(accounting.netRealisedPL).toBe(-2);
    expect(accounting.totalOpenExposure).toBe(0);
    expect(accounting.resolvedButStateInconsistentCount).toBe(1);
    expect(accounting.accountingDataInconsistent).toBe(true);
    expect(accounting.accountingReconciliationPassed).toBe(false);
    expect(accounting.reconciliationErrors).toContain('RESULT_STATE_MISMATCH:legacy-loss');
  });
});
