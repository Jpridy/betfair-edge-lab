import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';
const PROMPT_VERSION = '3.0-exchange';

const SYSTEM_PROMPT = `You are an elite Australian horse racing analyst working inside the Betfair Edge Lab Exchange Opportunity Engine.

Your task: analyse race data and return PROBABILITIES for every runner. You do NOT make betting decisions — the local deterministic exchange maths engine handles that.

OUTPUT REQUIREMENTS:
1. Estimate pWin (probability of winning) for every runner. These MUST sum to ~1.0.
2. Estimate pPlace (probability of placing) for every runner. These are SEPARATE from pWin — do not copy pWin as pPlace. pPlace should be higher than pWin for most runners.
3. For H2H/AvB markets (2-runner match markets), estimate pBeatsOpponent for each selection.
4. Return a dataQuality score (0-100) reflecting how reliable your estimates are.

PROBABILITY ESTIMATION GUIDELINES:
- Start from Betfair implied probability (1 / back price) as your prior.
- In LIQUID markets (traded volume > $50K, spread ≤ 2 ticks), stay within ±10% of implied probability unless you have overwhelming evidence.
- In MODERATE markets ($10K-$50K), ±20% deviation is acceptable.
- In THIN markets (< $10K, wide spread), wider deviation is justified but lower confidence.
- Apply favourite-longshot bias: favourites (odds < 2.5) are typically over-bet. Outsiders (odds > 15) are typically under-bet.
- pWin values MUST sum to ~1.0 (±0.05).
- pPlace values should reflect the probability of finishing in the place terms (typically top 2-3).
- For H2H markets, pBeatsOpponent + pBeatsOpponent(opponent) = 1.0.

PLACE PROBABILITY RULES:
- Do NOT set pPlace = pWin. A horse with pWin=0.20 might have pPlace=0.45.
- pPlace must always be >= pWin (you can't be more likely to win than to place).
- Consider field size, horse quality, and running style when estimating place probability.

H2H PROBABILITY RULES:
- In a 2-runner match, pBeatsOpponent for selection A = 1 - pBeatsOpponent for selection B.
- Consider direct form comparison, not just overall win probability.

CONFIDENCE:
- Confidence (0-100) reflects the strength of your evidence, NOT enthusiasm.
- Market-only data (no form): cap confidence at 65.
- With Betfair metadata (jockey, trainer, weight): up to 80.
- With full external form data: up to 95.

Return valid JSON only. No markdown, no code fences, no commentary outside the JSON.`;

