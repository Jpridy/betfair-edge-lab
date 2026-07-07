// ============================================================================
// Strategy Library — Betfair Exchange racing trading strategies
// Only the Featherless AI Value Decision Engine is active. Additional
// strategies can be added here as needed.
// ============================================================================

export const STRATEGY_LIBRARY = [
  {
    id: 'sl7',
    name: 'Featherless AI Value Decision Engine',
    category: 'AI Value Betting',
    status: 'active',
    description: 'Uses all available data to estimate true runner probabilities and detect value against the exchange price. Data source is clearly declared per decision: MARKET_ONLY (Betfair prices, volume, spreads), BETFAIR_METADATA_PLUS_MARKET (adds jockey, trainer, ratings from RUNNER_METADATA), or EXTERNAL_FORM_PLUS_MARKET (adds full form from external provider). Powered by Featherless AI. Every decision is validated by the app safety gate before any paper trade is created.',
    entryRules: 'AI confidence >= 75%. Minimum edge 5%. Minimum expected ROI 3%. Odds 2.00-12.00. Time window 30-500 seconds before jump. Max 1 bet per race. Max stake 1% bankroll. Confidence-weighted 25% Kelly staking. Paper trade only by default.',
    exitRules: 'Settle at race completion. Compare paper trade against BSP/closing price for CLV analysis.',
    riskProfile: 'Medium',
    marketTypes: ['WIN', 'PLACE'],
    timeWindow: 'Pre-race (8min – 30sec before start)',
    minEdge: 5.0,
    minLiquidity: 500,
    createdAt: '2026-07-07T00:00:00+10:00',
    lastRun: null,
  },
];

// Betfair-specific enrichment fields per strategy
const STRATEGY_BETFAIR_FIELDS = {
  'Featherless AI Value Decision Engine': {
    allowInPlay: false,
    timeWindowStart: 300,
    timeWindowEnd: 30,
    persistenceType: 'LAPSE',
    sideRestriction: 'BACK',
    requiresCommission: true,
    requiresCLV: true,
    paperOnly: true,
    validationStatus: 'needs_more_data',
    statusLabel: 'AI Strategy — Paper Testing',
  },
};

export const ENRICHED_STRATEGY_LIBRARY = STRATEGY_LIBRARY.map(s => ({
  ...s,
  ...STRATEGY_BETFAIR_FIELDS[s.name],
}));