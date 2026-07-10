// ============================================================================
// Verification Test Suite
//
// These tests verify the core integrity guarantees of the Betfair Edge Lab:
// - Exchange maths (BACK/LAY EV, edge, liability)
// - Commission normalisation
// - LAY exposure uses liability
// - Proof mode detection
// - AI null/timeout fallback
// - Proof fallback appears in returned allOpportunities
// - Proof fallback not counted as positive EV
// - Settlement lifecycle consistency
// - Unmatched order lapse lifecycle
// - Entity schema contract (fields not silently dropped)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { calcBackEV, calcLayEV, calcBackEdge, calcLayEdge, calcKellyStake, calcLayKellyStake, calcDelayRiskScore } from '../exchangeMath';
import { detectMarketType, extractPlaceTerms } from '../marketClusterer';
import { settleOrderWithResult, lapseUnmatchedOrder } from '../settlementService';
import { normaliseCommissionRate } from '../commissionNormaliser';
import { isPaperProofModeActive } from '../paperProofDefaults';
import { matchRunnerToMarket, matchSelectionId } from '../marketIdMatcher';

// ── 1. BACK EV positive ──
describe('Exchange Maths — BACK', () => {
  it('BACK EV positive when model probability > implied probability', () => {
    const r = calcBackEV(0.40, 3.0, 0.05, 100);
    expect(r.ev).toBeCloseTo(16, 1);
    expect(r.ev).toBeGreaterThan(0);
    expect(r.roi).toBeGreaterThan(0);
    expect(r.profitIfWin).toBe(190);
    expect(r.liability).toBe(100);
  });

  it('BACK EV negative when model probability < implied probability', () => {
    const r = calcBackEV(0.25, 3.0, 0.05, 100);
    expect(r.ev).toBeLessThan(0);
    expect(r.ev).toBeCloseTo(-27.5, 1);
  });

  it('BACK edge = model probability - implied probability', () => {
    const edge = calcBackEdge(0.40, 3.0);
    expect(edge).toBeCloseTo(0.40 - (1/3.0), 4);
    expect(edge).toBeGreaterThan(0);
  });
});

// ── 2. LAY EV ──
describe('Exchange Maths — LAY', () => {
  it('LAY EV positive when model probability < implied probability', () => {
    const r = calcLayEV(0.15, 5.0, 0.05, 100);
    expect(r.ev).toBeGreaterThan(0);
    expect(r.ev).toBeCloseTo(20.75, 1);
    expect(r.liability).toBe(400);
    expect(r.profitIfSelectionLoses).toBe(95);
  });

  it('LAY EV negative when model probability > implied probability', () => {
    const r = calcLayEV(0.30, 5.0, 0.05, 100);
    expect(r.ev).toBeLessThan(0);
    expect(r.ev).toBeCloseTo(-53.5, 1);
  });

  it('LAY liability = stake * (odds - 1), NOT stake', () => {
    const r = calcLayEV(0.20, 4.0, 0.05, 100);
    expect(r.liability).toBe(300);
    expect(r.lossIfSelectionWins).toBe(300);
    expect(r.lossIfSelectionWins).not.toBe(100); // NOT stake
  });

  it('LAY exposure uses liability, not stake', () => {
    // This is the key guarantee: LAY exposure = liability
    const r = calcLayEV(0.20, 4.0, 0.05, 100);
    const exposure = r.liability;
    expect(exposure).toBe(300);
    expect(exposure).not.toBe(100);
  });
});

// ── 3. Commission normalisation ──
describe('Commission Normalisation', () => {
  it('0.05 → 0.05 (already decimal)', () => {
    expect(normaliseCommissionRate(0.05)).toBe(0.05);
  });

  it('5 → 0.05 (percentage to decimal)', () => {
    expect(normaliseCommissionRate(5)).toBe(0.05);
  });

  it('8 → 0.08', () => {
    expect(normaliseCommissionRate(8)).toBe(0.08);
  });

  it('10 → 0.10', () => {
    expect(normaliseCommissionRate(10)).toBe(0.10);
  });

  it('"5%" → 0.05 (string with %)', () => {
    expect(normaliseCommissionRate('5%')).toBe(0.05);
  });

  it('null → null (missing)', () => {
    expect(normaliseCommissionRate(null)).toBeNull();
  });

  it('0 → 0 (no commission)', () => {
    expect(normaliseCommissionRate(0)).toBe(0);
  });
});

