// ============================================================================
// Favourite Value Context Tests
//
// Tests for favourite detection, field strength analysis, context scoring,
// probability adjustments, LAY safety guards, and debug scan diagnostics.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  detectFavourite,
  calculateFavouriteContext,
  calculateRunnerContextScores,
  applyFavouriteContextToOpportunity,
  generateSpecificNoBetReason,
  buildFavouriteValueDiagnostics,
  FIELD_STRENGTH,
  resolveFavouriteSettings,
} from './favouriteValueContext';

// ── Test helpers ──
function makeRunner(selectionId, name, backPrice, layPrice, opts = {}) {
  return {
    betfairSelectionId: String(selectionId),
    runnerName: name,
    status: 'ACTIVE',
    bestBackPrice: backPrice || 0,
    bestLayPrice: layPrice || 0,
    bestBackSize: opts.backSize ?? 100,
    bestLaySize: opts.laySize ?? 100,
    tradedVolumeAmount: opts.tradedVol ?? 1000,
    ...opts,
  };
}

function makeBaseOpportunity(overrides = {}) {
  return {
    opportunityId: 'opp_test_1',
    eventId: 'evt_1',
    marketId: '1.mkt_1',
    betfairMarketId: '1.mkt_1',
    marketType: 'WIN',
    marketTypeCode: 'WIN',
    selectionId: '1001',
    runnerName: 'Test Horse',
    side: 'BACK',
    odds: 3.0,
    modelProbability: 0.40,
    impliedProbability: 0.333,
    finalProbabilityUsedInEV: 0.40,
    confidence: 60,
    dataQuality: 60,
    ev: 5.0,
    roi: 0.05,
    edge: 0.067,
    blockers: [],
    reasons: [],
    ...overrides,
  };
}

const DEFAULT_SETTINGS = {
  favouriteContextEnabled: true,
  favouriteContextMaxProbabilityAdjustment: 0.03,
  favouriteStrongConfidenceBoost: 5,
  favouriteWeakConfidencePenalty: 10,
  requireFavouriteContextForWinMarket: false,
  allowFavouriteLayOnlyWhenVulnerable: true,
};

// ── Tests ──

describe('Favourite Detection', () => {
  it('detects favourite from lowest bestBackPrice', () => {
    const runners = [
      makeRunner('1001', 'Long Shot', 15.0, 16.0),
      makeRunner('1002', 'Favourite', 2.5, 2.6),
      makeRunner('1003', 'Second', 4.0, 4.2),
    ];
    const fav = detectFavourite(runners);
    expect(fav).not.toBeNull();
    expect(fav.selectionId).toBe('1002');
    expect(fav.runnerName).toBe('Favourite');
    expect(fav.favouriteOdds).toBe(2.5);
    expect(fav.favouriteImpliedProbability).toBeCloseTo(1 / 2.5, 4);
  });

  it('falls back to bestLayPrice when bestBackPrice is missing', () => {
    const runners = [
      makeRunner('1001', 'No Back', 0, 3.0),
      makeRunner('1002', 'Has Back', 5.0, 5.2),
    ];
    const fav = detectFavourite(runners);
    expect(fav).not.toBeNull();
    expect(fav.selectionId).toBe('1001');
    expect(fav.favouriteOdds).toBe(3.0);
  });

  it('returns null when no valid price exists', () => {
    const runners = [
      makeRunner('1001', 'No Price', 0, 0),
      makeRunner('1002', 'Also No Price', 0, 0),
    ];
    const fav = detectFavourite(runners);
    expect(fav).toBeNull();
  });

  it('returns null for empty runner list', () => {
    expect(detectFavourite([])).toBeNull();
    expect(detectFavourite(null)).toBeNull();
  });
});

describe('Favourite Context Missing Does Not Crash', () => {
  it('returns null when no favourite can be detected', () => {
    const runners = [makeRunner('1', 'No Price', 0, 0)];
    const ctx = calculateFavouriteContext(runners);
    expect(ctx).toBeNull();
  });

  it('applyFavouriteContextToOpportunity handles null context gracefully', () => {
    const opp = makeBaseOpportunity();
    const result = applyFavouriteContextToOpportunity(opp, null, null, DEFAULT_SETTINGS);
    expect(result).not.toBeNull();
    expect(result.favouriteContextAdjustment).toBe(0);
    expect(result.finalProbabilityUsedInEV).toBe(opp.modelProbability);
  });

  it('applyFavouriteContextToOpportunity handles disabled setting', () => {
    const opp = makeBaseOpportunity();
    const ctx = calculateFavouriteContext([
      makeRunner('1001', 'Fav', 2.0, 2.1),
      makeRunner('1002', 'Other', 5.0, 5.2),
    ]);
    const result = applyFavouriteContextToOpportunity(opp, ctx, null, { ...DEFAULT_SETTINGS, favouriteContextEnabled: false });
    expect(result.favouriteContextAdjustment).toBe(0);
    expect(result.contextAdjustmentReason).toContain('disabled');
  });
});

