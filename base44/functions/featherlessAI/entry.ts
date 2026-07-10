import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

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

const USER_PROMPT = `You are assessing one complete Betfair exchange race. Analyse the full race pack below and return structured probabilities and value assessments.

<RACE_PACK>
__RACE_PACK_JSON__
</RACE_PACK>

Return ONLY this JSON (no markdown, no commentary):
{
  "decisionSource": "FEATHERLESS_RACE_ASSESSMENT",
  "raceId": "<raceId from race pack>",
  "eventId": "<eventId from race pack>",
  "eventName": "<eventName from race pack>",
  "dataQuality": <0-100>,
  "confidence": <0-100, overall race-level confidence>,
  "raceSummary": "<max 50 words summarising the race and key factors>",
  "marketRead": "<brief read on market overround, liquidity, anomalies>",
  "keyRisks": ["<race-level risk factor>"],
  "runnerProbabilities": [
    {
      "selectionId": "<selection_id from race pack>",
      "runnerName": "<runner name>",
      "pWin": <0-1>,
      "pPlace": <0-1, must be >= pWin>,
      "confidence": <0-100>,
      "fairWinOdds": <decimal odds = 1/pWin>,
      "fairPlaceOdds": <decimal odds = 1/pPlace>,
      "positiveSignals": ["<factor supporting this runner>"],
      "negativeSignals": ["<factor against this runner>"],
      "reasoning": "<brief explanation>",
      "dataQuality": <0-100 for this runner's data>
    }
  ],
  "h2hProbabilities": [
    {
      "marketId": "<market_id from race pack>",
      "selectionId": "<selection_id>",
      "runnerName": "<runner name>",
      "opponentSelectionId": "<opponent selection_id>",
      "opponentName": "<opponent name>",
      "pBeatsOpponent": <0-1>,
      "fairOdds": <decimal odds = 1/pBeatsOpponent>,
      "confidence": <0-100>,
      "reasoning": "<brief explanation>"
    }
  ],
  "recommendedOpportunities": [
    {
      "marketId": "<market_id>",
      "marketType": "WIN" | "PLACE" | "H2H",
      "selectionId": "<selection_id>",
      "runnerName": "<runner name>",
      "side": "BACK" | "LAY",
      "modelProbability": <0-1>,
      "fairOdds": <decimal>,
      "betfairOdds": <decimal from race pack>,
      "estimatedEdge": <percent>,
      "estimatedROI": <percent>,
      "confidence": <0-100>,
      "reasoning": "<brief explanation>",
      "risks": ["<risk factor>"]
    }
  ],
  "noBetReasons": [
    {
      "reason": "<reason not to bet>",
      "severity": "info" | "warning" | "critical",
      "affectedMarketId": "<market_id or null>",
      "affectedSelectionId": "<selection_id or null>"
    }
  ],
  "finalRaceView": {
    "bestRunner": "<runner name or null>",
    "mostOverpricedRunner": "<runner name or null>",
    "mostUnderpricedRunner": "<runner name or null>",
    "bestBackCandidate": "<runner name or null>",
    "bestLayCandidate": "<runner name or null>",
    "shouldBetThisRace": <true/false>,
    "summaryReason": "<max 30 words>"
  }
}

Rules:
- Include EVERY active runner in runnerProbabilities.
- pWin values MUST sum to ~1.0.
- pPlace must be >= pWin for each runner.
- Only include h2hProbabilities if H2H markets exist in the race pack.
- If no H2H markets, return empty h2hProbabilities array.
- All probabilities are decimals (0.55 = 55%), never percentages.
- recommendedOpportunities should list spots where model probability differs from Betfair odds — the local engine will verify with its own maths.
- Do NOT include any API keys or secrets in your response.`;

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
  const runners = racePack?.runners || [];

  if (!parsed.runnerProbabilities || !Array.isArray(parsed.runnerProbabilities)) {
    errors.push('Missing or invalid runnerProbabilities array');
    return { valid: false, errors };
  }

  if (parsed.runnerProbabilities.length === 0) {
    errors.push('runnerProbabilities is empty');
  }

  for (const rp of parsed.runnerProbabilities) {
    if (!rp.selectionId) {
      errors.push('Runner probability missing selectionId');
      continue;
    }
    if (typeof rp.pWin !== 'number' || rp.pWin < 0 || rp.pWin > 1) {
      errors.push(`Invalid pWin for ${rp.runnerName || rp.selectionId}: ${rp.pWin}`);
    }
    if (typeof rp.pPlace !== 'number' || rp.pPlace < 0 || rp.pPlace > 1) {
      errors.push(`Invalid pPlace for ${rp.runnerName || rp.selectionId}: ${rp.pPlace}`);
    }
    if (typeof rp.pWin === 'number' && typeof rp.pPlace === 'number' && rp.pPlace < rp.pWin) {
      errors.push(`pPlace < pWin for ${rp.runnerName || rp.selectionId}`);
    }
    if (typeof rp.confidence !== 'number' || rp.confidence < 0 || rp.confidence > 100) {
      errors.push(`Invalid confidence for ${rp.runnerName || rp.selectionId}: ${rp.confidence}`);
    }
  }

  const totalPWin = parsed.runnerProbabilities.reduce((s, rp) => s + (rp.pWin || 0), 0);
  if (totalPWin < 0.85 || totalPWin > 1.15) {
    errors.push(`pWin values sum to ${totalPWin.toFixed(3)} — should be ~1.0`);
  }

  if (typeof parsed.dataQuality !== 'number' || parsed.dataQuality < 0 || parsed.dataQuality > 100) {
    errors.push(`Invalid dataQuality: ${parsed.dataQuality}`);
  }

  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req) => {
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
      return Response.json({
        error: errMessage,
        featherlessStatus: 'failed',
        responseTimeMs,
        aiResult: null,
      }, { status: 200 });
    }

    const apiData = await apiResp.json();
    let rawContent = apiData.choices?.[0]?.message?.content || '';

    // Strip reasoning blocks
    rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
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
          error: 'AI returned invalid JSON',
          featherlessStatus: 'failed',
          responseTimeMs,
          aiResult: null,
          rawResponse: rawContent.slice(0, 2000),
        }, { status: 200 });
      }
    }

    const validation = validateAIResponse(parsed, racePack);

    // Build AI result for the exchange engine
    const aiResult = {
      decisionSource: 'FEATHERLESS_RACE_ASSESSMENT',
      raceId: racePack.raceId,
      eventId: racePack.eventId,
      eventName: racePack.eventName,
      raceSummary: parsed.raceSummary || '',
      dataQuality: parsed.dataQuality || 50,
      confidence: parsed.confidence || parsed.dataQuality || 50,
      marketRead: parsed.marketRead || '',
      keyRisks: parsed.keyRisks || [],
      runnerProbabilities: (parsed.runnerProbabilities || []).map(rp => ({
        selectionId: String(rp.selectionId),
        runnerName: rp.runnerName || '',
        pWin: Math.min(0.95, Math.max(0.01, rp.pWin || 0)),
        pPlace: Math.min(0.95, Math.max(0.01, rp.pPlace || rp.pWin || 0)),
        confidence: rp.confidence || 50,
        fairWinOdds: rp.fairWinOdds || (rp.pWin > 0 ? 1 / rp.pWin : 0),
        fairPlaceOdds: rp.fairPlaceOdds || (rp.pPlace > 0 ? 1 / rp.pPlace : 0),
        positiveSignals: rp.positiveSignals || [],
        negativeSignals: rp.negativeSignals || [],
        reasoning: rp.reasoning || '',
        dataQuality: rp.dataQuality || parsed.dataQuality || 50,
      })),
      h2hProbabilities: (parsed.h2hProbabilities || []).map(h => ({
        marketId: h.marketId || racePack.raceId,
        selectionId: String(h.selectionId),
        runnerName: h.runnerName || '',
        opponentSelectionId: String(h.opponentSelectionId),
        opponentName: h.opponentName || '',
        pBeatsOpponent: Math.min(0.95, Math.max(0.05, h.pBeatsOpponent || 0.5)),
        fairOdds: h.fairOdds || (h.pBeatsOpponent > 0 ? 1 / h.pBeatsOpponent : 0),
        confidence: h.confidence || 50,
        reasoning: h.reasoning || '',
      })),
      recommendedOpportunities: (parsed.recommendedOpportunities || []).map(ro => ({
        marketId: ro.marketId || '',
        marketType: ro.marketType || '',
        selectionId: String(ro.selectionId),
        runnerName: ro.runnerName || '',
        side: ro.side || 'BACK',
        modelProbability: ro.modelProbability || 0,
        fairOdds: ro.fairOdds || 0,
        betfairOdds: ro.betfairOdds || 0,
        estimatedEdge: ro.estimatedEdge || 0,
        estimatedROI: ro.estimatedROI || 0,
        confidence: ro.confidence || 50,
        reasoning: ro.reasoning || '',
        risks: ro.risks || [],
      })),
      noBetReasons: parsed.noBetReasons || [],
      finalRaceView: parsed.finalRaceView || {
        bestRunner: null,
        mostOverpricedRunner: null,
        mostUnderpricedRunner: null,
        bestBackCandidate: null,
        bestLayCandidate: null,
        shouldBetThisRace: false,
        summaryReason: '',
      },
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
    });
  } catch (error) {
    const isTimeout = error.message?.toLowerCase().includes('timeout') || error.name === 'AbortError';
    return Response.json({
      error: error.message,
      featherlessStatus: isTimeout ? 'timeout' : 'failed',
      aiResult: null,
    }, { status: 200 });
  }
});