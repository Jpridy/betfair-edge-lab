import { createClientFromRequest } from 'npm:@base44/sdk@0.8.37';

const TOOL_CHOICE = 'required';
const SEARCH_TIMEOUT_MS = 60000;

function diagnostics(model, overrides = {}) {
  return {
    model,
    toolChoice: TOOL_CHOICE,
    webSearchRequested: true,
    webSearchActuallyUsed: 'unknown',
    responseTimeMs: 0,
    sourceCount: 0,
    parseStatus: 'not_applicable',
    errorMessage: null,
    jsonSchemaMode: false,
    ...overrides,
  };
}

function baseSearchResult(market = {}, overrides = {}) {
  return {
    eventId: market.eventId || '',
    eventName: market.eventName || '',
    marketStartTime: market.startTime || market.marketStartTime || '',
    searchStatus: 'error',
    searchProvider: 'openai_web_search',
    searchQuery: '',
    searchedAt: new Date().toISOString(),
    sourceCount: 0,
    sources: [],
    runnerResearch: [],
    raceLevelNotes: '',
    dataQuality: 0,
    errorMessage: null,
    ...overrides,
  };
}

function jsonResponse(payload, diag, status = 200) {
  return Response.json({ ...payload, ...diag }, { status });
}

function exactOpenAIError(text, status) {
  try {
    const parsed = JSON.parse(text);
    return parsed.error?.message || text || `OpenAI API error ${status}`;
  } catch (_) {
    return text || `OpenAI API error ${status}`;
  }
}

function extractResponse(data) {
  const textParts = [];
  const sources = [];
  let webSearchActuallyUsed = false;
  for (const item of data.output || []) {
    if (item.type === 'web_search_call') webSearchActuallyUsed = true;
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type !== 'output_text') continue;
      if (content.text) textParts.push(content.text);
      for (const annotation of content.annotations || []) {
        if (annotation.type !== 'url_citation' || !annotation.url) continue;
        let domain = '';
        try { domain = new URL(annotation.url).hostname.replace('www.', ''); } catch (_) {}
        sources.push({
          title: annotation.title || annotation.url,
          url: annotation.url,
          domain,
          publishedAt: '',
          relevance: 'medium',
          extractedFacts: [],
        });
      }
    }
  }
  return {
    outputText: data.output_text || textParts.join(''),
    sources: [...new Map(sources.map((source) => [source.url, source])).values()],
    webSearchActuallyUsed,
  };
}

function parseJsonOutput(outputText) {
  const tryParse = (value) => { try { return JSON.parse(value); } catch (_) { return null; } };
  const cleaned = String(outputText || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  let parsed = tryParse(cleaned);
  if (parsed) return parsed;
  const blocks = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < cleaned.length; index++) {
    const char = cleaned[index];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') { if (depth === 0) start = index; depth++; }
    if (char === '}') { depth--; if (depth === 0 && start >= 0) blocks.push(cleaned.slice(start, index + 1)); }
  }
  blocks.sort((a, b) => b.length - a.length);
  for (const block of blocks) { parsed = tryParse(block); if (parsed) return parsed; }
  return null;
}

function raceResearchSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['raceLevelNotes', 'dataQuality', 'sources', 'runnerResearch'],
    properties: {
      raceLevelNotes: { type: 'string' },
      dataQuality: { type: 'number' },
      sources: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['title', 'url', 'domain', 'publishedAt', 'relevance', 'extractedFacts'],
          properties: {
            title: { type: 'string' }, url: { type: 'string' }, domain: { type: 'string' },
            publishedAt: { type: 'string' }, relevance: { type: 'string' },
            extractedFacts: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      runnerResearch: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['selectionId', 'runnerName', 'positiveSignals', 'negativeSignals', 'neutralSignals', 'confidenceAdjustment', 'probabilityAdjustment', 'sourceUrls'],
          properties: {
            selectionId: { type: 'string' }, runnerName: { type: 'string' },
            positiveSignals: { type: 'array', items: { type: 'string' } },
            negativeSignals: { type: 'array', items: { type: 'string' } },
            neutralSignals: { type: 'array', items: { type: 'string' } },
            confidenceAdjustment: { type: 'number' }, probabilityAdjustment: { type: 'number' },
            sourceUrls: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };
}

function resultSchema() {
  return {
    type: 'object', additionalProperties: false,
    required: ['found', 'winnerName', 'winnerSelectionId', 'placedRunners', 'selectedRunnerFinishPosition', 'opponentFinishPosition', 'confidence', 'sourceUrls', 'raceNotes'],
    properties: {
      found: { type: 'boolean' }, winnerName: { type: 'string' }, winnerSelectionId: { type: 'string' },
      placedRunners: {
        type: 'array', items: {
          type: 'object', additionalProperties: false,
          required: ['selectionId', 'runnerName', 'finishPosition'],
          properties: { selectionId: { type: 'string' }, runnerName: { type: 'string' }, finishPosition: { type: 'number' } },
        },
      },
      selectedRunnerFinishPosition: { type: ['number', 'null'] },
      opponentFinishPosition: { type: ['number', 'null'] },
      confidence: { type: 'string' }, sourceUrls: { type: 'array', items: { type: 'string' } }, raceNotes: { type: 'string' },
    },
  };
}

async function callOpenAI({ apiKey, model, instructions, input, schema, timeoutMs = SEARCH_TIMEOUT_MS }) {
  const startedAt = Date.now();
  const makeRequest = (useSchema) => fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      instructions,
      input,
      tools: [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'AU' } }],
      tool_choice: TOOL_CHOICE,
      ...(useSchema ? { text: { format: { type: 'json_schema', name: 'web_search_result', strict: true, schema } } } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  let jsonSchemaMode = !!schema;
  let response = await makeRequest(jsonSchemaMode);
  if (!response.ok && jsonSchemaMode) {
    const firstErrorText = await response.text();
    const firstError = exactOpenAIError(firstErrorText, response.status);
    if (/json.?schema|structured output|text\.format|response format|not supported/i.test(firstError)) {
      jsonSchemaMode = false;
      response = await makeRequest(false);
    } else {
      return { response, errorText: firstErrorText, responseTimeMs: Date.now() - startedAt, jsonSchemaMode };
    }
  }
  return { response, errorText: null, responseTimeMs: Date.now() - startedAt, jsonSchemaMode };
}

