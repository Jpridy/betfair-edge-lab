const baseTrace = ({ provider = 'featherless', model = 'unknown', runnerCount = 0, selectionIds = [] } = {}) => ({
  aiRequested: false, aiProvider: provider, aiModel: model, aiRequestId: null, aiStartedAt: null, aiCompletedAt: null, aiLatencyMs: null,
  aiHttpStatus: null, aiCallStatus: 'not_requested', aiErrorCode: null, aiErrorMessage: null, aiTimedOut: false, aiRawResponseReceived: false,
  aiResponseParseStatus: 'not_applicable', aiSchemaValidationStatus: 'not_applicable', aiRunnerCountRequested: runnerCount,
  aiRunnerCountReturned: 0, aiSelectionIdsRequested: selectionIds, aiSelectionIdsReturned: [], aiUsableProbabilityCount: 0, aiCacheHit: false,
});

export function beginAiTrace({ raceKey, provider = 'featherless', model, runnerCount = 0, selectionIds = [] }) {
  return { ...baseTrace({ provider, model, runnerCount, selectionIds }), aiRequested: true, aiRequestId: `ai_${raceKey}_${Date.now().toString(36)}`, aiStartedAt: new Date().toISOString(), aiCallStatus: 'requested' };
}

export function completeAiTrace(trace, result, error = null) {
  const telemetry = result?.aiTelemetry || error?.aiTelemetry || {};
  const completedAt = telemetry.aiCompletedAt || new Date().toISOString();
  const returned = result?.runnerProbabilities || [];
  return { ...trace, ...telemetry, aiModel: telemetry.aiModel && telemetry.aiModel !== 'unknown' ? telemetry.aiModel : trace.aiModel, aiCompletedAt: completedAt, aiLatencyMs: telemetry.aiLatencyMs ?? Math.max(0, new Date(completedAt) - new Date(trace.aiStartedAt)), aiCallStatus: telemetry.aiCallStatus || (error ? 'provider_error' : returned.length ? 'success' : 'no_usable_probabilities'), aiErrorMessage: telemetry.aiErrorMessage || error?.message || null, aiTimedOut: telemetry.aiTimedOut || false, aiRunnerCountReturned: telemetry.aiRunnerCountReturned ?? telemetry.aiResponseRunnerCount ?? returned.length, aiSelectionIdsReturned: telemetry.aiSelectionIdsReturned || returned.map(item => String(item.selectionId)), aiUsableProbabilityCount: telemetry.aiUsableProbabilityCount ?? returned.filter(item => item.pWin > 0 && item.pWin < 1).length };
}

export function cacheAiTrace({ raceKey, model, runnerCount, result }) {
  return { ...baseTrace({ model, runnerCount }), aiRequestId: `cache_${raceKey}`, aiCompletedAt: new Date().toISOString(), aiLatencyMs: 0, aiCallStatus: 'success', aiCacheHit: true, aiRunnerCountReturned: result?.runnerProbabilities?.length || 0, aiSelectionIdsReturned: (result?.runnerProbabilities || []).map(item => String(item.selectionId)), aiUsableProbabilityCount: (result?.runnerProbabilities || []).filter(item => item.pWin > 0 && item.pWin < 1).length };
}

export function unusedAiTrace({ model, runnerCount, error = null }) {
  return { ...baseTrace({ model, runnerCount }), aiErrorMessage: error };
}