describe('Field Strength Categories', () => {
  it('classifies a dominant favourite correctly', () => {
    // Favourite at 1.8 with implied prob 0.556, others at 10+ (low prob)
    const runners = [
      makeRunner('1001', 'Dominant', 1.8, 1.85),
      makeRunner('1002', 'Long1', 12.0, 13.0),
      makeRunner('1003', 'Long2', 15.0, 16.0),
      makeRunner('1004', 'Long3', 20.0, 22.0),
      makeRunner('1005', 'Long4', 25.0, 28.0),
    ];
    const ctx = calculateFavouriteContext(runners);
    expect(ctx).not.toBeNull();
    // With odds 1.8, implied prob ~0.556. Total overround likely ~1.1-1.2
    // Dominance = 0.556 / total. With 5 runners at long odds, total ~0.65
    // Dominance ~85% → DOMINANT
    expect([FIELD_STRENGTH.DOMINANT, FIELD_STRENGTH.STRONG]).toContain(ctx.fieldStrengthCategory);
    expect(ctx.favouriteLooksStrong).toBe(true);
  });

  it('classifies a weak favourite correctly', () => {
    // All runners around 3.0-5.0 — no clear favourite
    const runners = [
      makeRunner('1001', 'Equal1', 3.0, 3.1),
      makeRunner('1002', 'Equal2', 3.2, 3.3),
      makeRunner('1003', 'Equal3', 3.5, 3.6),
      makeRunner('1004', 'Equal4', 4.0, 4.2),
      makeRunner('1005', 'Equal5', 4.5, 4.7),
    ];
    const ctx = calculateFavouriteContext(runners);
    expect(ctx).not.toBeNull();
    expect([FIELD_STRENGTH.VULNERABLE, FIELD_STRENGTH.WEAK, FIELD_STRENGTH.MODERATE]).toContain(ctx.fieldStrengthCategory);
  });
});

describe('Dominant Favourite Boost', () => {
  it('gives small probability and confidence boost for BACK on dominant favourite', () => {
    const runners = [
      makeRunner('1001', 'Dominant', 1.8, 1.85),
      makeRunner('1002', 'Long1', 12.0, 13.0),
      makeRunner('1003', 'Long2', 15.0, 16.0),
      makeRunner('1004', 'Long3', 20.0, 22.0),
    ];
    const ctx = calculateFavouriteContext(runners);
    expect(ctx.favouriteLooksStrong).toBe(true);

    const opp = makeBaseOpportunity({
      selectionId: '1001',
      runnerName: 'Dominant',
      side: 'BACK',
      marketType: 'WIN',
      odds: 1.8,
      modelProbability: 0.55,
      finalProbabilityUsedInEV: 0.55,
      confidence: 60,
    });

    const result = applyFavouriteContextToOpportunity(opp, ctx, null, DEFAULT_SETTINGS);
    expect(result.isFavourite).toBe(true);
    expect(result.favouriteContextAdjustment).toBeGreaterThan(0);
    expect(result.finalProbabilityUsedInEV).toBeGreaterThan(opp.modelProbability);
    expect(result.confidence).toBeGreaterThan(60);
    expect(result.favouriteValueWarning).toBeNull();
  });

  it('caps probability adjustment to max setting', () => {
    const runners = [
      makeRunner('1001', 'Dominant', 1.5, 1.55),
      makeRunner('1002', 'Long1', 15.0, 16.0),
      makeRunner('1003', 'Long2', 20.0, 22.0),
    ];
    const ctx = calculateFavouriteContext(runners);

    const opp = makeBaseOpportunity({
      selectionId: '1001',
      side: 'BACK',
      marketType: 'WIN',
      modelProbability: 0.60,
      finalProbabilityUsedInEV: 0.60,
      confidence: 70,
    });

    const result = applyFavouriteContextToOpportunity(opp, ctx, null, DEFAULT_SETTINGS);
    expect(result.favouriteContextAdjustment).toBeLessThanOrEqual(0.03);
    expect(result.finalProbabilityUsedInEV).toBeLessThanOrEqual(0.99);
  });
});

