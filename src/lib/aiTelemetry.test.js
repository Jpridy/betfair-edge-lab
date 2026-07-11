import { describe, expect, it } from 'vitest';
import { beginAiTrace, completeAiTrace } from './aiObservability';
import { calculatePriceFeedStatus } from './marketFreshness';

describe('AI execution telemetry', () => {
  it('preserves an exact provider failure', () => { const trace = beginAiTrace({ raceKey: 'r1', model: 'model', runnerCount: 2, selectionIds: ['1', '2'] }); const error = new Error('provider timed out'); error.aiTelemetry = { aiCallStatus: 'timeout', aiErrorCode: 'TIMEOUT', aiErrorMessage: 'provider timed out', aiTimedOut: true }; const result = completeAiTrace(trace, null, error); expect(result.aiCallStatus).toBe('timeout'); expect(result.aiErrorMessage).toBe('provider timed out'); expect(result.aiSelectionIdsRequested).toEqual(['1', '2']); });
  it('counts usable returned probabilities by selection id', () => { const trace = beginAiTrace({ raceKey: 'r1', runnerCount: 2 }); const result = completeAiTrace(trace, { runnerProbabilities: [{ selectionId: '1', pWin: 0.4 }, { selectionId: '2', pWin: 0.6 }] }); expect(result.aiUsableProbabilityCount).toBe(2); expect(result.aiSelectionIdsReturned).toEqual(['1', '2']); });
});

describe('authoritative price freshness', () => {
  it('keeps status and stale boolean consistent', () => { const live = calculatePriceFeedStatus('2026-01-01T00:00:00Z', new Date('2026-01-01T00:00:10Z').getTime(), 30); expect(live.priceFeedStatus).toBe('LIVE'); expect(live.priceFeedStale).toBe(false); const stale = calculatePriceFeedStatus('2026-01-01T00:00:00Z', new Date('2026-01-01T00:01:00Z').getTime(), 30); expect(stale.priceFeedStatus).toBe('STALE'); expect(stale.priceFeedStale).toBe(true); });
});