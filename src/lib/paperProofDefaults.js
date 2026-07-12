// ============================================================================
// Paper Proof Mode — Defaults, Detection, and Helpers
//
// Paper Proof Mode is a diagnostic preset that relaxes ALL value/AI/liquidity
// filters to prove the full pipeline works end-to-end:
//   Betfair data → opportunity generation → paper order → matching →
//   result detection → settlement → P/L update → decision log/export
//
// Live betting is ALWAYS disabled. No real Betfair orders. No live handoff.
// ============================================================================

export const PAPER_PROOF_MAX_STAKE=5;
export const PAPER_PROOF_MAX_LAY_LIABILITY=25;
export const PAPER_PROOF_BOT_SETTINGS = {
  botEnabled: true,
  botMode: 'paper_proof',
  scanIntervalSeconds: 10,
  autoPaperTradingEnabled: true,
  liveTradingLocked: true,
  liveTradingEnabled: false,
  requireLiveConfirmationText: true,
  maxBotCyclesPerHour: 360,
  stopOnApiError: false,
  stopOnDailyLoss: false,
  stopOnMaxDrawdown: false,
  stopOnLosingStreak: false,
  stopOnEmergency: true,
  paperProofMode: true,
};

export const PAPER_PROOF_APP_SETTINGS = {
  forcedPaperOnlyMode: true,
  liveTradingEnabled: false,
  riskLimitsDisabled: false,
  paperProofMode: true,
  paperBankroll: 10000,
  bankroll: 10000,
  baseStake: 2,
  maxStake: 5,
  maxStakePercent: 0.1,
  maxLayLiability: 25,
  dailyLossLimit: 999999,
  weeklyLossLimit: 999999,
  maxMarketExposure: 500,
  maxOpenOrders: 50,
  maxUnmatchedOrders: 50,
  maxTradesPerMarket: 10,
  maxTradesPerRunner: 1,
  maxTradesPerDay: 200,
  allowHedging: false,
  minimumLiquidity: 2,
  minimumTradedVolume: 0,
  minOdds: 1.01,
  maxOdds: 1000,
  defaultTimeWindowStartSeconds: 86400,
  defaultTimeWindowEndSeconds: 1,
  allowInPlay: false,
  persistApproved: false,
  defaultPersistenceType: 'LAPSE',
  defaultCommissionRate: 0.08,
  useMarketBaseRate: true,
  manualCommissionRate: null,
  apiPollingInterval: 5,
  marketRefreshInterval: 10,
  dataFreshnessLimit: 300,
  streamApiEnabled: true,
};

export const PAPER_PROOF_FEATHERLESS_SETTINGS = {
  enabled: false,
  paperTradeOnly: true,
  allowLiveHandoff: false,
  paperProofMode: true,
  minConfidence: 0,
  minEdge: -100,
  minExpectedROI: -100,
  minOdds: 1.01,
  maxOdds: 1000,
  minLiquidity: 2,
  timeWindowStart: 86400,
  timeWindowEnd: 1,
  stakingMode: 'flat_proof_stake',
  webResearchEnabled: false,
  aiDecisionMode: 'paper_proof',
  requireExternalFormData: false,
  targetPaperBetsPerDay: 'high',
  maxSpread: 1000,
  debugScanMode: false,
  externalSearchEnabled: false,
  maxExternalProbabilityAdjustment: 0.05,
  minExternalSourceCount: 0,
  minExternalDataQuality: 0,
  requireExternalSearchForLiveBetting: false,
  externalSearchCacheTtlMinutes: 10,
  allowHedging: false,
  allowDeterministicFallback: false,
  portfolioModeEnabled: false,
  winMinOdds: 1.01,
  winMaxOdds: 1000,
  winMinLiquidity: 2,
  winMaxSpreadTicks: 1000,
  winMinEdge: -100,
  winMinROI: -100,
  placeMinOdds: 1.01,
  placeMaxOdds: 1000,
  placeMinLiquidity: 2,
  placeMaxSpreadTicks: 1000,
  placeMinEdge: -100,
  placeMinROI: -100,
  h2hMinOdds: 1.01,
  h2hMaxOdds: 1000,
  h2hMinLiquidity: 2,
  h2hMaxSpreadTicks: 1000,
  h2hMinEdge: -100,
  h2hMinROI: -100,
};

/**
 * Check if Paper Proof Mode is currently active across all settings.
 */
export function isPaperProofModeActive(settings, botSettings, featherlessSettings) {
  return !!(
    (settings?.paperProofMode === true || botSettings?.botMode === 'paper_proof') &&
    settings?.forcedPaperOnlyMode === true &&
    botSettings?.liveTradingEnabled === false &&
    settings?.liveTradingEnabled === false
  );
}

/**
 * Flat proof stake: $2, capped at $5. No Kelly.
 */
export function calcProofStake(side,odds,settings={}){const baseProof=2,maxProof=Math.min(Number(settings.maxStake??PAPER_PROOF_MAX_STAKE),PAPER_PROOF_MAX_STAKE),maxLiability=Math.min(Number(settings.maxLayLiability??PAPER_PROOF_MAX_LAY_LIABILITY),PAPER_PROOF_MAX_LAY_LIABILITY);if(side==='LAY'){const capStake=maxLiability/Math.max(Number(odds)-1,1);if(capStake<baseProof)return 0;return Math.min(baseProof,maxProof,capStake);}return Math.min(baseProof,maxProof);}
export function proofLiabilityLimit(settings={}){return Math.min(Number(settings.maxLayLiability??PAPER_PROOF_MAX_LAY_LIABILITY),PAPER_PROOF_MAX_LAY_LIABILITY);}

/**
 * Hard blockers that CANNOT be relaxed even in Paper Proof Mode.
 */
export const PROOF_HARD_BLOCKERS = [
  'Emergency stop active',
  'Live trading enabled',
  'Market is not OPEN',
  'Market is in-play',
  'Runner is not ACTIVE',
  'Runner is REMOVED',
  'No price available',
  'No available size',
  'Duplicate order',
  'Lay liability exceeds',
  'Insufficient bankroll',
  'PERSIST',
  'Race has already jumped',
];

/**
 * Check if a blocker is a "soft" blocker that becomes a warning in proof mode.
 */
export function isSoftBlocker(blockerText) {
  if (!blockerText) return false;
  const lower = blockerText.toLowerCase();
  // Hard blockers — never relaxed
  for (const hard of PROOF_HARD_BLOCKERS) {
    if (lower.includes(hard.toLowerCase())) return false;
  }
  // Soft blockers — relaxed in proof mode
  const softPatterns = [
    'edge', 'roi', 'confidence', 'data quality', 'spread',
    'liquidity', 'delay risk', 'kelly', 'market-only',
    'external search', 'featherless', 'time window',
    'outside', 'cutoff', 'minimum 5% edge',
  ];
  return softPatterns.some(p => lower.includes(p));
}