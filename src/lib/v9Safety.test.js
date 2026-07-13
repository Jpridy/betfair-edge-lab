import { describe, expect, it, vi } from 'vitest';
import { authorizeAndCreatePaperOrder } from './orderAuthority';
import { validateCompleteMarketBook } from './marketBookValidation';
import { normalizeCommissionStrict } from './strictCommission';
import { createProposedStrategySignal, updateStrategySignal } from './strategySignalLifecycle';
import { completeAiTrace, beginAiTrace } from './aiObservability';
import { buildCalculationResult } from './exchangeMath';

const start = seconds => new Date(Date.now() + seconds * 1000).toISOString();
const runners = [
  { id: 'r1', marketId: 'm1', selectionId: '1', runnerName: 'One', status: 'ACTIVE', bestBackPrice: 2.02, bestLayPrice: 2.04, bestBackSize: 100, bestLaySize: 100 },
  { id: 'r2', marketId: 'm1', selectionId: '2', runnerName: 'Two', status: 'ACTIVE', bestBackPrice: 2.04, bestLayPrice: 2.06, bestBackSize: 100, bestLaySize: 100 },
];

const base = () => {
  const calculationResult = buildCalculationResult({ side: 'BACK', probability: 0.6, odds: 2.02, normalizedCommissionRate: 0.05, stake: 2 });
  return {
    opportunity: {
      decision: 'BET',
      gatesPassed: true,
      ...calculationResult,
      modelProbability: 0.6,
      finalProbabilityUsedInEV: 0.6,
      maxLoss: calculationResult.lossIfLose,
      confidence: 80,
      side: 'BACK',
      marketId: 'm1',
      betfairMarketId: 'm1',
      selectionId: '1',
      marketType: 'WIN',
      commissionRate: 0.05,
      calculationResult,
      mathematicalInvariantsPassed: true,
      dataSource: 'FEATHERLESS',
      availableSize: 100,
      requiredMinEdge: 1,
      requiredMinROI: 1,
      requiredMinConfidence: 50,
      requiredMinLiquidity: 20,
      requiredMinOdds: 1.5,
      requiredMaxOdds: 50,
      thresholdSource: 'WIN_MARKET_SETTINGS',
      reasons: [],
    },
    market: {
      id: 'm1',
      betfairMarketId: 'm1',
      eventId: 'e1',
      raceNumber: 1,
      status: 'OPEN',
      inPlay: false,
      startTime: start(300),
      marketStartTime: start(300),
      marketBaseRate: 0.05,
    },
    runner: { ...runners[0] },
    marketRunners: runners,
    settings: {
      forcedPaperOnlyMode: true,
      liveTradingEnabled: false,
      allowInPlay: false,
      dataFreshnessLimit: 30,
      defaultTimeWindowStartSeconds: 500,
      defaultTimeWindowEndSeconds: 30,
      minimumTradedVolume: 0,
      maxStake: 10,
      maxStakePercent: 5,
      maxMarketExposure: 1000,
      maxOpenOrders: 10,
    },
    botSettings: { liveTradingEnabled: false, botMode: 'paper' },
    featherlessSettings: { minEdge: 1, minConfidence: 50 },
    bankrollStats: { bankroll: 1000, available: 1000 },
    existingOrders: [],
    apiConnected: true,
    connectionState: { apiConnected: true, lastActualPriceUpdateAt: new Date().toISOString() },
    positiveEvOpportunityCount: 1,
    strategyRequiresAI: false,
    strategyName: 'Test',
    entityApi: { create: vi.fn(async value => ({ id: 'o1', ...value })) },
  };
};

