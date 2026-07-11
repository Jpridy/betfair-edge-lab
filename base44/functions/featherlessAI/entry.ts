import { createClientFromRequest } from 'npm:@base44/sdk@0.8.37';

const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';
const PROMPT_VERSION = '4.0-race-assessment';

const SYSTEM_PROMPT = `You are assessing one complete Betfair exchange race. You are not choosing a horse emotionally. You are pricing every available outcome.

You must:
- assess every runner
- estimate win probability for every active runner
- estimate place probability for every active runner if a PLACE market exists
- estimate H2H probability for every H2H market if available
- identify possible BACK and LAY value
- explain uncertainty and data-quality limits
- return structured JSON only
- never directly place a bet
- never ignore commission, liquidity, spread or data freshness
- make conservative probability estimates when data quality is poor

PROBABILITY ESTIMATION GUIDELINES:
- Start from Betfair implied probability (1 / back price) as your prior.
- In LIQUID markets (traded volume > $50K, spread <= 2 ticks), stay within +/-10% of implied probability unless you have overwhelming evidence.
- In MODERATE markets ($10K-$50K), +/-20% deviation is acceptable.
- In THIN markets (< $10K, wide spread), wider deviation is justified but lower confidence.
- Apply favourite-longshot bias: favourites (odds < 2.5) are typically over-bet. Outsiders (odds > 15) are typically under-bet.
- pWin values MUST sum to ~1.0 (+/-0.05).
- pPlace must always be >= pWin (you can't be more likely to win than to place).
- For H2H markets, pBeatsOpponent + pBeatsOpponent(opponent) = 1.0.

CONFIDENCE:
- Confidence (0-100) reflects the strength of your evidence, NOT enthusiasm.
- Market-only data (no form): cap confidence at 65.
- With Betfair metadata (jockey, trainer, weight): up to 80.
- With full external form data: up to 95.

Return valid JSON only. No markdown, no code fences, no commentary outside the JSON.`;