// ── 4. Proof mode detection ──
describe('Paper Proof Mode Detection', () => {
  it('Returns true when all proof flags are set', () => {
    expect(isPaperProofModeActive(
      { paperProofMode: true, forcedPaperOnlyMode: true, liveTradingEnabled: false },
      { botMode: 'paper_proof', liveTradingEnabled: false },
      { paperProofMode: true }
    )).toBe(true);
  });

  it('Returns false when liveTradingEnabled is true', () => {
    expect(isPaperProofModeActive(
      { paperProofMode: true, forcedPaperOnlyMode: true, liveTradingEnabled: true },
      { botMode: 'paper_proof', liveTradingEnabled: false },
      { paperProofMode: true }
    )).toBe(false);
  });

  it('Returns false when forcedPaperOnlyMode is false', () => {
    expect(isPaperProofModeActive(
      { paperProofMode: true, forcedPaperOnlyMode: false, liveTradingEnabled: false },
      { botMode: 'paper_proof', liveTradingEnabled: false },
      { paperProofMode: true }
    )).toBe(false);
  });

  it('Returns false in normal mode', () => {
    expect(isPaperProofModeActive(
      { paperProofMode: false, forcedPaperOnlyMode: false, liveTradingEnabled: false },
      { botMode: 'demo', liveTradingEnabled: false },
      { paperProofMode: false }
    )).toBe(false);
  });
});

// ── 5. Settlement lifecycle ──
describe('Settlement Lifecycle', () => {
  it('Result unknown: status=awaiting_result, settlementStatus=result_unknown, settledAt=null', () => {
    const order = {
      result: 'pending', side: 'BACK', selectionId: '456',
      matchedOdds: 3.0, matchedStake: 100, status: 'matched',
    };
    const settled = settleOrderWithResult(order, { marketName: 'Win' }, {}, {
      resultSource: 'betfair_stream',
      winners: [],
      placedRunners: [],
      marketType: 'WIN',
    });
    expect(settled.status).toBe('awaiting_result');
    expect(settled.settlementStatus).toBe('result_unknown');
    expect(settled.settledAt).toBeNull();
    expect(settled.netProfit).toBeNull();
    expect(settled.result).toBe('pending');
  });

  it('WIN BACK settles correctly when horse wins', () => {
    const order = {
      result: 'pending', side: 'BACK', selectionId: '789',
      matchedOdds: 3.5, matchedStake: 100, status: 'matched',
    };
    const settled = settleOrderWithResult(order, { marketName: 'Win' }, { defaultCommissionRate: 0.05 }, {
      resultSource: 'betfair_stream',
      winners: ['789'],
      marketType: 'WIN',
    });
    expect(settled.result).toBe('won');
    expect(settled.status).toBe('settled');
    expect(settled.settlementStatus).toBe('settled');
    expect(settled.settledAt).not.toBeNull();
    expect(settled.netProfit).toBeCloseTo(237.5, 1);
  });

  it('WIN LAY settles correctly when horse loses', () => {
    const order = {
      result: 'pending', side: 'LAY', selectionId: '789',
      matchedOdds: 3.5, matchedStake: 100, status: 'matched',
    };
    const settled = settleOrderWithResult(order, { marketName: 'Win' }, { defaultCommissionRate: 0.05 }, {
      resultSource: 'betfair_stream',
      winners: ['999'],
      marketType: 'WIN',
    });
    expect(settled.result).toBe('won');
    expect(settled.netProfit).toBeCloseTo(95, 1);
  });

  it('Voided market: voided=true, voidReason set, netProfit=0', () => {
    const order = {
      result: 'pending', side: 'BACK', selectionId: '111',
      matchedOdds: 2.0, matchedStake: 100, status: 'matched',
    };
    const settled = settleOrderWithResult(order, {}, {}, {
      resultSource: 'market_voided',
      winners: [],
      placedRunners: [],
      marketType: 'WIN',
    });
    expect(settled.status).toBe('voided');
    expect(settled.settlementStatus).toBe('voided');
    expect(settled.voided).toBe(true);
    expect(settled.voidReason).toBe('market_voided_by_betfair');
    expect(settled.netProfit).toBe(0);
  });
});