describe('V9 absolute order authority', () => {
  it('stale prices cannot create an order', async () => {
    const context = base();
    context.connectionState.lastActualPriceUpdateAt = new Date(Date.now() - 60000).toISOString();
    const result = await authorizeAndCreatePaperOrder(context);
    expect(result.failedGate).toBe('STALE_PRICE_DATA');
    expect(context.entityApi.create).not.toHaveBeenCalled();
  });

  it('invalid sides cannot create an order', async () => {
    const context = base();
    context.opportunity.side = 'BUY';
    expect((await authorizeAndCreatePaperOrder(context)).failedGate).toBe('INVALID_SIDE');
    expect(context.entityApi.create).not.toHaveBeenCalled();
  });

  it('disconnected API cannot create an order', async () => {
    const context = base();
    context.apiConnected = false;
    expect((await authorizeAndCreatePaperOrder(context)).failedGate).toBe('BETFAIR_API_DISCONNECTED');
  });

  it('zero or negative EV cannot create an order', async () => {
    const context = base();
    context.opportunity.ev = 0;
    expect((await authorizeAndCreatePaperOrder(context)).failedGate).toBe('NON_POSITIVE_EV');
  });

  it('recalculates the order window immediately before persistence', async () => {
    const context = base();
    context.market.startTime = context.market.marketStartTime = start(900);
    expect((await authorizeAndCreatePaperOrder(context)).failedGate).toBe('TOO_EARLY_FOR_ORDER');
  });

  it('rejects a corrupt 614 percent book', () => {
    const corrupt = Array.from({ length: 7 }, (_, index) => ({ ...runners[0], id: `r${index}`, selectionId: String(index), bestBackPrice: 1.14, bestLayPrice: 1.15 }));
    const result = validateCompleteMarketBook(corrupt);
    expect(result.backBookPercentage).toBeGreaterThan(600);
    expect(result.valid).toBe(false);
  });

  it('stops on mathematical invariant violations', async () => {
    const context = base();
    context.opportunity.maxLoss = 99;
    expect((await authorizeAndCreatePaperOrder(context)).failedGate).toBe('MATH_INVARIANT_VIOLATION');
  });

  it('debug mode is read only and retains candidate calculations', async () => {
    const context = base();
    context.debugMode = true;
    const result = await authorizeAndCreatePaperOrder(context);
    expect(result.failedGate).toBe('DEBUG_MODE_READ_ONLY');
    expect(context.opportunity.ev).toBeGreaterThan(0);
    expect(context.entityApi.create).not.toHaveBeenCalled();
  });

  it('persists nonzero resolved commission and matching ranked maths', async () => {
    const context = base();
    context.market.marketBaseRate = 6;
    const calculationResult = buildCalculationResult({ side: 'BACK', probability: 0.6, odds: 2.02, normalizedCommissionRate: 0.06, stake: 2 });
    context.opportunity = { ...context.opportunity, ...calculationResult, maxLoss: calculationResult.lossIfLose, calculationResult };
    const result = await authorizeAndCreatePaperOrder(context);
    expect(result.authorized).toBe(true);
    expect(result.order.normalizedCommissionRate).toBe(0.06);
    expect(result.order.rawCommissionRate).toBe(6);
  });

  it('rejects final maths that differs from ranking', async () => {
    const context = base();
    context.opportunity.calculationResult = { ...context.opportunity.calculationResult, ev: context.opportunity.ev + 0.01 };
    expect((await authorizeAndCreatePaperOrder(context)).failedGate).toBe('MATH_INVARIANT_VIOLATION');
  });

  it('rejects a price move before persistence', async () => {
    const context = base();
    context.runner.bestBackPrice = 2.04;
    expect((await authorizeAndCreatePaperOrder(context)).failedGate).toBe('PRICE_MOVED');
    expect(context.entityApi.create).not.toHaveBeenCalled();
  });

  it('rechecks frozen market ROI thresholds', async () => {
    const context = base();
    context.opportunity.requiredMinROI = 50;
    expect((await authorizeAndCreatePaperOrder(context)).failedGate).toBe('ROI_BELOW_MINIMUM');
  });

  it('keeps H2H ordering blocked until its model is independently validated', async () => {
    const context = base();
    context.opportunity.marketType = 'H2H';
    context.opportunity.opponentSelectionId = '2';
    context.strategyRequiresAI = true;
    context.aiResult = { h2hProbabilities: [{ marketId: 'm1', selectionId: '1', opponentSelectionId: '2', pBeatsOpponent: 0.6 }] };
    const result = await authorizeAndCreatePaperOrder(context);
    expect(result.authorized).toBe(false);
    expect(result.failedGate).toBe('H2H_MODEL_NOT_VALIDATED');
  });
});

describe('V9 contracts', () => {
  it('strictly normalizes commission', () => {
    expect(normalizeCommissionStrict(6).rate).toBe(0.06);
    expect(normalizeCommissionStrict(8).rate).toBe(0.08);
    expect(normalizeCommissionStrict(0.06).rate).toBe(0.06);
    expect(normalizeCommissionStrict(NaN).valid).toBe(false);
    expect(normalizeCommissionStrict(-1).valid).toBe(false);
    expect(normalizeCommissionStrict(0.21).valid).toBe(false);
  });

  it('creates a signal once and then updates it', async () => {
    const api = {
      create: vi.fn(async value => ({ id: 's1', ...value })),
      update: vi.fn(async (id, value) => ({ id, ...value })),
    };
    const signal = await createProposedStrategySignal(api, { strategyName: 'x' });
    await updateStrategySignal(api, signal.id, 'active');
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it('uses the canonical AI runner-count field and reads the legacy alias', () => {
    const trace = beginAiTrace({ raceKey: 'x' });
    expect(completeAiTrace(trace, { aiTelemetry: { aiResponseRunnerCount: 2 }, runnerProbabilities: [] })).toMatchObject({ aiRunnerCountReturned: 2 });
  });
});