describe('Weak Favourite Penalty', () => {
  it('reduces confidence for BACK on weak favourite', () => {
    const runners = [
      makeRunner('1001', 'Weak Fav', 4.0, 4.1),
      makeRunner('1002', 'Equal2', 4.2, 4.3),
      makeRunner('1003', 'Equal3', 4.5, 4.6),
      makeRunner('1004', 'Equal4', 5.0, 5.2),
      makeRunner('1005', 'Equal5', 5.5, 5.7),
      makeRunner('1006', 'Equal6', 6.0, 6.2),
    ];
    const ctx = calculateFavouriteContext(runners);
    expect(ctx.favouriteLooksVulnerable).toBe(true);

    const opp = makeBaseOpportunity({
      selectionId: '1001',
      side: 'BACK',
      marketType: 'WIN',
      confidence: 60,
    });

    const result = applyFavouriteContextToOpportunity(opp, ctx, null, DEFAULT_SETTINGS);
    expect(result.confidence).toBeLessThan(60);
    expect(result.favouriteValueWarning).not.toBeNull();
    expect(result.favouriteContextAdjustment).toBeLessThan(0);
  });
});

describe('BACK Favourite Does Not Pass Without Positive EV', () => {
  it('does not create a bet when EV is negative even with dominant favourite', () => {
    const runners = [
      makeRunner('1001', 'Dominant', 1.8, 1.85),
      makeRunner('1002', 'Long1', 12.0, 13.0),
    ];
    const ctx = calculateFavouriteContext(runners);

    const opp = makeBaseOpportunity({
      selectionId: '1001',
      side: 'BACK',
      marketType: 'WIN',
      ev: -2.0,
      edge: -0.05,
      blockers: ['Edge -5.00% below 3% minimum'],
      decision: 'NO_BET',
    });

    // The context layer adjusts probability/confidence but does NOT change the decision
    const result = applyFavouriteContextToOpportunity(opp, ctx, null, DEFAULT_SETTINGS);
    expect(result.decision).toBe('NO_BET');
    expect(result.blockers.length).toBeGreaterThan(0);
  });
});

describe('LAY Favourite Safety', () => {
  it('does not pass LAY favourite when favourite is not vulnerable/weak', () => {
    const runners = [
      makeRunner('1001', 'Dominant', 1.8, 1.85),
      makeRunner('1002', 'Long1', 12.0, 13.0),
      makeRunner('1003', 'Long2', 15.0, 16.0),
    ];
    const ctx = calculateFavouriteContext(runners);
    expect(ctx.favouriteLooksStrong).toBe(true);

    const opp = makeBaseOpportunity({
      selectionId: '1001',
      side: 'LAY',
      marketType: 'WIN',
      ev: 3.0,
      edge: 0.04,
      confidence: 60,
    });

    const result = applyFavouriteContextToOpportunity(opp, ctx, null, DEFAULT_SETTINGS);
    expect(result.favouriteValueWarning).toContain('LAY favourite blocked');
    expect(result.favouriteContextAdjustment).toBe(0);
  });

  it('allows LAY favourite when favourite is vulnerable and EV is positive', () => {
    const runners = [
      makeRunner('1001', 'Weak Fav', 4.0, 4.1),
      makeRunner('1002', 'Equal2', 4.2, 4.3),
      makeRunner('1003', 'Equal3', 4.5, 4.6),
      makeRunner('1004', 'Equal4', 5.0, 5.2),
      makeRunner('1005', 'Equal5', 5.5, 5.7),
      makeRunner('1006', 'Equal6', 6.0, 6.2),
    ];
    const ctx = calculateFavouriteContext(runners);
    expect(ctx.favouriteLooksVulnerable).toBe(true);

    const opp = makeBaseOpportunity({
      selectionId: '1001',
      side: 'LAY',
      marketType: 'WIN',
      ev: 5.0,
      edge: 0.06,
      confidence: 60,
    });

    const result = applyFavouriteContextToOpportunity(opp, ctx, null, DEFAULT_SETTINGS);
    // LAY on vulnerable favourite should NOT be blocked by the favourite context layer
    expect(result.favouriteValueWarning).toBeNull();
  });
});

