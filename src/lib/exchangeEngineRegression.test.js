/**
 * Regression tests for exchangeOpportunityEngine — paperProofMode TDZ fix
 * and market-only fallback when AI is unavailable.
 *
 * Run in browser console:
 *   import('/src/lib/exchangeEngineRegression.test.js').then(m => m.runRegressionTests())
 */

import { describe, it, expect } from 'vitest';
import { runExchangeCycle } from './exchangeOpportunityEngine';

function makeMarket(id, type = 'WIN') {
  const start = new Date(Date.now() + 300000).toISOString();
  return {
    id,
    betfairMarketId: id,
    marketName: `Market ${id}`,
    marketTypeCode: type,
    marketType: type,
    eventId: 'evt1',
    eventName: 'Test Race',
    status: 'OPEN',
    inPlay: false,
    startTime: start,
    marketStartTime: start,
    numberOfRunners: 3,
    numberOfActiveRunners: 3,
    numberOfWinners: type === 'PLACE' ? 2 : 1,
    totalMatched: 5000,
    marketBaseRate: 0.05,
  };
}

function makeRunner(selId, name, back, lay, marketId) {
  return {
    id: `r${selId}`,
    marketId,
    betfairSelectionId: selId,
    selectionId: selId,
    runnerName: name,
    status: 'ACTIVE',
    handicap: 0,
    bestBackPrice: back,
    bestBackSize: 100,
    bestLayPrice: lay,
    bestLaySize: 100,
    lastTradedPrice: (back + lay) / 2,
  };
}

const BASE_SETTINGS = {
  minOdds: 1.5,
  maxOdds: 50,
  minLiquidity: 10,
  maxSpread: 7,
  bankroll: 10000,
  paperBankroll: 10000,
  baseStake: 2,
  maxStake: 5,
  maxLayLiability: 25,
  defaultCommissionRate: 0.05,
  useMarketBaseRate: true,
  allowInPlay: false,
  maxMarketExposure: 1000,
  maxOpenOrders: 10,
  maxTradesPerRunner: 1,
  maxTradesPerMarket: 5,
  maxTradesPerDay: 50,
  dailyLossLimit: 500,
  weeklyLossLimit: 2500,
  maxUnmatchedOrders: 10,
  minimumLiquidity: 10,
  minimumTradedVolume: 0,
  defaultTimeWindowStartSeconds: 500,
  defaultTimeWindowEndSeconds: 30,
  dataFreshnessLimit: 30,
};

const liveConnection = () => ({ apiConnected: true, streamConnected: true, lastActualPriceUpdateAt: new Date().toISOString() });

export async function testPaperProofMode_callAI_returnsNull_fallsBackToMarketOnly() {
  const markets = [makeMarket('1.1', 'WIN')];
  const runners = [
    makeRunner('1001', 'Horse A', 3.0, 3.1, '1.1'),
    makeRunner('1002', 'Horse B', 5.0, 5.2, '1.1'),
    makeRunner('1003', 'Horse C', 7.0, 7.2, '1.1'),
  ];
  const result = await runExchangeCycle({
    markets,
    runners,
    settings: { ...BASE_SETTINGS, paperProofMode: true, forcedPaperOnlyMode: true, liveTradingEnabled: false },
    botSettings: { botMode: 'paper_proof', paperProofMode: true, liveTradingEnabled: false },
    featherlessSettings: { enabled: true, debugScanMode: false, paperProofMode: true, allowDeterministicFallback: true },
    bankrollStats: { bankroll: 10000, available: 10000 },
    paperOrders: [],
    emergencyStop: false,
    connectionState: liveConnection(),
    callAI: async () => null,
  });

  const passed = !result.diagnostics.engineError
    && result.diagnostics.marketOnlyResultsCreated > 0
    && result.diagnostics.proofOverrideOpportunities > 0
    && result.diagnostics.opportunityFunnel.proofFallbackCreated === true;
  return {
    name: 'paperProofMode + callAI returns null → market-only diagnostics + proof override',
    passed,
    diagnostics: {
      opportunities: result.diagnostics.totalOpportunities,
      marketOnlyFallbacks: result.diagnostics.marketOnlyResultsCreated,
      proofFallbackCreated: result.diagnostics.opportunityFunnel.proofFallbackCreated,
      proofOverrideOpportunities: result.diagnostics.proofOverrideOpportunities,
      engineError: result.diagnostics.engineError,
      noBetReason: result.diagnostics.noBetReason,
      totalMarketsLoaded: result.diagnostics.totalMarketsLoaded,
      marketsSentToExchangeEngine: result.diagnostics.marketsSentToExchangeEngine,
    },
  };
}

