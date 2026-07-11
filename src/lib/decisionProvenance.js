export const DECISION_SOURCES = Object.freeze({
  FEATHERLESS_AI: 'FEATHERLESS_AI',
  OPENAI_WEB_ENRICHED: 'OPENAI_WEB_ENRICHED',
  DETERMINISTIC_MARKET_ONLY: 'DETERMINISTIC_MARKET_ONLY',
  CACHE: 'CACHE',
  PROOF_OVERRIDE: 'PROOF_OVERRIDE',
});

export function strategyForDecisionSource(source) {
  return source === DECISION_SOURCES.FEATHERLESS_AI || source === DECISION_SOURCES.CACHE || source === DECISION_SOURCES.OPENAI_WEB_ENRICHED
    ? 'Featherless AI Value Decision Engine'
    : source === DECISION_SOURCES.PROOF_OVERRIDE
      ? 'Paper Proof Mode'
      : 'Deterministic Market Value Engine';
}

export function dataSourceForDecisionSource(source) {
  if (source === DECISION_SOURCES.PROOF_OVERRIDE) return 'MARKET_ONLY_PROOF';
  if (source === DECISION_SOURCES.DETERMINISTIC_MARKET_ONLY) return 'BETFAIR_MARKET_ONLY';
  if (source === DECISION_SOURCES.OPENAI_WEB_ENRICHED) return 'OPENAI_ADJUSTED';
  return 'FEATHERLESS';
}

export function aiStatusLabel(trace) {
  return trace?.aiRequested || trace?.aiCacheHit ? (trace.aiCacheHit ? 'Cache used' : trace.aiCallStatus) : 'Not used';
}