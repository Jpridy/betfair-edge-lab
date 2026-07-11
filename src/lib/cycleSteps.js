// ============================================================================
// Cycle Steps — Truthful Step Tracking
//
// Replaces the pre-marked "passed" steps with actual results.
// Each step records: status, startedAt, finishedAt, itemsProcessed, result, reason.
//
// Statuses: pending | passed | warning | failed | skipped | blocked
// ============================================================================

export const CYCLE_STEPS = [
  { key: 'load_market_data', label: 'Load Market Data' },
  { key: 'filter_markets', label: 'Filter Markets' },
  { key: 'match_runners', label: 'Match Runners' },
  { key: 'cluster_events', label: 'Cluster Events' },
  { key: 'generate_base_probabilities', label: 'Generate Base Probabilities' },
  { key: 'openai_external_research', label: 'OpenAI External Research' },
  { key: 'featherless_analysis', label: 'Featherless Analysis' },
  { key: 'finalise_probabilities', label: 'Finalise Probabilities' },
  { key: 'generate_opportunities', label: 'Generate Opportunities' },
  { key: 'calculate_ev_and_rank', label: 'Calculate EV and Rank' },
  { key: 'run_safety_gates', label: 'Run Safety Gates' },
  { key: 'run_risk_checks', label: 'Run Risk Checks' },
  { key: 'create_signal', label: 'Create Signal' },
  { key: 'create_order', label: 'Create Order' },
  { key: 'schedule_settlement', label: 'Schedule Settlement' },
];

/**
 * Initialise all steps as pending.
 */
export function initCycleSteps() {
  const now = new Date().toISOString();
  return CYCLE_STEPS.map(s => ({
    step: s.key,
    label: s.label,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    itemsProcessed: 0,
    result: null,
    reason: null,
    error: null,
  }));
}

/**
 * Mark a step with a status and optional details.
 */
export function markStep(steps, stepKey, status, details = {}) {
  return steps.map(s => {
    if (s.step !== stepKey) return s;
    const now = new Date().toISOString();
    return {
      ...s,
      status,
      startedAt: s.startedAt || (status !== 'pending' ? now : null),
      completedAt: ['passed', 'failed', 'skipped'].includes(status) ? now : s.completedAt,
      itemsProcessed: details.itemsProcessed ?? s.itemsProcessed,
      result: details.result ?? s.result,
      reason: details.reason ?? s.reason,
      error: details.error ?? s.error,
    };
  });
}