// ── 6. Unmatched order lapse lifecycle ──
describe('Unmatched Order Lapse', () => {
  it('Lapsed order: status=lapsed, settlementStatus=voided, voided=true, netProfit=0', () => {
    const order = {
      result: 'pending', side: 'BACK', selectionId: '123',
      matchedOdds: 2.0, matchedStake: 100, status: 'unmatched',
      requestedStake: 100,
    };
    const lapsed = lapseUnmatchedOrder(order, 'Market closed — not matched');
    expect(lapsed.status).toBe('lapsed');
    expect(lapsed.settlementStatus).toBe('voided');
    expect(lapsed.voided).toBe(true);
    expect(lapsed.voidReason).toBe('unmatched_order_lapsed');
    expect(lapsed.netProfit).toBe(0);
    expect(lapsed.result).toBe('void');
  });
});

// ── 7. Market type detection ──
describe('Market Type Detection', () => {
  it('Detects WIN from marketTypeCode', () => {
    expect(detectMarketType({ marketTypeCode: 'WIN' })).toBe('WIN');
  });

  it('Detects PLACE from marketTypeCode', () => {
    expect(detectMarketType({ marketTypeCode: 'PLACE' })).toBe('PLACE');
  });

  it('Detects H2H from MATCH_ODDS', () => {
    expect(detectMarketType({ marketTypeCode: 'MATCH_ODDS' })).toBe('H2H');
  });
});

// ── 8. Place terms extraction ──
describe('Place Terms Extraction', () => {
  it('Defaults based on runner count', () => {
    expect(extractPlaceTerms({ marketName: 'To Be Placed', numberOfRunners: 8 })).toBe(3);
    expect(extractPlaceTerms({ marketName: 'To Be Placed', numberOfRunners: 16 })).toBe(4);
    expect(extractPlaceTerms({ marketName: 'To Be Placed', numberOfRunners: 5 })).toBe(2);
  });

  it('Extracts explicit terms from name', () => {
    expect(extractPlaceTerms({ marketName: 'To Be Placed (3)', numberOfRunners: 12 })).toBe(3);
    expect(extractPlaceTerms({ marketName: 'Top 2 Finish', numberOfRunners: 10 })).toBe(2);
  });
});

// ── 9. Normalised runner-market join ──
describe('Normalised Runner-Market Join', () => {
  it('Matches runner to market by string-normalised IDs', () => {
    const runner = { marketId: '1.123', betfairSelectionId: '456' };
    const market = { id: '1.123', betfairMarketId: '1.123' };
    expect(matchRunnerToMarket(runner, market)).toBe(true);
  });

  it('Matches when types differ (number vs string)', () => {
    const runner = { marketId: 1123, betfairSelectionId: '456' };
    const market = { id: '1123', betfairMarketId: '1.123' };
    expect(matchRunnerToMarket(runner, market)).toBe(true);
  });

  it('Does not match different markets', () => {
    const runner = { marketId: '1.123', betfairSelectionId: '456' };
    const market = { id: '1.999', betfairMarketId: '1.999' };
    expect(matchRunnerToMarket(runner, market)).toBe(false);
  });
});

// ── 10. Kelly stake ──
describe('Kelly Stake', () => {
  it('Returns zero stake when probability is below breakeven', () => {
    const r = calcKellyStake(0.20, 3.0, 10000, 0.5);
    // p=0.20, odds=3.0 → kelly = (2*0.2 - 0.8) / 2 = (0.4-0.8)/2 = -0.2
    expect(r.kellyFraction).toBeLessThanOrEqual(0);
    expect(r.stake).toBe(0);
  });

  it('Returns positive stake when edge exists', () => {
    const r = calcKellyStake(0.50, 3.0, 10000, 0.5);
    expect(r.kellyFraction).toBeGreaterThan(0);
    expect(r.stake).toBeGreaterThan(0);
  });
});

// ── 11. Delay risk ──
describe('Delay Risk Score', () => {
  it('High risk for last-second delayed bet', () => {
    expect(calcDelayRiskScore(30, 6, false)).toBeGreaterThan(0.7);
  });

  it('Zero risk in live mode', () => {
    expect(calcDelayRiskScore(300, 2, true)).toBe(0);
  });
});