const USER_PROMPT = `Analyse this race and return probability estimates for every runner.

Race data:
<RACE_DATA>
__RACE_JSON__
</RACE_DATA>

Return ONLY this JSON (no markdown, no commentary):
{
  "raceSummary": "<max 30 words summarising the race and key factors>",
  "dataQuality": <0-100>,
  "runnerProbabilities": [
    {
      "selectionId": "<selection_id from race data>",
      "runnerName": "<runner name>",
      "pWin": <0-1>,
      "pPlace": <0-1, must be >= pWin>,
      "confidence": <0-100>,
      "reasons": ["<brief reason>"],
      "risks": ["<risk factor>"]
    }
  ],
  "h2hProbabilities": [
    {
      "marketId": "<market_id if H2H market exists>",
      "selectionId": "<selection_id>",
      "opponentSelectionId": "<opponent selection_id>",
      "pBeatsOpponent": <0-1>,
      "confidence": <0-100>,
      "reasons": ["<brief reason>"]
    }
  ],
  "marketNotes": "<brief notes on market overround, liquidity, or anomalies>",
  "recommendedOpportunities": ["<brief description of any value spots you notice — the local engine will verify>"]
}

Rules:
- Include EVERY active runner in runnerProbabilities.
- pWin values MUST sum to ~1.0.
- pPlace must be >= pWin for each runner.
- Only include h2hProbabilities if H2H/AvB markets exist in the race data.
- If no H2H markets, return empty h2hProbabilities array.
- All probabilities are decimals (0.55 = 55%), never percentages.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    raceSummary: { type: 'string' },
    dataQuality: { type: 'number' },
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
          reasons: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
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
          opponentSelectionId: { type: 'string' },
          pBeatsOpponent: { type: 'number' },
          confidence: { type: 'number' },
          reasons: { type: 'array', items: { type: 'string' } },
        },
        required: ['selectionId', 'opponentSelectionId', 'pBeatsOpponent', 'confidence'],
      },
    },
    marketNotes: { type: 'string' },
    recommendedOpportunities: { type: 'array', items: { type: 'string' } },
  },
  required: ['raceSummary', 'dataQuality', 'runnerProbabilities'],
};

function buildRaceObject(market, runners, settings, strategySettings, raceFormProfiles, webResearch, allEventMarkets) {
  const marketRunners = runners.filter(r => r.marketId === market.id || r.marketId === market.betfairMarketId);
  const startTime = market.startTime || market.marketStartTime;
  const timeBeforeJump = startTime ? Math.round((new Date(startTime).getTime() - Date.now()) / 1000) : null;
  const commissionRate = market.marketBaseRate ?? settings.defaultCommissionRate ?? 0.05;

  const runnerObjects = marketRunners
    .filter(r => r.status === 'ACTIVE')
    .map((r, idx) => {
      const formProfile = raceFormProfiles?.find(fp =>
        String(fp.selectionId) === String(r.betfairSelectionId || r.selectionId) ||
        fp.runnerName === r.runnerName
      );

      return {
        runner_name: r.runnerName,
        selection_id: String(r.betfairSelectionId || r.selectionId || ''),
        status: r.status || 'ACTIVE',
        betfair_back_price: r.bestBackPrice || 0,
        betfair_lay_price: r.bestLayPrice || 0,
        betfair_back_size: r.bestBackSize || 0,
        betfair_lay_size: r.bestLaySize || 0,
        betfair_traded_volume: r.tradedVolumeAmount || r.tradedVolume || r.totalMatched || 0,
        back_lay_spread: r.spreadTicks || 0,
        market_rank: r.favouriteRank || idx + 1,
        betfair_probability: r.bestBackPrice > 0 ? (1 / r.bestBackPrice) * 100 : 0,
        betfair_metadata: formProfile ? {
          age: formProfile.age ?? null,
          sex: formProfile.sex ?? null,
          jockey_name: formProfile.jockeyName ?? null,
          trainer_name: formProfile.trainerName ?? null,
          stall_draw: formProfile.stallDraw ?? null,
          weight_value: formProfile.weightValue ?? null,
          official_rating: formProfile.officialRating ?? null,
          recent_form: formProfile.recentForm ?? null,
          days_since_last_run: formProfile.daysSinceLastRun ?? null,
        } : null,
        external_form: formProfile?.externalFormData ? {
          race_distance: formProfile.externalFormData.raceDistance ?? null,
          race_class: formProfile.externalFormData.raceClass ?? null,
          track_condition: formProfile.externalFormData.trackCondition ?? null,
          barrier: formProfile.externalFormData.barrier ?? null,
          previous_starts: formProfile.externalFormData.previousStarts ?? null,
          jockey_strike_rate: formProfile.externalFormData.jockeyStrikeRate ?? null,
          trainer_strike_rate: formProfile.externalFormData.trainerStrikeRate ?? null,
          speed_rating: formProfile.externalFormData.speedRating ?? null,
          form_rating: formProfile.externalFormData.formRating ?? null,
        } : null,
      };
    });

  // Include H2H market info if available
  const h2hMarkets = (allEventMarkets || []).filter(m => {
    const name = (m.marketName || '').toLowerCase();
    return name.includes(' v ') || name.includes(' vs ') || name.includes('avb') || name.includes('head to head') || name.includes('match betting');
  });

  return {
    race_context: {
      track: market.venue || '',
      race_number: market.raceNumber || 0,
      race_name: market.marketName || '',
      start_time: startTime || '',
      time_before_jump_seconds: timeBeforeJump === null ? -1 : timeBeforeJump,
      commission_rate: commissionRate,
      market_status: market.status || 'OPEN',
      in_play: market.inPlay || false,
      total_traded_volume: market.totalMatched || 0,
      active_runner_count: runnerObjects.length,
    },
    event_markets: (allEventMarkets || []).map(m => ({
      market_id: m.betfairMarketId || m.id,
      market_name: m.marketName || '',
      market_type: m.marketType || m.marketTypeCode || '',
      number_of_runners: m.numberOfRunners || m.numberOfActiveRunners || 0,
    })),
    h2h_markets: h2hMarkets.map(m => ({
      market_id: m.betfairMarketId || m.id,
      market_name: m.marketName || '',
    })),
    runners: runnerObjects,
    web_research: webResearch || null,
  };
}

function validateAIResponse(parsed, raceObject) {
  const errors = [];
  const runners = raceObject.runners || [];

  if (!parsed.runnerProbabilities || !Array.isArray(parsed.runnerProbabilities)) {
    errors.push('Missing or invalid runnerProbabilities array');
    return { valid: false, errors };
  }

  if (parsed.runnerProbabilities.length === 0) {
    errors.push('runnerProbabilities is empty');
  }

  // Check each runner probability
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
      errors.push(`pPlace < pWin for ${rp.runnerName || rp.selectionId} — pPlace must be >= pWin`);
    }
    if (typeof rp.confidence !== 'number' || rp.confidence < 0 || rp.confidence > 100) {
      errors.push(`Invalid confidence for ${rp.runnerName || rp.selectionId}: ${rp.confidence}`);
    }
  }

  // Check pWin sums to ~1.0
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
    const { market, runners, settings, strategySettings, bankrollStats, action, raceFormProfiles, webResearch, allEventMarkets } = body;

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

    if (!market) return Response.json({ error: 'market is required' }, { status: 400 });

    // Hard pre-check: don't call the AI if the race is outside the trading window
    const _startTime = market.startTime || market.marketStartTime;
    const _windowStart = strategySettings?.timeWindowStart || settings?.defaultTimeWindowStartSeconds || 500;
    const _windowEnd = strategySettings?.timeWindowEnd || settings?.defaultTimeWindowEndSeconds || 30;
    if (!_startTime) {
      const preCheckDecision = {
        strategyName: 'Featherless AI Value Decision Engine',
        marketId: market.id || market.betfairMarketId,
        betfairMarketId: market.betfairMarketId,
        decision: 'NO_BET',
        noBetReason: `No market start time — cannot verify trading window`,
        safetyGatePassed: false,
        safetyGateFailures: ['No market start time — cannot verify trading window'],
        validationStatus: 'valid',
        validationErrors: [],
        mainBlocker: 'No market start time — cannot verify trading window',
      };
      try { await base44.entities.FeatherlessAIDecision.create(preCheckDecision); } catch (_) {}
      return Response.json({ success: true, decision: preCheckDecision });
    }
    const _timeBeforeJump = Math.round((new Date(_startTime).getTime() - Date.now()) / 1000);
    if (_timeBeforeJump > _windowStart * 2) {
      const preCheckDecision = {
        strategyName: 'Featherless AI Value Decision Engine',
        marketId: market.id || market.betfairMarketId,
        betfairMarketId: market.betfairMarketId,
        decision: 'NO_BET',
        noBetReason: `Race starts in ${_timeBeforeJump}s — outside ${_windowStart * 2}s scan window`,
        safetyGatePassed: false,
        safetyGateFailures: [`Race starts in ${_timeBeforeJump}s — outside ${_windowStart * 2}s scan window`],
        validationStatus: 'valid',
        validationErrors: [],
        mainBlocker: `Race outside scan window (${_timeBeforeJump}s before jump, max ${_windowStart * 2}s)`,
      };
      try { await base44.entities.FeatherlessAIDecision.create(preCheckDecision); } catch (_) {}
      return Response.json({ success: true, decision: preCheckDecision });
    }

    const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
    if (!apiKey) return Response.json({ error: 'FEATHERLESS_API_KEY not set' }, { status: 500 });

    const modelName = strategySettings?.modelName || 'deepseek-ai/DeepSeek-V4-Flash';
    const temperature = strategySettings?.temperature ?? 0.1;
    const maxTokens = strategySettings?.maxTokens || 4000;
    const timeoutMs = (strategySettings?.timeoutSeconds || 90) * 1000;

    const hasFormProfiles = raceFormProfiles && raceFormProfiles.length > 0;
    const hasWebResearch = webResearch && webResearch.research_summary;
    const dataSource = hasFormProfiles
      ? (raceFormProfiles.some(fp => fp.externalFormData) ? 'EXTERNAL_FORM_PLUS_MARKET' : 'BETFAIR_METADATA_PLUS_MARKET')
      : hasWebResearch ? 'EXTERNAL_FORM_PLUS_MARKET' : 'MARKET_ONLY';
    const raceObject = buildRaceObject(market, runners, settings, strategySettings, raceFormProfiles, webResearch, allEventMarkets);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT.replace('__RACE_JSON__', JSON.stringify(raceObject)) },
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
      return Response.json({ error: errMessage, status: apiResp.status, responseTimeMs }, { status: 200 });
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
        return Response.json({ error: 'AI returned invalid JSON', rawResponse: rawContent.slice(0, 2000) }, { status: 200 });
      }
    }

    const validation = validateAIResponse(parsed, raceObject);

    // Build AI result for the exchange engine
    const aiResult = {
      raceSummary: parsed.raceSummary || '',
      dataQuality: parsed.dataQuality || 50,
      runnerProbabilities: (parsed.runnerProbabilities || []).map(rp => ({
        selectionId: String(rp.selectionId),
        runnerName: rp.runnerName || '',
        pWin: Math.min(0.95, Math.max(0.01, rp.pWin || 0)),
        pPlace: Math.min(0.95, Math.max(0.01, rp.pPlace || rp.pWin || 0)),
        confidence: rp.confidence || 50,
        reasons: rp.reasons || [],
        risks: rp.risks || [],
      })),
      h2hProbabilities: (parsed.h2hProbabilities || []).map(h => ({
        marketId: h.marketId || market.betfairMarketId || market.id,
        selectionId: String(h.selectionId),
        opponentSelectionId: String(h.opponentSelectionId),
        pBeatsOpponent: Math.min(0.95, Math.max(0.05, h.pBeatsOpponent || 0.5)),
        confidence: h.confidence || 50,
        reasons: h.reasons || [],
      })),
      marketNotes: parsed.marketNotes || '',
      recommendedOpportunities: parsed.recommendedOpportunities || [],
    };

    // Save to database for audit trail
    const decisionRecord = {
      strategyName: 'Featherless AI Value Decision Engine',
      marketId: market.id || market.betfairMarketId,
      betfairMarketId: market.betfairMarketId,
      modelName,
      promptVersion: PROMPT_VERSION,
      decision: 'BET', // The AI returns probabilities; the engine decides. Log as BET for record-keeping.
      selectedRunner: '',
      selectionId: '',
      estimatedProbability: 0,
      fairOdds: 0,
      betfairOdds: 0,
      minimumAcceptableOdds: 0,
      valueEdge: 0,
      expectedROI: 0,
      confidence: aiResult.dataQuality,
      raceRiskLevel: 'MEDIUM',
      dataQualityScore: aiResult.dataQuality,
      mostLikelyWinner: '',
      mainReason: aiResult.raceSummary,
      risks: [],
      warnings: [],
      runnerAssessments: aiResult.runnerProbabilities,
      decisionChecks: {},
      validationStatus: validation.valid ? 'valid' : 'invalid',
      validationErrors: validation.errors,
      safetyGatePassed: validation.valid,
      safetyGateFailures: validation.valid ? [] : validation.errors,
      paperTradeCreated: false,
      recommendedStake: 0,
      stakingMode: strategySettings?.stakingMode || 'confidence_weighted_fractional_kelly',
      responseTimeMs,
      rawResponse: rawContent.slice(0, 5000),
      raceContextJson: JSON.stringify(raceObject).slice(0, 10000),
      noBetReason: validation.valid ? '' : validation.errors[0],
      dataSource,
      mainBlocker: validation.valid ? '' : validation.errors[0],
      runnerDiagnostics: aiResult.runnerProbabilities,
    };

    try {
      const saved = await base44.entities.FeatherlessAIDecision.create(decisionRecord);
      decisionRecord.id = saved.id;
    } catch (_) {}

    return Response.json({
      success: true,
      aiResult,
      decision: decisionRecord,
      validation,
      responseTimeMs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});