// ============================================================================
// Exchange Engine — Deterministic Test Cases
//
// Run in browser console: import and call runExchangeTests()
// Or import individual test functions.
// ============================================================================

import { calcBackEV, calcLayEV, calcBackEdge, calcLayEdge, calcKellyStake, calcLayKellyStake, calcDelayRiskScore } from './exchangeMath';
import { detectMarketType, extractPlaceTerms } from './marketClusterer';
import { settleOrderWithResult, lapseUnmatchedOrder } from './settlementService';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── 1. BACK EV positive ──
test('BACK EV positive when model probability > implied probability', () => {
  // p=0.40, odds=3.0 → implied=0.333, edge=+6.7%
  const r = calcBackEV(0.40, 3.0, 0.05, 100);
  // profitIfWin = 100 * 2 * 0.95 = 190
  // ev = 0.40 * 190 - 0.60 * 100 = 76 - 60 = 16
  assert(r.ev > 0, `EV should be positive, got ${r.ev}`);
  assert(approx(r.ev, 16), `EV should be ~16, got ${r.ev}`);
  assert(r.roi > 0, 'ROI should be positive');
  assert(r.profitIfWin === 190, `profitIfWin should be 190, got ${r.profitIfWin}`);
  assert(r.liability === 100, `liability should equal stake, got ${r.liability}`);
});

// ── 2. BACK EV negative ──
test('BACK EV negative when model probability < implied probability', () => {
  // p=0.25, odds=3.0 → implied=0.333, edge=-8.3%
  const r = calcBackEV(0.25, 3.0, 0.05, 100);
  // ev = 0.25 * 190 - 0.75 * 100 = 47.5 - 75 = -27.5
  assert(r.ev < 0, `EV should be negative, got ${r.ev}`);
  assert(approx(r.ev, -27.5), `EV should be ~-27.5, got ${r.ev}`);
  assert(r.roi < 0, 'ROI should be negative');
});

// ── 3. LAY EV positive ──
test('LAY EV positive when model probability < implied probability', () => {
  // p=0.20 (horse unlikely to win), odds=5.0, stake=100
  // liability = 100 * 4 = 400
  // profitIfLoses = 100 * 0.95 = 95
  // ev = 0.80 * 95 - 0.20 * 400 = 76 - 80 = -4 ... hmm
  // Let me recalculate: p=0.15, odds=5.0
  // ev = 0.85 * 95 - 0.15 * 400 = 80.75 - 60 = 20.75
  const r = calcLayEV(0.15, 5.0, 0.05, 100);
  assert(r.ev > 0, `EV should be positive, got ${r.ev}`);
  assert(approx(r.ev, 20.75), `EV should be ~20.75, got ${r.ev}`);
  assert(r.liability === 400, `liability should be 400, got ${r.liability}`);
  assert(r.profitIfSelectionLoses === 95, `profitIfLoses should be 95, got ${r.profitIfSelectionLoses}`);
});

// ── 4. LAY EV negative ──
test('LAY EV negative when model probability > implied probability', () => {
  // p=0.30, odds=5.0 → implied=0.20, horse more likely than market thinks
  // ev = 0.70 * 95 - 0.30 * 400 = 66.5 - 120 = -53.5
  const r = calcLayEV(0.30, 5.0, 0.05, 100);
  assert(r.ev < 0, `EV should be negative, got ${r.ev}`);
  assert(approx(r.ev, -53.5), `EV should be ~-53.5, got ${r.ev}`);
});

// ── 5. Commission impact ──
test('Commission reduces BACK profit correctly', () => {
  const noComm = calcBackEV(0.50, 2.0, 0.0, 100);
  const withComm = calcBackEV(0.50, 2.0, 0.05, 100);
  // No commission: profitIfWin = 100 * 1 = 100
  // With 5% commission: profitIfWin = 100 * 1 * 0.95 = 95
  assert(noComm.profitIfWin === 100, `No-comm profit should be 100, got ${noComm.profitIfWin}`);
  assert(withComm.profitIfWin === 95, `5% comm profit should be 95, got ${withComm.profitIfWin}`);
  assert(withComm.ev < noComm.ev, 'Commission should reduce EV');
});

// ── 6. LAY liability calculation ──
test('LAY liability = stake * (odds - 1)', () => {
  const r = calcLayEV(0.20, 4.0, 0.05, 100);
  // liability = 100 * 3 = 300
  assert(r.liability === 300, `liability should be 300, got ${r.liability}`);
  assert(r.lossIfSelectionWins === 300, 'Loss if selection wins should equal liability');
  assert(r.profitIfSelectionLoses === 95, `profit should be stake*(1-comm)=95, got ${r.profitIfSelectionLoses}`);
});

// ── 7. Market base rate fallback ──
test('Market base rate detection from marketTypeCode', () => {
  assert(detectMarketType({ marketTypeCode: 'WIN' }) === 'WIN', 'WIN code → WIN');
  assert(detectMarketType({ marketTypeCode: 'PLACE' }) === 'PLACE', 'PLACE code → PLACE');
  assert(detectMarketType({ marketTypeCode: 'MATCH_ODDS' }) === 'H2H', 'MATCH_ODDS → H2H');
  assert(detectMarketType({ marketType: 'WIN' }) === 'WIN', 'marketType WIN → WIN');
});

// ── 8. Place market terms missing ──
test('Place terms extraction with missing explicit terms', () => {
  // No explicit place terms in name — should default based on runner count
  assert(extractPlaceTerms({ marketName: 'To Be Placed', numberOfRunners: 8 }) === 3, '8 runners → 3 places');
  assert(extractPlaceTerms({ marketName: 'To Be Placed', numberOfRunners: 16 }) === 4, '16 runners → 4 places');
  assert(extractPlaceTerms({ marketName: 'To Be Placed', numberOfRunners: 5 }) === 2, '5 runners → 2 places');
  // Explicit terms
  assert(extractPlaceTerms({ marketName: 'To Be Placed (3)', numberOfRunners: 12 }) === 3, 'Explicit (3) → 3');
  assert(extractPlaceTerms({ marketName: 'Top 2 Finish', numberOfRunners: 10 }) === 2, 'Top 2 → 2');
});