function normalizeRunnerName(value) {
  return String(value || '').normalize('NFKD').replace(/[’']/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}

function resolveSelectionId(name, suppliedId, runners) {
  const validRunners = (runners || []).filter((runner) => runner.runnerName && (runner.selectionId || runner.betfairSelectionId));
  const id = String(suppliedId || '');
  const idMatches = validRunners.filter((runner) => String(runner.selectionId || runner.betfairSelectionId) === id);
  if (id && idMatches.length === 1) return String(idMatches[0].selectionId || idMatches[0].betfairSelectionId);
  const normalized = normalizeRunnerName(name);
  if (!normalized) return null;
  const nameMatches = validRunners.filter((runner) => normalizeRunnerName(runner.runnerName) === normalized);
  return nameMatches.length === 1 ? String(nameMatches[0].selectionId || nameMatches[0].betfairSelectionId) : null;
}

async function handleWebSearchTest(apiKey, model) {
  const missing = diagnostics(model, { parseStatus: 'not_applicable', errorMessage: apiKey ? null : 'OPENAI_API_KEY not set' });
  if (!apiKey) return jsonResponse({ webSearchTest: { success: false, ...missing } }, missing);
  try {
    const call = await callOpenAI({
      apiKey, model,
      instructions: 'Use web search and answer in one short sentence.',
      input: 'Search the web for the current UTC date and state it briefly.',
      schema: null,
      timeoutMs: 20000,
    });
    if (!call.response.ok) {
      const text = call.errorText ?? await call.response.text();
      const errorMessage = exactOpenAIError(text, call.response.status);
      const diag = diagnostics(model, { responseTimeMs: call.responseTimeMs, parseStatus: 'not_applicable', errorMessage });
      return jsonResponse({ webSearchTest: { success: false, ...diag } }, diag);
    }
    const data = await call.response.json();
    const extracted = extractResponse(data);
    const diag = diagnostics(model, {
      webSearchActuallyUsed: extracted.webSearchActuallyUsed,
      responseTimeMs: call.responseTimeMs,
      sourceCount: extracted.sources.length,
      parseStatus: extracted.outputText ? 'success' : 'no_output',
      errorMessage: extracted.outputText ? null : 'OpenAI returned no output text',
    });
    return jsonResponse({ webSearchTest: { success: !!extracted.outputText && extracted.webSearchActuallyUsed === true, ...diag } }, diag);
  } catch (error) {
    const timeout = error.name === 'TimeoutError' || /timeout/i.test(error.message || '');
    const diag = diagnostics(model, { responseTimeMs: 20000, parseStatus: 'not_applicable', errorMessage: timeout ? 'OpenAI web search test timed out after 20s' : error.message });
    return jsonResponse({ webSearchTest: { success: false, searchStatus: timeout ? 'timeout' : 'error', ...diag } }, diag);
  }
}

async function handleResultLookup(body, apiKey, model) {
  const { eventName, marketName, marketStartTime, runnerName, selectionId, marketType, opponentSelectionId, runners = [] } = body;
  const emptyResult = (overrides = {}) => ({
    resultLookupStatus: 'error', resultSource: 'openai_result_lookup', sourceUrls: [], winnerSelectionIds: [], placedSelectionIds: [],
    selectedRunnerFinishPosition: null, opponentFinishPosition: null, resultConfidence: 'unknown', voided: false, voidReason: null, ...overrides,
  });
  if (!apiKey) {
    const diag = diagnostics(model, { errorMessage: 'OPENAI_API_KEY not set' });
    return jsonResponse({ resultLookup: emptyResult({ errorMessage: diag.errorMessage }) }, diag);
  }
  const date = marketStartTime ? new Date(marketStartTime).toLocaleDateString('en-AU') : '';
  const runnerList = runners.map((runner) => `${runner.runnerName} (selectionId: ${runner.selectionId || runner.betfairSelectionId || ''})`).join('\n');
  const input = `Search for the official result. Event: ${eventName}. Market: ${marketName}. Date: ${date}. Runner of interest: ${runnerName}. Market type: ${marketType}. Opponent selectionId: ${opponentSelectionId || ''}. Runners:\n${runnerList}\nNever guess. Return winner and placed runners.`;
  try {
    const call = await callOpenAI({ apiKey, model, instructions: 'Search the web for official Australian horse racing results. Never guess.', input, schema: resultSchema() });
    if (!call.response.ok) {
      const errorText = call.errorText ?? await call.response.text();
      const errorMessage = exactOpenAIError(errorText, call.response.status);
      const diag = diagnostics(model, { responseTimeMs: call.responseTimeMs, parseStatus: 'not_applicable', errorMessage, jsonSchemaMode: call.jsonSchemaMode });
      return jsonResponse({ resultLookup: emptyResult({ errorMessage }) }, diag);
    }
    const data = await call.response.json();
    const extracted = extractResponse(data);
    const parsed = parseJsonOutput(extracted.outputText);
    if (!parsed) {
      const errorMessage = 'Failed to parse result lookup response';
      const diag = diagnostics(model, { webSearchActuallyUsed: extracted.webSearchActuallyUsed, responseTimeMs: call.responseTimeMs, sourceCount: extracted.sources.length, parseStatus: 'failed', errorMessage, jsonSchemaMode: call.jsonSchemaMode });
      return jsonResponse({ resultLookup: emptyResult({ resultLookupStatus: 'no_results', sourceUrls: extracted.sources.map((source) => source.url), errorMessage, rawOutputSnippet: extracted.outputText.slice(0, 1000) }) }, diag);
    }
    const winnerId = resolveSelectionId(parsed.winnerName, parsed.winnerSelectionId, runners);
    const winnerSelectionIds = winnerId ? [winnerId] : [];
    const placedSelectionIds = [];
    for (const placed of parsed.placedRunners || []) {
      const placedId = resolveSelectionId(placed.runnerName, placed.selectionId, runners);
      if (placedId && !placedSelectionIds.includes(placedId)) placedSelectionIds.push(placedId);
    }
    const status = parsed.found === true && (winnerSelectionIds.length > 0 || (marketType === 'PLACE' && placedSelectionIds.length > 0)) ? 'success' : 'no_results';
    const sourceUrls = [...new Set([...(parsed.sourceUrls || []), ...extracted.sources.map((source) => source.url)])];
    const diag = diagnostics(model, { webSearchActuallyUsed: extracted.webSearchActuallyUsed, responseTimeMs: call.responseTimeMs, sourceCount: sourceUrls.length, parseStatus: 'success', jsonSchemaMode: call.jsonSchemaMode });
    return jsonResponse({ resultLookup: emptyResult({
      resultLookupStatus: status, sourceUrls, winnerSelectionIds, placedSelectionIds,
      selectedRunnerFinishPosition: parsed.selectedRunnerFinishPosition ?? null,
      opponentFinishPosition: parsed.opponentFinishPosition ?? null,
      resultConfidence: status === 'success' ? (parsed.confidence || 'unknown') : 'unknown',
      winnerName: parsed.winnerName || '', raceNotes: parsed.raceNotes || '', errorMessage: status === 'success' ? null : 'Result names could not be matched unambiguously to supplied runners',
    }) }, diag);
  } catch (error) {
    const timeout = error.name === 'TimeoutError' || /timeout/i.test(error.message || '');
    const errorMessage = timeout ? 'Result lookup timed out after 60s' : error.message;
    const diag = diagnostics(model, { responseTimeMs: SEARCH_TIMEOUT_MS, parseStatus: 'not_applicable', errorMessage });
    return jsonResponse({ resultLookup: emptyResult({ resultLookupStatus: timeout ? 'timeout' : 'error', errorMessage }) }, diag);
  }
}

Deno.serve(async (req) => {
  const OPENAI_WEB_SEARCH_MODEL = Deno.env.get('OPENAI_WEB_SEARCH_MODEL') || 'gpt-5.5-mini';
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  let body = {};
  try {
    body = await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Authentication required' }, diagnostics(OPENAI_WEB_SEARCH_MODEL, { errorMessage: 'Authentication required' }), 401);

    if (body.action === 'status_check') {
      const diag = diagnostics(OPENAI_WEB_SEARCH_MODEL, { errorMessage: apiKey ? null : 'OPENAI_API_KEY not set' });
      return jsonResponse({ statusCheck: { openAiApiKeyPresent: !!apiKey, webSearchAvailable: !!apiKey, checkedAt: new Date().toISOString(), ...diag } }, diag);
    }
    if (body.action === 'web_search_test') return await handleWebSearchTest(apiKey, OPENAI_WEB_SEARCH_MODEL);
    if (body.action === 'result_lookup') return await handleResultLookup(body, apiKey, OPENAI_WEB_SEARCH_MODEL);

    const { market, runners = [], settings = {} } = body;
    if (!market) {
      const diag = diagnostics(OPENAI_WEB_SEARCH_MODEL, { errorMessage: 'market is required' });
      return jsonResponse({ externalSearchResult: baseSearchResult({}, { errorMessage: diag.errorMessage }) }, diag, 400);
    }
    if (!apiKey) {
      const diag = diagnostics(OPENAI_WEB_SEARCH_MODEL, { errorMessage: 'OPENAI_API_KEY not set' });
      return jsonResponse({ externalSearchResult: baseSearchResult(market, { errorMessage: diag.errorMessage }) }, diag);
    }

    const activeRunners = runners.filter((runner) => runner.status === 'ACTIVE' && runner.runnerName).slice(0, 20);
    const maxAdjustment = Math.max(0, Number(settings.maxExternalProbabilityAdjustment) || 0.05);
    const startTime = market.startTime || market.marketStartTime || '';
    const date = startTime ? new Date(startTime).toLocaleDateString('en-AU', { dateStyle: 'full' }) : '';
    const searchQuery = `Australian horse racing ${market.venue || ''} Race ${market.raceNumber || ''} ${date} ${activeRunners.map((runner) => runner.runnerName).join(' ')} tips form track scratchings`.trim();
    const runnerList = activeRunners.map((runner) => `${runner.runnerName} (selectionId: ${runner.betfairSelectionId || runner.selectionId || ''})`).join('\n');
    const instructions = `Search the web for current public Australian horse racing evidence. Return only the requested structure. Never invent sources. Probability adjustments must be between -${maxAdjustment} and ${maxAdjustment}; use zero without clear evidence.`;
    const input = `${searchQuery}\nEvent: ${market.eventName || ''}\nMarket: ${market.marketName || ''}\nStart: ${startTime}\nRunners:\n${runnerList}\nResearch form, scratchings, track, weather, trainer, jockey, barriers, gear, class and public previews.`;
    try {
      const call = await callOpenAI({ apiKey, model: OPENAI_WEB_SEARCH_MODEL, instructions, input, schema: raceResearchSchema() });
      if (!call.response.ok) {
        const errorText = call.errorText ?? await call.response.text();
        const errorMessage = exactOpenAIError(errorText, call.response.status);
        const diag = diagnostics(OPENAI_WEB_SEARCH_MODEL, { responseTimeMs: call.responseTimeMs, parseStatus: 'not_applicable', errorMessage, jsonSchemaMode: call.jsonSchemaMode });
        return jsonResponse({ externalSearchResult: baseSearchResult(market, { searchQuery, errorMessage }) }, diag);
      }
      const data = await call.response.json();
      const extracted = extractResponse(data);
      const parsed = parseJsonOutput(extracted.outputText);
      if (!parsed) {
        const errorMessage = 'Failed to parse OpenAI response JSON';
        const diag = diagnostics(OPENAI_WEB_SEARCH_MODEL, { webSearchActuallyUsed: extracted.webSearchActuallyUsed, responseTimeMs: call.responseTimeMs, sourceCount: extracted.sources.length, parseStatus: 'failed', errorMessage, jsonSchemaMode: call.jsonSchemaMode });
        return jsonResponse({ externalSearchResult: baseSearchResult(market, { searchQuery, sourceCount: extracted.sources.length, sources: extracted.sources, errorMessage, rawOutputSnippet: extracted.outputText.slice(0, 1000) }) }, diag);
      }
      const parsedSources = Array.isArray(parsed.sources) ? parsed.sources : [];
      const allSources = parsedSources.length ? parsedSources : extracted.sources;
      const runnerResearch = (parsed.runnerResearch || []).map((research) => ({
        selectionId: String(research.selectionId || ''), runnerName: research.runnerName || '',
        positiveSignals: Array.isArray(research.positiveSignals) ? research.positiveSignals : [],
        negativeSignals: Array.isArray(research.negativeSignals) ? research.negativeSignals : [],
        neutralSignals: Array.isArray(research.neutralSignals) ? research.neutralSignals : [],
        confidenceAdjustment: Math.max(-20, Math.min(20, Number(research.confidenceAdjustment) || 0)),
        probabilityAdjustment: Math.max(-maxAdjustment, Math.min(maxAdjustment, Number(research.probabilityAdjustment) || 0)),
        sourceUrls: Array.isArray(research.sourceUrls) ? research.sourceUrls : [],
      }));
      const sourceCount = allSources.length;
      const searchStatus = extracted.webSearchActuallyUsed && (sourceCount > 0 || runnerResearch.length > 0) ? 'success' : 'no_results';
      const diag = diagnostics(OPENAI_WEB_SEARCH_MODEL, {
        webSearchActuallyUsed: extracted.webSearchActuallyUsed,
        responseTimeMs: call.responseTimeMs, sourceCount, parseStatus: 'success', jsonSchemaMode: call.jsonSchemaMode,
        errorMessage: searchStatus === 'success' ? null : 'OpenAI did not return verifiable web search evidence',
      });
      const externalSearchResult = baseSearchResult(market, {
        searchStatus, searchQuery, sourceCount, sources: allSources, runnerResearch,
        raceLevelNotes: parsed.raceLevelNotes || '',
        dataQuality: Math.max(0, Math.min(100, Number(parsed.dataQuality) || 0)),
        errorMessage: diag.errorMessage,
      });
      return jsonResponse({ success: searchStatus === 'success', externalSearchResult }, diag);
    } catch (error) {
      const timeout = error.name === 'TimeoutError' || /timeout/i.test(error.message || '');
      const errorMessage = timeout ? 'OpenAI web search timed out after 60s' : error.message;
      const diag = diagnostics(OPENAI_WEB_SEARCH_MODEL, { responseTimeMs: SEARCH_TIMEOUT_MS, parseStatus: 'not_applicable', errorMessage });
      return jsonResponse({ externalSearchResult: baseSearchResult(market, { searchStatus: timeout ? 'timeout' : 'error', searchQuery, errorMessage }) }, diag);
    }
  } catch (error) {
    const diag = diagnostics(OPENAI_WEB_SEARCH_MODEL, { errorMessage: error.message });
    return jsonResponse({ externalSearchResult: baseSearchResult(body.market || {}, { errorMessage: error.message }) }, diag);
  }
});