describe('Automatic LAY Fallback Not Created', () => {
  it('does not create a LAY opportunity purely as fallback when BACK favourite fails', () => {
    const runners = [
      makeRunner('1001', 'Dominant', 1.8, 1.85),
      makeRunner('1002', 'Long1', 12.0, 13.0),
    ];
    const ctx = calculateFavouriteContext(runners);

    // BACK favourite that fails (negative EV)
    const backOpp = makeBaseOpportunity({
      selectionId: '1001',
      side: 'BACK',
      marketType: 'WIN',
      ev: -2.0,
      decision: 'NO_BET',
      blockers: ['No positive EV'],
    });
    const backResult = applyFavouriteContextToOpportunity(backOpp, ctx, null, DEFAULT_SETTINGS);

    // The context layer must NOT automatically create a LAY opportunity
    expect(backResult.side).toBe('BACK');
    expect(backResult.decision).toBe('NO_BET');
    // No new LAY opportunity is created — the function returns the same opportunity
  });
});

describe('Debug Scan Creates No Orders', () => {
  it('buildFavouriteValueDiagnostics is read-only and creates no orders', () => {
    const opps = [
      makeBaseOpportunity({ opportunityId: 'opp_1', ev: 5.0 }),
      makeBaseOpportunity({ opportunityId: 'opp_2', ev: -2.0, decision: 'NO_BET' }),
    ];
    const favs = [
      { favouriteSelectionId: '1001', fieldStrengthCategory: FIELD_STRENGTH.DOMINANT, favouriteDominanceScore: 60 },
    ];
    const diag = buildFavouriteValueDiagnostics(opps, favs);
    expect(diag).not.toBeNull();
    expect(diag.favouritesDetected).toBe(1);
    expect(diag.dominantFavourites).toBe(1);
    // No orders created — just diagnostics
    expect(typeof diag).toBe('object');
  });
});

describe('FinalProbabilityUsesCappedAdjustment', () => {
  it('finalProbabilityUsedInEV uses capped adjustment', () => {
    const runners = [
      makeRunner('1001', 'Dominant', 1.5, 1.55),
      makeRunner('1002', 'Long1', 20.0, 22.0),
      makeRunner('1003', 'Long2', 25.0, 28.0),
    ];
    const ctx = calculateFavouriteContext(runners);

    const opp = makeBaseOpportunity({
      selectionId: '1001',
      side: 'BACK',
      marketType: 'WIN',
      modelProbability: 0.60,
      finalProbabilityUsedInEV: 0.60,
      confidence: 70,
    });

    const result = applyFavouriteContextToOpportunity(opp, ctx, null, DEFAULT_SETTINGS);
    const adjustment = result.favouriteContextAdjustment;
    expect(Math.abs(adjustment)).toBeLessThanOrEqual(0.03);
    expect(result.finalProbabilityUsedInEV).toBeCloseTo(0.60 + adjustment, 4);
    expect(result.finalProbabilityUsedInEV).toBeGreaterThanOrEqual(0.01);
    expect(result.finalProbabilityUsedInEV).toBeLessThanOrEqual(0.99);
  });

  it('records full probability trace', () => {
    const runners = [
      makeRunner('1001', 'Fav', 2.0, 2.1),
      makeRunner('1002', 'Other', 5.0, 5.2),
      makeRunner('1003', 'Other2', 8.0, 8.5),
    ];
    const ctx = calculateFavouriteContext(runners);

    const opp = makeBaseOpportunity({
      selectionId: '1001',
      side: 'BACK',
      marketType: 'WIN',
      modelProbability: 0.45,
      finalProbabilityUsedInEV: 0.45,
    });

    const result = applyFavouriteContextToOpportunity(opp, ctx, null, DEFAULT_SETTINGS);
    expect(result).toHaveProperty('baseProbability');
    expect(result).toHaveProperty('favouriteContextAdjustment');
    expect(result).toHaveProperty('finalProbabilityUsedInEV');
    expect(result).toHaveProperty('contextAdjustmentReason');
    expect(result.baseProbability).toBe(0.45);
  });
});