// ── 9. H2H opponent missing ──
test('H2H settlement with opponent missing from result', () => {
  const order = {
    result: 'pending', side: 'BACK', selectionId: '123',
    matchedOdds: 2.0, matchedStake: 100, status: 'matched',
  };
  // No winners provided → should be RESULT_UNKNOWN
  const settled = settleOrderWithResult(order, { marketName: 'H2H' }, {}, {
    resultSource: 'betfair_stream',
    winners: [],
    placedRunners: [],
    marketType: 'H2H',
  });
  assert(settled.status === 'awaiting_result', `Status should be awaiting_result, got ${settled.status}`);
  assert(settled.netProfit === null, 'netProfit should be null for unknown result');
  assert(settled.result === 'pending', 'result should remain pending');
});

// ── 10. Delayed API risk block ──
test('Delay risk score blocks scalping in delayed mode', () => {
  // Last-second bet in delayed mode
  const score = calcDelayRiskScore(30, 6, false);
  assert(score > 0.7, `Delay risk should be >0.7 for last-second delayed bet, got ${score}`);
  // Early market in live mode — no penalty
  const liveScore = calcDelayRiskScore(300, 2, true);
  assert(liveScore === 0, `Live mode should have 0 delay risk, got ${liveScore}`);
});

// ── 11. Result unknown settlement ──
test('Result unknown settlement does not guess', () => {
  const order = {
    result: 'pending', side: 'BACK', selectionId: '456',
    matchedOdds: 3.0, matchedStake: 100, status: 'matched',
  };
  // No winners, no placedRunners → unknown
  const settled = settleOrderWithResult(order, { marketName: 'Win' }, {}, {
    resultSource: 'betfair_stream',
    winners: [],
    placedRunners: [],
    marketType: 'WIN',
  });
  assert(settled.status === 'awaiting_result', `Should be awaiting_result, got ${settled.status}`);
  assert(settled.netProfit === null, 'netProfit should be null');
  assert(settled.settlementStatus === 'RESULT_UNKNOWN', 'settlementStatus should be RESULT_UNKNOWN');
  assert(settled.resultSource === 'betfair_stream', 'resultSource should be set');
});

// ── 12. WIN BACK settlement correct ──
test('WIN BACK settles correctly when horse wins', () => {
  const order = {
    result: 'pending', side: 'BACK', selectionId: '789',
    matchedOdds: 3.5, matchedStake: 100, status: 'matched',
  };
  const settled = settleOrderWithResult(order, { marketName: 'Win' }, { defaultCommissionRate: 0.05 }, {
    resultSource: 'betfair_stream',
    winners: ['789'],
    marketType: 'WIN',
  });
  assert(settled.result === 'won', 'BACK should win when horse wins');
  assert(settled.netProfit > 0, 'Should have positive profit');
  // grossProfit = (3.5-1) * 100 = 250, commission = 250 * 0.05 = 12.5, net = 237.5
  assert(approx(settled.netProfit, 237.5), `netProfit should be ~237.5, got ${settled.netProfit}`);
});

// ── 13. WIN LAY settlement correct ──
test('WIN LAY settles correctly when horse loses', () => {
  const order = {
    result: 'pending', side: 'LAY', selectionId: '789',
    matchedOdds: 3.5, matchedStake: 100, status: 'matched',
  };
  const settled = settleOrderWithResult(order, { marketName: 'Win' }, { defaultCommissionRate: 0.05 }, {
    resultSource: 'betfair_stream',
    winners: ['999'], // Different selection won
    marketType: 'WIN',
  });
  assert(settled.result === 'won', 'LAY should win when horse does NOT win');
  // profit = 100 * 0.95 = 95
  assert(approx(settled.netProfit, 95), `netProfit should be ~95, got ${settled.netProfit}`);
});

// ── 14. No random CLV ──
test('Settlement does not use random CLV when closingOdds missing', () => {
  const order = {
    result: 'pending', side: 'BACK', selectionId: '789',
    matchedOdds: 3.0, matchedStake: 100, status: 'matched',
  };
  const settled = settleOrderWithResult(order, { marketName: 'Win' }, { defaultCommissionRate: 0.05 }, {
    resultSource: 'betfair_stream',
    winners: ['789'],
    marketType: 'WIN',
    // No closingOdds provided
  });
  // CLV should be 0, not random
  assert(settled.clv === 0, `CLV should be 0 when no closingOdds, got ${settled.clv}`);
  assert(settled.closingOdds === null || settled.closingOdds === undefined || settled.closingOdds === 0,
    `closingOdds should be null/0, got ${settled.closingOdds}`);
});

// ── Helpers ──
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}
function approx(a, b, tol = 0.01) {
  return Math.abs(a - b) < tol;
}

/**
 * Run all tests and return results.
 */
export function runExchangeTests() {
  const results = [];
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      fn();
      results.push({ name, status: 'PASS' });
      passed++;
    } catch (err) {
      results.push({ name, status: 'FAIL', error: err.message });
      failed++;
    }
  }

  console.log(`\n=== Exchange Engine Tests ===`);
  console.log(`Passed: ${passed} / ${tests.length}`);
  if (failed > 0) {
    console.log(`Failed: ${failed}`);
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    });
  } else {
    console.log('All tests passed ✓');
  }

  return { passed, failed, total: tests.length, results };
}

export { tests };