const USER_PROMPT = `Price every active runner in this Betfair race pack.

<RACE_PACK>
__RACE_PACK_JSON__
</RACE_PACK>

Return JSON only:
{
  "results": [
    {
      "selectionId": "<exact selectionId from race pack>",
      "probability": <number greater than 0 and less than 1>,
      "confidence": <number from 0 to 1>,
      "reasoningSummary": "<brief evidence-based reason>"
    }
  ],
  "raceSummary": "<brief summary>"
}

Rules:
- Return exactly one result for every active runner.
- Match runners only by exact selectionId; names are descriptive only.
- Do not add unknown or duplicate selection IDs.
- Win probabilities must sum to approximately 1.
- Return no markdown, hidden reasoning, API keys, or commentary outside JSON.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    decisionSource: { type: 'string' },
    raceId: { type: 'string' },
    eventId: { type: 'string' },
    eventName: { type: 'string' },
    dataQuality: { type: 'number' },
    confidence: { type: 'number' },
    raceSummary: { type: 'string' },
    marketRead: { type: 'string' },
    keyRisks: { type: 'array', items: { type: 'string' } },
    runnerProbabilities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          selectionId: { type: 'string' },
          runnerName: { type: 'string' },
          pWin: { type: 'number' },
          pPlace: { type: 'number' },
          confidence: { type: 'number' },
          fairWinOdds: { type: 'number' },
          fairPlaceOdds: { type: 'number' },
          positiveSignals: { type: 'array', items: { type: 'string' } },
          negativeSignals: { type: 'array', items: { type: 'string' } },
          reasoning: { type: 'string' },
          dataQuality: { type: 'number' },
        },
        required: ['selectionId', 'runnerName', 'pWin', 'pPlace', 'confidence'],
      },
    },
    h2hProbabilities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          marketId: { type: 'string' },
          selectionId: { type: 'string' },
          runnerName: { type: 'string' },
          opponentSelectionId: { type: 'string' },
          opponentName: { type: 'string' },
          pBeatsOpponent: { type: 'number' },
          fairOdds: { type: 'number' },
          confidence: { type: 'number' },
          reasoning: { type: 'string' },
        },
        required: ['selectionId', 'opponentSelectionId', 'pBeatsOpponent', 'confidence'],
      },
    },
    recommendedOpportunities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          marketId: { type: 'string' },
          marketType: { type: 'string' },
          selectionId: { type: 'string' },
          runnerName: { type: 'string' },
          side: { type: 'string' },
          modelProbability: { type: 'number' },
          fairOdds: { type: 'number' },
          betfairOdds: { type: 'number' },
          estimatedEdge: { type: 'number' },
          estimatedROI: { type: 'number' },
          confidence: { type: 'number' },
          reasoning: { type: 'string' },
          risks: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    noBetReasons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reason: { type: 'string' },
          severity: { type: 'string' },
          affectedMarketId: { type: 'string' },
          affectedSelectionId: { type: 'string' },
        },
      },
    },
    finalRaceView: {
      type: 'object',
      properties: {
        bestRunner: { type: 'string' },
        mostOverpricedRunner: { type: 'string' },
        mostUnderpricedRunner: { type: 'string' },
        bestBackCandidate: { type: 'string' },
        bestLayCandidate: { type: 'string' },
        shouldBetThisRace: { type: 'boolean' },
        summaryReason: { type: 'string' },
      },
    },
  },
  required: ['decisionSource', 'dataQuality', 'runnerProbabilities', 'finalRaceView'],
};

function validateAIResponse(parsed, racePack) {
  const errors = [];
  const requestedIds = (racePack?.runners || []).map((runner) => String(runner.selectionId || runner.betfairSelectionId || '')).filter(Boolean);
  const requestedSet = new Set(requestedIds);
  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  const seen = new Set();
  const usable = [];
  for (const result of results) {
    const selectionId = String(result?.selectionId || '');
    if (!selectionId) { errors.push('Result missing selectionId'); continue; }
    if (seen.has(selectionId)) { errors.push(`Duplicate selectionId: ${selectionId}`); continue; }
    seen.add(selectionId);
    if (!requestedSet.has(selectionId)) { errors.push(`Unknown selectionId: ${selectionId}`); continue; }
    if (typeof result.probability !== 'number' || result.probability <= 0 || result.probability >= 1) { errors.push(`Invalid probability for ${selectionId}: ${result.probability}`); continue; }
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) { errors.push(`Invalid confidence for ${selectionId}: ${result.confidence}`); continue; }
    if (typeof result.reasoningSummary !== 'string') { errors.push(`Missing reasoningSummary for ${selectionId}`); continue; }
    usable.push({ selectionId, probability: result.probability, confidence: result.confidence, reasoningSummary: result.reasoningSummary });
  }
  const missingSelectionIds = requestedIds.filter((id) => !seen.has(id));
  if (missingSelectionIds.length) errors.push(`Missing runners: ${missingSelectionIds.join(', ')}`);
  const total = usable.reduce((sum, result) => sum + result.probability, 0);
  if (usable.length && (total < 0.85 || total > 1.15)) errors.push(`Probabilities sum to ${total.toFixed(3)}; expected approximately 1`);
  return { valid: errors.length === 0 && usable.length === requestedIds.length, errors, usable, requestedIds, returnedIds: results.map((result) => String(result?.selectionId || '')).filter(Boolean), missingSelectionIds };
}

Deno.serve(async (req) => {
  let telemetryModel = 'unknown';
  let telemetrySelectionIds = [];
  let telemetryStartedAt = null;
  try {
    const body = await req.json();
    const { racePack, settings, strategySettings, bankrollStats, action } = body;

    // Connection test and model listing
    if (action === 'test' || action === 'models') {
      const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
      if (!apiKey) return Response.json({ error: 'FEATHERLESS_API_KEY not set' }, { status: 500 });
      try {
        const resp = await fetch(`${FEATHERLESS_BASE_URL}/models`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(action === 'models' ? 15000 : 10000),
        });
        if (action === 'test') {
          return Response.json({ connected: resp.ok, status: resp.status });
        }
        const data = await resp.json();
        const all = (data.data || data || []).map((m: any) => m.id || m).sort();
        const flagships = all.filter((id: string) =>
          /^deepseek-ai\//i.test(id) ||
          /^moonshotai\//i.test(id) ||
          /^thudm\//i.test(id) ||
          /^zai-org\//i.test(id)
        ).sort();
        return Response.json({ connected: resp.ok, total: all.length, flagships });
      } catch (err) {
        return Response.json({ connected: false, error: err.message }, { status: 500 });
      }
    }

    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (_) {
      return Response.json({ error: 'Authentication required. Please log in and try again.' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Authentication required. Please log in and try again.' }, { status: 401 });

    if (!racePack) return Response.json({ error: 'racePack is required' }, { status: 400 });

    const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
    if (!apiKey) {
      return Response.json({
        error: 'FEATHERLESS_API_KEY not set',
        featherlessStatus: 'not_configured',
        aiResult: null,
      }, { status: 200 });
    }

    const modelName = strategySettings?.modelName || 'deepseek-ai/DeepSeek-V4-Pro';
    const temperature = strategySettings?.temperature ?? 0.1;
    const maxTokens = strategySettings?.maxTokens || 4000;
    const timeoutMs = strategySettings?.featherlessTimeoutMs || (strategySettings?.timeoutSeconds || 90) * 1000;

    const dataSource = racePack.externalResearch?.openAiSearchUsed
      ? 'EXTERNAL_FORM_PLUS_MARKET'
      : 'BETFAIR_METADATA_PLUS_MARKET';

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT.replace('__RACE_PACK_JSON__', JSON.stringify(racePack)) },
    ];

    const requestStart = Date.now();
    const aiStartedAt = new Date(requestStart).toISOString();
    const selectionIdsRequested = (racePack?.runners || []).map((runner) => String(runner.selectionId || runner.betfairSelectionId || '')).filter(Boolean);
    telemetryModel = modelName; telemetrySelectionIds = selectionIdsRequested; telemetryStartedAt = aiStartedAt;

    const apiResp = await fetch(`${FEATHERLESS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const responseTimeMs = Date.now() - requestStart;

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      let errMessage = `Featherless API error ${apiResp.status}`;
      try { const errJson = JSON.parse(errText); errMessage = errJson.error?.message || errMessage; } catch (_) {}
      const aiCallStatus = apiResp.status === 401 || apiResp.status === 403 ? 'authentication_error' : 'provider_error';
      return Response.json({
        error: errMessage,
        featherlessStatus: aiCallStatus,
        responseTimeMs,
        aiResult: null,
        aiTelemetry: { aiRequested: true, aiProvider: 'featherless', aiModel: modelName, aiRequestId: apiResp.headers.get('x-request-id'), aiStartedAt, aiCompletedAt: new Date().toISOString(), aiLatencyMs: responseTimeMs, aiHttpStatus: apiResp.status, aiCallStatus, aiErrorCode: `HTTP_${apiResp.status}`, aiErrorMessage: errMessage, aiTimedOut: false, aiRawResponseReceived: !!errText, aiResponseParseStatus: 'not_applicable', aiSchemaValidationStatus: 'not_applicable', aiRunnerCountRequested: selectionIdsRequested.length, aiRunnerCountReturned: 0, aiSelectionIdsRequested: selectionIdsRequested, aiSelectionIdsReturned: [], aiUsableProbabilityCount: 0 },
      }, { status: 200 });
    }

    const apiData = await apiResp.json();
    let rawContent = apiData.choices?.[0]?.message?.content || '';

    // Strip reasoning blocks — handle both closed <think>...</think> and unclosed <think>... (truncated)
    rawContent = rawContent.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
    if (rawContent.startsWith('"')) {
      rawContent = '{' + rawContent;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (_) {
      try {
        let fixed = rawContent.replace(/,\s*$/, '');
        let braces = 0, brackets = 0, inStr = false, esc = false;
        for (const ch of fixed) {
          if (esc) { esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === '{') braces++;
          else if (ch === '}') braces--;
          else if (ch === '[') brackets++;
          else if (ch === ']') brackets--;
        }
        for (let i = 0; i < brackets; i++) fixed += ']';
        for (let i = 0; i < braces; i++) fixed += '}';
        parsed = JSON.parse(fixed);
      } catch (_) {
        return Response.json({
          error: 'AI returned invalid JSON', featherlessStatus: 'invalid_response', responseTimeMs, aiResult: null, rawResponse: rawContent.slice(0, 2000),
          aiTelemetry: { aiRequested: true, aiProvider: 'featherless', aiModel: modelName, aiRequestId: apiData.id || null, aiStartedAt, aiCompletedAt: new Date().toISOString(), aiLatencyMs: responseTimeMs, aiHttpStatus: apiResp.status, aiCallStatus: 'invalid_response', aiErrorCode: 'INVALID_JSON', aiErrorMessage: 'AI returned invalid JSON', aiTimedOut: false, aiRawResponseReceived: !!rawContent, aiResponseParseStatus: 'failed', aiSchemaValidationStatus: 'not_applicable', aiRunnerCountRequested: selectionIdsRequested.length, aiRunnerCountReturned: 0, aiSelectionIdsRequested: selectionIdsRequested, aiSelectionIdsReturned: [], aiUsableProbabilityCount: 0 },
        }, { status: 200 });
      }
    }

    const validation = validateAIResponse(parsed, racePack);

    if (!validation.valid) {
      const status = validation.usable.length === 0 ? 'no_usable_probabilities' : validation.errors.some((error) => error.includes('selectionId') || error.includes('Missing runners')) ? 'selection_mapping_error' : 'schema_error';
      return Response.json({ error: validation.errors.join('; '), featherlessStatus: status, responseTimeMs, aiResult: null, validation,
        aiTelemetry: { aiRequested: true, aiProvider: 'featherless', aiModel: modelName, aiRequestId: apiData.id || null, aiStartedAt, aiCompletedAt: new Date().toISOString(), aiLatencyMs: responseTimeMs, aiHttpStatus: apiResp.status, aiCallStatus: status, aiErrorCode: status.toUpperCase(), aiErrorMessage: validation.errors.join('; '), aiTimedOut: false, aiRawResponseReceived: !!rawContent, aiResponseParseStatus: 'success', aiSchemaValidationStatus: 'failed', aiRunnerCountRequested: validation.requestedIds.length, aiRunnerCountReturned: validation.returnedIds.length, aiSelectionIdsRequested: validation.requestedIds, aiSelectionIdsReturned: validation.returnedIds, aiUsableProbabilityCount: validation.usable.length },
      }, { status: 200 });
    }

    const runnerById = new Map((racePack.runners || []).map((runner) => [String(runner.selectionId || runner.betfairSelectionId || ''), runner]));
    const aiResult = {
      decisionSource: 'FEATHERLESS_AI', raceId: racePack.raceId, eventId: racePack.eventId, eventName: racePack.eventName,
      raceSummary: parsed.raceSummary || '', dataQuality: Math.round((validation.usable.reduce((sum, item) => sum + item.confidence, 0) / validation.usable.length) * 100),
      confidence: Math.round((validation.usable.reduce((sum, item) => sum + item.confidence, 0) / validation.usable.length) * 100), marketRead: '', keyRisks: [],
      runnerProbabilities: validation.usable.map((item) => { const runner = runnerById.get(item.selectionId); const pPlace = Math.min(0.95, Math.max(item.probability, item.probability * 1.5)); return { selectionId: item.selectionId, runnerName: runner?.runnerName || '', pWin: item.probability, pPlace, confidence: item.confidence * 100, fairWinOdds: 1 / item.probability, fairPlaceOdds: 1 / pPlace, positiveSignals: [], negativeSignals: [], reasoning: item.reasoningSummary, dataQuality: item.confidence * 100 }; }),
      h2hProbabilities: [], recommendedOpportunities: [], noBetReasons: [],
      finalRaceView: { bestRunner: null, mostOverpricedRunner: null, mostUnderpricedRunner: null, bestBackCandidate: null, bestLayCandidate: null, shouldBetThisRace: false, summaryReason: parsed.raceSummary || '' },
    };

    // Save to database for audit trail
    const decisionRecord = {
      strategyName: 'Featherless AI Value Decision Engine',
      marketId: racePack.raceId,
      betfairMarketId: racePack.marketSummary?.winMarket?.marketId || racePack.raceId,
      modelName,
      promptVersion: PROMPT_VERSION,
      decision: aiResult.finalRaceView?.shouldBetThisRace ? 'BET' : 'WATCH',
      selectedRunner: aiResult.finalRaceView?.bestRunner || '',
      selectionId: '',
      estimatedProbability: 0,
      fairOdds: 0,
      betfairOdds: 0,
      minimumAcceptableOdds: 0,
      valueEdge: 0,
      expectedROI: 0,
      confidence: aiResult.confidence,
      raceRiskLevel: aiResult.keyRisks?.length > 2 ? 'HIGH' : aiResult.keyRisks?.length > 0 ? 'MEDIUM' : 'LOW',
      dataQualityScore: aiResult.dataQuality,
      mostLikelyWinner: aiResult.finalRaceView?.bestRunner || '',
      mainReason: aiResult.raceSummary,
      risks: aiResult.keyRisks || [],
      warnings: (aiResult.noBetReasons || []).map(n => n.reason),
      runnerAssessments: aiResult.runnerProbabilities,
      decisionChecks: { finalRaceView: aiResult.finalRaceView },
      validationStatus: validation.valid ? 'valid' : 'invalid',
      validationErrors: validation.errors,
      safetyGatePassed: validation.valid,
      safetyGateFailures: validation.valid ? [] : validation.errors,
      paperTradeCreated: false,
      recommendedStake: 0,
      stakingMode: strategySettings?.stakingMode || 'confidence_weighted_fractional_kelly',
      responseTimeMs,
      rawResponse: rawContent.slice(0, 5000),
      raceContextJson: JSON.stringify(racePack).slice(0, 10000),
      noBetReason: validation.valid ? '' : validation.errors[0],
      dataSource,
      mainBlocker: validation.valid ? '' : validation.errors[0],
      runnerDiagnostics: aiResult.runnerProbabilities,
      webResearchSummary: aiResult.raceSummary,
    };

    try {
      const saved = await base44.entities.FeatherlessAIDecision.create(decisionRecord);
      decisionRecord.id = saved.id;
    } catch (_) {}

    return Response.json({
      success: true,
      aiResult,
      featherlessStatus: 'success',
      decision: decisionRecord,
      validation,
      responseTimeMs,
      aiProvider: 'featherless',
      aiModel: modelName,
      aiResponseRunnerCount: aiResult.runnerProbabilities.length,
      aiTelemetry: { aiRequested: true, aiProvider: 'featherless', aiModel: modelName, aiRequestId: apiData.id || null, aiStartedAt, aiCompletedAt: new Date().toISOString(), aiLatencyMs: responseTimeMs, aiHttpStatus: apiResp.status, aiCallStatus: 'success', aiErrorCode: null, aiErrorMessage: null, aiTimedOut: false, aiRawResponseReceived: !!rawContent, aiResponseParseStatus: 'success', aiSchemaValidationStatus: 'valid', aiRunnerCountRequested: validation.requestedIds.length, aiRunnerCountReturned: validation.returnedIds.length, aiSelectionIdsRequested: validation.requestedIds, aiSelectionIdsReturned: validation.returnedIds, aiUsableProbabilityCount: validation.usable.length },
    });
  } catch (error) {
    const isTimeout = error.message?.toLowerCase().includes('timeout') || error.name === 'AbortError';
    return Response.json({
      error: error.message,
      featherlessStatus: isTimeout ? 'timeout' : 'provider_error',
      aiResult: null,
      aiTelemetry: { aiRequested: true, aiProvider: 'featherless', aiModel: telemetryModel, aiRequestId: null, aiStartedAt: telemetryStartedAt, aiCompletedAt: new Date().toISOString(), aiLatencyMs: telemetryStartedAt ? Math.max(0, Date.now() - new Date(telemetryStartedAt).getTime()) : null, aiHttpStatus: null, aiCallStatus: isTimeout ? 'timeout' : 'provider_error', aiErrorCode: isTimeout ? 'TIMEOUT' : (error.name || 'PROVIDER_ERROR'), aiErrorMessage: error.message, aiTimedOut: isTimeout, aiRawResponseReceived: false, aiResponseParseStatus: 'not_applicable', aiSchemaValidationStatus: 'not_applicable', aiRunnerCountRequested: telemetrySelectionIds.length, aiRunnerCountReturned: 0, aiSelectionIdsRequested: telemetrySelectionIds, aiSelectionIdsReturned: [], aiUsableProbabilityCount: 0 },
    }, { status: 200 });
  }
});