describe('Specific NO BET Reasons', () => {
  it('returns specific reason for favourite with no value', () => {
    const runners = [
      makeRunner('1001', 'Fav', 2.0, 2.1),
      makeRunner('1002', 'Other', 5.0, 5.2),
    ];
    const ctx = calculateFavouriteContext(runners);

    const opp = makeBaseOpportunity({
      selectionId: '1001',
      side: 'BACK',
      marketType: 'WIN',
      ev: -1.0,
      blockers: [],
    });
    const reason = generateSpecificNoBetReason(opp, ctx, DEFAULT_SETTINGS);
    expect(reason).toContain('Favourite');
    expect(reason).not.toBe('No positive EV opportunity');
  });

  it('returns specific reason for liquidity failure', () => {
    const opp = makeBaseOpportunity({
      blockers: ['Liquidity $5.00 below $20 minimum'],
      ev: 5.0,
    });
    const reason = generateSpecificNoBetReason(opp, null, DEFAULT_SETTINGS);
    expect(reason).toBe('Liquidity too thin for safe entry');
  });

  it('returns specific reason for spread failure', () => {
    const opp = makeBaseOpportunity({
      blockers: ['Spread too wide — 15 ticks'],
      ev: 5.0,
    });
    const reason = generateSpecificNoBetReason(opp, null, DEFAULT_SETTINGS);
    expect(reason).toBe('Price spread too wide for reliable fill');
  });

  it('returns specific reason for confidence failure', () => {
    const opp = makeBaseOpportunity({
      blockers: ['Confidence 30 below 50'],
      ev: 5.0,
    });
    const reason = generateSpecificNoBetReason(opp, null, DEFAULT_SETTINGS);
    expect(reason).toBe('EV positive but confidence too low');
  });

  it('returns specific reason for LAY liability', () => {
    const opp = makeBaseOpportunity({
      side: 'LAY',
      blockers: ['Lay liability $2000 exceeds max $1500'],
      ev: 5.0,
    });
    const reason = generateSpecificNoBetReason(opp, null, DEFAULT_SETTINGS);
    expect(reason).toBe('LAY liability too high for current risk limits');
  });
});

describe('Decision Log Export Fields', () => {
  it('opportunity has all favourite context fields after adjustment', () => {
    const runners = [
      makeRunner('1001', 'Fav', 2.0, 2.1),
      makeRunner('1002', 'Other', 5.0, 5.2),
      makeRunner('1003', 'Other2', 8.0, 8.5),
    ];
    const ctx = calculateFavouriteContext(runners);
    const scores = calculateRunnerContextScores(runners, ctx, null);

    const opp = makeBaseOpportunity({
      selectionId: '1001',
      side: 'BACK',
      marketType: 'WIN',
    });

    const runnerScore = scores.find(s => s.selectionId === '1001');
    const result = applyFavouriteContextToOpportunity(opp, ctx, runnerScore, DEFAULT_SETTINGS);

    // Verify all required export fields are present
    expect(result).toHaveProperty('favouriteSelectionId');
    expect(result).toHaveProperty('favouriteName');
    expect(result).toHaveProperty('isFavourite');
    expect(result).toHaveProperty('favouriteOdds');
    expect(result).toHaveProperty('favouriteDominanceScore');
    expect(result).toHaveProperty('fieldStrengthCategory');
    expect(result).toHaveProperty('qualityThreatCount');
    expect(result).toHaveProperty('runnerContextScore');
    expect(result).toHaveProperty('marketScore');
    expect(result).toHaveProperty('formScore');
    expect(result).toHaveProperty('pressureScore');
    expect(result).toHaveProperty('favouriteContextAdjustment');
    expect(result).toHaveProperty('baseProbability');
    expect(result).toHaveProperty('finalProbabilityUsedInEV');
    expect(result).toHaveProperty('contextAdjustmentReason');
    expect(result).toHaveProperty('favouriteValueWarning');
  });
});

describe('Runner Context Scoring', () => {
  it('calculates scores for each runner', () => {
    const runners = [
      makeRunner('1001', 'Fav', 2.0, 2.1, { backSize: 200, laySize: 150, tradedVol: 5000 }),
      makeRunner('1002', 'Other', 5.0, 5.2, { backSize: 50, laySize: 30, tradedVol: 500 }),
    ];
    const ctx = calculateFavouriteContext(runners);
    const scores = calculateRunnerContextScores(runners, ctx, null);

    expect(scores.length).toBe(2);
    expect(scores[0]).toHaveProperty('marketScore');
    expect(scores[0]).toHaveProperty('formScore');
    expect(scores[0]).toHaveProperty('pressureScore');
    expect(scores[0]).toHaveProperty('totalContextScore');
    expect(scores[0]).toHaveProperty('dataQuality');
    expect(scores[0]).toHaveProperty('missingDataFields');
  });

  it('marks the favourite correctly in scores', () => {
    const runners = [
      makeRunner('1001', 'Fav', 2.0, 2.1),
      makeRunner('1002', 'Other', 5.0, 5.2),
    ];
    const ctx = calculateFavouriteContext(runners);
    const scores = calculateRunnerContextScores(runners, ctx, null);
    const favScore = scores.find(s => s.selectionId === '1001');
    expect(favScore.isFavourite).toBe(true);
  });
});