export async function testDebugScanMode_callAI_throws_fallsBackToMarketOnly() {
  const markets = [makeMarket('1.2', 'WIN')];
  const runners = [
    makeRunner('2001', 'Horse D', 2.5, 2.6, '1.2'),
    makeRunner('2002', 'Horse E', 4.0, 4.1, '1.2'),
  ];
  const result = await runExchangeCycle({
    markets,
    runners,
    settings: { ...BASE_SETTINGS },
    botSettings: { botMode: 'demo' },
    featherlessSettings: { enabled: true, debugScanMode: true, allowDeterministicFallback: true },
    bankrollStats: { bankroll: 10000 },
    paperOrders: [],
    emergencyStop: false,
    connectionState: liveConnection(),
    callAI: async () => { throw new Error('ETIMEDOUT'); },
  });

  const passed = !result.diagnostics.engineError
    && result.diagnostics.totalOpportunities > 0
    && result.diagnostics.marketOnlyResultsCreated > 0;
  return {
    name: 'debugScanMode + callAI throws timeout → market-only fallback diagnostics',
    passed,
    diagnostics: {
      opportunities: result.diagnostics.totalOpportunities,
      marketOnlyFallbacks: result.diagnostics.marketOnlyResultsCreated,
      engineError: result.diagnostics.engineError,
    },
  };
}

export async function testNoReferenceError_forPaperProofMode() {
  const markets = [makeMarket('1.3', 'WIN')];
  const runners = [makeRunner('3001', 'Horse F', 3.0, 3.1, '1.3')];
  let threwReferenceError = false;
  let errorMessage = null;
  try {
    await runExchangeCycle({
      markets,
      runners,
      settings: { ...BASE_SETTINGS, paperProofMode: true },
      botSettings: { botMode: 'paper_proof', paperProofMode: true },
      featherlessSettings: { enabled: true, debugScanMode: false, paperProofMode: true, allowDeterministicFallback: true },
      bankrollStats: { bankroll: 10000 },
      paperOrders: [],
      emergencyStop: false,
      connectionState: liveConnection(),
      callAI: async () => null,
    });
  } catch (err) {
    errorMessage = err.message;
    threwReferenceError = err.message.includes('Cannot access') || err.message.includes('before initialization');
  }

  return {
    name: 'No ReferenceError for paperProofMode',
    passed: !threwReferenceError,
    diagnostics: { errorMessage },
  };
}

export async function testSafeDefaults_undefinedArgs_dontCrash() {
  let crashed = false;
  let errorMessage = null;
  try {
    await runExchangeCycle({});
  } catch (err) {
    crashed = true;
    errorMessage = err.message;
  }

  return {
    name: 'Undefined args do not crash engine',
    passed: !crashed,
    diagnostics: { errorMessage },
  };
}

export async function runRegressionTests() {
  const tests = [
    await testPaperProofMode_callAI_returnsNull_fallsBackToMarketOnly(),
    await testDebugScanMode_callAI_throws_fallsBackToMarketOnly(),
    await testNoReferenceError_forPaperProofMode(),
    await testSafeDefaults_undefinedArgs_dontCrash(),
  ];
  return { allPassed: tests.every(test => test.passed), tests };
}

describe('Exchange Engine — regression cases', () => {
  it('falls back in paper proof mode', async () => {
    const result = await testPaperProofMode_callAI_returnsNull_fallsBackToMarketOnly();
    expect(result.passed, JSON.stringify(result.diagnostics)).toBe(true);
  });
  it('falls back after debug timeout', async () => expect((await testDebugScanMode_callAI_throws_fallsBackToMarketOnly()).passed).toBe(true));
  it('avoids paper proof initialization errors', async () => expect((await testNoReferenceError_forPaperProofMode()).passed).toBe(true));
  it('handles empty arguments', async () => expect((await testSafeDefaults_undefinedArgs_dontCrash()).passed).toBe(true));
});
