import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  clampProbabilityAdjustment, createSearchDiagnostics, createSearchFailure,
  parseWebSearchJson, resolveRunnerSelectionId,
} from './openAIWebSearchReliability';

const source = readFileSync('base44/functions/openAIWebSearch/entry.ts', 'utf8');

describe('OpenAI web search reliability', () => {
  it('handles a missing API key as a clean status-200 result contract', () => {
    expect(source).toContain("errorMessage: 'OPENAI_API_KEY not set'");
    expect(source).toContain("if (!apiKey) return jsonResponse");
  });

  it('keeps status_check and the real web_search_test actions', () => {
    expect(source).toContain("body.action === 'status_check'");
    expect(source).toContain("body.action === 'web_search_test'");
  });

  it('returns the required web search test success/failure shape', () => {
    const success = { success: true, ...createSearchDiagnostics({ webSearchActuallyUsed: true, responseTimeMs: 12 }) };
    const failure = { success: false, ...createSearchDiagnostics({ errorMessage: 'bad model' }) };
    expect(success).toMatchObject({ success: true, model: 'gpt-5.5-mini', toolChoice: 'required', webSearchActuallyUsed: true });
    expect(failure).toMatchObject({ success: false, errorMessage: 'bad model' });
  });

  it('preserves a clean OpenAI API error result', () => {
    expect(createSearchFailure('error', 'configured model failed')).toMatchObject({
      externalSearchResult: { searchStatus: 'error', errorMessage: 'configured model failed' },
      errorMessage: 'configured model failed',
    });
    expect(source).toContain('exactOpenAIError');
  });

  it('returns timeout without throwing into the scan', () => {
    expect(createSearchFailure('timeout', 'OpenAI web search timed out after 60s').externalSearchResult.searchStatus).toBe('timeout');
    expect(source).toContain("searchStatus: timeout ? 'timeout' : 'error'");
  });

  it('returns rawOutputSnippet on JSON parse failure', () => {
    const result = parseWebSearchJson('not JSON');
    expect(result).toEqual({ parsed: null, parseStatus: 'failed', rawOutputSnippet: 'not JSON' });
    expect(source).toContain('rawOutputSnippet: extracted.outputText.slice(0, 1000)');
  });

  it('clamps probabilityAdjustment in both directions', () => {
    expect(clampProbabilityAdjustment(0.5, 0.05)).toBe(0.05);
    expect(clampProbabilityAdjustment(-0.5, 0.05)).toBe(-0.05);
  });

  it('maps winnerName to the supplied selectionId', () => {
    const runners = [{ selectionId: '101', runnerName: 'Fast Horse' }, { selectionId: '202', runnerName: 'Other Horse' }];
    expect(resolveRunnerSelectionId('Fast Horse', '', runners)).toBe('101');
  });

  it('refuses an unclear normalized name match', () => {
    const runners = [{ selectionId: '101', runnerName: 'O’Brien' }, { selectionId: '202', runnerName: 'Obrien' }];
    expect(resolveRunnerSelectionId('OBrien', '', runners)).toBeNull();
  });

  it('configures the requested model, forced tool choice, and structured output', () => {
    expect(source).toContain("Deno.env.get('OPENAI_WEB_SEARCH_MODEL') || 'gpt-5.5-mini'");
    expect(source).toContain('tool_choice: TOOL_CHOICE');
    expect(source).toContain("type: 'json_schema'");
  });
});