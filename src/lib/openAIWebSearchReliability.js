export function normalizeRunnerName(value) {
  return String(value || '').normalize('NFKD').replace(/[’']/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}

export function resolveRunnerSelectionId(name, suppliedId, runners = []) {
  const valid = runners.filter((runner) => runner.runnerName && (runner.selectionId || runner.betfairSelectionId));
  const id = String(suppliedId || '');
  const idMatches = valid.filter((runner) =>
    String(runner.selectionId || '') === id || String(runner.betfairSelectionId || '') === id
  );
  if (id && idMatches.length === 1) return String(idMatches[0].betfairSelectionId || idMatches[0].selectionId);
  const normalized = normalizeRunnerName(name);
  const nameMatches = normalized ? valid.filter((runner) => normalizeRunnerName(runner.runnerName) === normalized) : [];
  return nameMatches.length === 1 ? String(nameMatches[0].betfairSelectionId || nameMatches[0].selectionId) : null;
}

export function clampProbabilityAdjustment(value, maximum = 0.05) {
  return Math.max(-maximum, Math.min(maximum, Number(value) || 0));
}

export function parseWebSearchJson(output) {
  const cleaned = String(output || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return { parsed: JSON.parse(cleaned), parseStatus: 'success', rawOutputSnippet: null }; }
  catch (_) { return { parsed: null, parseStatus: 'failed', rawOutputSnippet: cleaned.slice(0, 1000) }; }
}

export function createSearchDiagnostics(overrides = {}) {
  return {
    model: 'gpt-5.5-mini', toolChoice: 'required', webSearchRequested: true,
    webSearchActuallyUsed: 'unknown', responseTimeMs: 0, sourceCount: 0,
    parseStatus: 'not_applicable', errorMessage: null, ...overrides,
  };
}

export function createSearchFailure(searchStatus, errorMessage) {
  const canonicalStatus = searchStatus === 'not_called' || searchStatus === 'disabled' ? 'not_requested' : searchStatus === 'no_results' ? 'error' : searchStatus;
  return {
    externalSearchResult: { searchStatus: canonicalStatus, sourceCount: 0, sources: [], runnerResearch: [], errorCode: canonicalStatus === 'timeout' ? 'TIMEOUT' : 'SEARCH_ERROR', errorMessage },
    ...createSearchDiagnostics({ errorMessage }),
  };
}