import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';

// ── Model Configuration ──
// Primary: DeepSeek-V4-Flash (284B params, 256K context) — major upgrade
// from V3.2. Strong numerical reasoning and JSON adherence.
//
// Ensemble (opt-in): Qwen3-8B is lightweight (1 concurrency unit) so it can
// run alongside the primary model within the 4-unit plan limit. Averaging
// probability estimates from two different model families reduces bias.
// NOTE: the ensemble is disabled by default — enable via useEnsemble=true.
const PRIMARY_MODEL = 'deepseek-ai/DeepSeek-V4-Flash';
const ENSEMBLE_MODEL = 'Qwen/Qwen3-8B';

const SYSTEM_PROMPT = `You are a professional Australian horse racing analyst and probability modeller working inside the Betfair Edge Lab app.

Your task: estimate each runner's TRUE win probability using Betfair market microstructure data.

ANALYTICAL FRAMEWORK — work through these steps for each runner before assigning a probability:

1. MARKET EFFICIENCY BASELINE
   - Start from the implied probability (1 / back price). In liquid markets (traded volume > $50K, spread ≤ 2 ticks), the market price is a strong prior — your estimate should stay within ±15% of it unless you have a compelling reason to deviate.
   - In thin markets (traded volume < $10K, spread > 5 ticks), the price is less reliable — wider deviation is justified.

2. LIQUIDITY & CONFIDENCE SIGNALS
   - High traded volume = money has been staked = market is more informative. Runners with > $100K traded are likely well-priced.
   - Tight back/lay spread (0-2 ticks) = competitive market makers = price is efficient. Wide spread (> 5 ticks) = uncertainty or manipulation risk.
   - Large back/lay sizes ($500+) on one side = directional money. Large back size with small lay size suggests money thinks the runner will win.

3. FAVOURITE RANK PATTERNS
   - In Australian thoroughbred racing, favourites win approximately 33% of the time. Second favourites win ~20%. Third favourites ~14%.
   - Short-priced favourites (odds < 2.5) are typically over-bet — the true probability is often slightly LOWER than implied.
   - Long-priced outsiders (odds > 15) are typically under-bet — the true probability is often slightly HIGHER than implied (the "longshot bias").

4. PROBABILITY CALIBRATION
   - The sum of all runner probabilities MUST equal approximately 1.0 (±0.05).
   - Apply the favourite-longshot bias adjustment: shave 2-5% off short-priced favourites and redistribute to mid-price runners.
   - If you lack data to deviate from the market, return the implied probability. Do not invent edge.
   - Confidence reflects how much market data supports your estimate, NOT how confident you are the horse will win. A well-priced favourite in a liquid market = high confidence. A runner in a thin, wide-spread market = low confidence.

5. VALUE RATING
   - STRONG_VALUE: back price is >10% above your fair odds (significant edge after commission)
   - SMALL_VALUE: back price is 3-10% above fair odds (marginal edge, may not survive commission)
   - FAIR_PRICE: back price is within ±3% of fair odds
   - UNDERPRICED: back price is below fair odds (negative edge — do NOT back)
   - AVOID: insufficient data, manipulated market, or extreme risk

Return valid JSON only. No markdown, no code fences, no commentary.`;

const USER_PROMPT = `Analyse this Betfair Edge Lab race object. Estimate the true win probability for each runner using the analytical framework in your system instructions.

Race object:
<RACE_DATA>
__RACE_JSON__
</RACE_DATA>

For each runner, return:
- estimated_probability: decimal 0-1 (e.g. 0.285 for 28.5%)
- fair_odds: 1 / estimated_probability (e.g. 3.51)
- confidence: 0-100 (how well-supported the estimate is by market data)
- form_assessment: brief assessment (max 15 words) of the runner's market profile
- value_rating: STRONG_VALUE | SMALL_VALUE | FAIR_PRICE | UNDERPRICED | AVOID

CALIBRATION RULES:
- Sum of all estimated_probability values must be approximately 1.0 (±0.05)
- Apply favourite-longshot bias: slightly reduce favourites' probabilities, slightly increase outsiders'
- In liquid markets, stay close to implied probability unless you have strong evidence
- In thin markets, wider deviation is acceptable but lower your confidence

Return ONLY this JSON structure:
{
  "runners": [
    {
      "runner": "<runner name from race data>",
      "selection_id": "<selection_id from race data>",
      "estimated_probability": <decimal 0-1>,
      "fair_odds": <decimal >1>,
      "confidence": <number 0-100>,
      "form_assessment": "<max 15 words>",
      "value_rating": "STRONG_VALUE" | "SMALL_VALUE" | "FAIR_PRICE" | "UNDERPRICED" | "AVOID"
    }
  ]
}

Include one entry per runner. Selection IDs must match the race data exactly.`;

function buildRaceObject(market, runners, settings) {
  const marketRunners = runners.filter(r => r.marketId === market.id || r.marketId === market.betfairMarketId);
  const startTime = market.startTime || market.marketStartTime;
  const timeBeforeJump = startTime ? Math.round((new Date(startTime).getTime() - Date.now()) / 1000) : null;
  const commissionRate = market.marketBaseRate ?? settings?.defaultCommissionRate ?? 0.05;

  const runnerObjects = marketRunners
    .filter(r => r.status === 'ACTIVE')
    .map((r, idx) => {
      const betfairProb = r.bestBackPrice > 0 ? (1 / r.bestBackPrice) * 100 : 0;
      const spreadTicks = r.spreadTicks || 0;
      const totalMatched = r.tradedVolumeAmount || r.tradedVolume || r.totalMatched || 0;

      // Liquidity classification for the model
      let liquidityTier = 'THIN';
      if (totalMatched > 50000) liquidityTier = 'LIQUID';
      else if (totalMatched > 10000) liquidityTier = 'MODERATE';

      let spreadTier = 'WIDE';
      if (spreadTicks <= 2) spreadTier = 'TIGHT';
      else if (spreadTicks <= 5) spreadTier = 'MODERATE';

      return {
        runner_name: r.runnerName,
        selection_id: String(r.betfairSelectionId || r.selectionId || ''),
        status: r.status || 'ACTIVE',
        barrier: idx + 1,
        betfair_back_price: r.bestBackPrice || 0,
        betfair_lay_price: r.bestLayPrice || 0,
        betfair_back_size: r.bestBackSize || 0,
        betfair_lay_size: r.bestLaySize || 0,
        betfair_traded_volume: totalMatched,
        back_lay_spread_ticks: spreadTicks,
        spread_tier: spreadTier,
        liquidity_tier: liquidityTier,
        market_rank: r.favouriteRank || idx + 1,
        is_favourite: (r.favouriteRank || idx + 1) === 1,
        betfair_implied_probability: betfairProb,
      };
    });

  return {
    race_context: {
      app: 'Betfair Edge Lab',
      track: market.venue || '',
      meeting_date: (startTime || '').slice(0, 10),
      race_number: market.raceNumber || 0,
      race_name: market.marketName || '',
      start_time: startTime || '',
      time_before_jump_seconds: timeBeforeJump === null ? -1 : timeBeforeJump,
      commission_rate: commissionRate,
      market_status: market.status || 'OPEN',
      in_play: market.inPlay || false,
      total_traded_volume: market.totalMatched || 0,
      active_runner_count: runnerObjects.length
    },
    runners: runnerObjects
  };
}

async function callModel(apiKey, modelName, raceObject) {
  const userPrompt = USER_PROMPT.replace('__RACE_JSON__', JSON.stringify(raceObject, null, 2));

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  const resp = await fetch(`${FEATHERLESS_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.1,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let errMessage = `Featherless API error ${resp.status}`;
    try { const errJson = JSON.parse(errText); errMessage = errJson.error?.message || errMessage; } catch (_) {}
    throw new Error(`${modelName}: ${errMessage}`);
  }

  const data = await resp.json();
  let rawContent = data.choices?.[0]?.message?.content || '';
  const finishReason = data.choices?.[0]?.finish_reason;

  // DeepSeek-V4 models may output <think>...</think> reasoning blocks
  // before the actual JSON. Strip them out.
  // DeepSeek-V4 reasoning blocks
  rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Normalize: if content starts with "runners":, prepend opening brace
  let normalized = rawContent.trim();
  if (normalized.startsWith('"runners"')) {
    normalized = '{' + normalized;
  }

  let parsed;
  try {
    parsed = JSON.parse(normalized);
  } catch (_) {
    // Response was likely truncated. Try to close unmatched brackets.
    try {
      let fixed = normalized.replace(/,\s*$/, '');
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
      throw new Error(`${modelName}: returned invalid JSON (finish_reason: ${finishReason}, first 500 chars: ${rawContent.slice(0, 500)})`);
    }
  }

  return parsed.runners || parsed || [];
}

function mergeEnsemble(primaryRunners, ensembleRunners) {
  if (!ensembleRunners || ensembleRunners.length === 0) return primaryRunners;

  // Build a lookup by selection_id, falling back to runner name
  const ensembleMap = new Map();
  for (const r of ensembleRunners) {
    const key = String(r.selection_id || r.runner || '');
    ensembleMap.set(key, r);
  }

  const merged = primaryRunners.map(pr => {
    const key = String(pr.selection_id || pr.runner || '');
    const er = ensembleMap.get(key);

    if (!er) return pr;

    // Average the probability estimates
    const avgProb = (pr.estimated_probability + (er.estimated_probability || pr.estimated_probability)) / 2;
    // Average confidence
    const avgConf = Math.round((pr.confidence + (er.confidence || pr.confidence)) / 2);
    // Recalculate fair odds
    const fairOdds = avgProb > 0 ? 1 / avgProb : pr.fair_odds;

    return {
      ...pr,
      estimated_probability: avgProb,
      fair_odds: fairOdds,
      confidence: avgConf,
      form_assessment: pr.form_assessment,
      value_rating: pr.value_rating,
      ensemble_model: er ? ENSEMBLE_MODEL : null,
    };
  });

  // Renormalise probabilities to sum to 1.0
  const sum = merged.reduce((s, r) => s + (r.estimated_probability || 0), 0);
  if (sum > 0 && Math.abs(sum - 1.0) > 0.01) {
    const factor = 1.0 / sum;
    for (const r of merged) {
      r.estimated_probability = (r.estimated_probability || 0) * factor;
      r.fair_odds = r.estimated_probability > 0 ? 1 / r.estimated_probability : r.fair_odds;
    }
  }

  return merged;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (_) {
      return Response.json({ error: 'Authentication required. Please log in and try again.' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Authentication required. Please log in and try again.' }, { status: 401 });

    const body = await req.json();
    const { market, runners, settings, useEnsemble } = body;

    if (!market) return Response.json({ error: 'market is required' }, { status: 400 });

    const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
    if (!apiKey) return Response.json({ error: 'FEATHERLESS_API_KEY not set' }, { status: 500 });

    const raceObject = buildRaceObject(market, runners, settings);
    const requestStart = Date.now();

    // ── Ensemble: call two models in parallel and average ──
    // Disabled by default — the primary model alone is a major upgrade.
    // Enable via useEnsemble=true for bias reduction (adds ~5-10s latency).
    const enableEnsemble = useEnsemble === true;

    if (enableEnsemble) {
      const [primaryResult, ensembleResult] = await Promise.allSettled([
        callModel(apiKey, PRIMARY_MODEL, raceObject),
        callModel(apiKey, ENSEMBLE_MODEL, raceObject),
      ]);

      const primaryRunners = primaryResult.status === 'fulfilled' ? primaryResult.value : [];
      const ensembleRunners = ensembleResult.status === 'fulfilled' ? ensembleResult.value : [];

      if (primaryRunners.length === 0 && ensembleRunners.length === 0) {
        const errMsg = primaryResult.status === 'rejected' ? primaryResult.reason.message :
                       ensembleResult.status === 'rejected' ? ensembleResult.reason.message :
                       'Both models returned no runners';
        return Response.json({ error: errMsg, responseTimeMs: Date.now() - requestStart }, { status: 502 });
      }

      const merged = mergeEnsemble(
        primaryRunners.length > 0 ? primaryRunners : ensembleRunners,
        ensembleRunners
      );

      return Response.json({
        success: true,
        runners: merged,
        modelsUsed: {
          primary: PRIMARY_MODEL,
          ensemble: ensembleRunners.length > 0 ? ENSEMBLE_MODEL : null,
        },
        ensembleActive: ensembleRunners.length > 0,
        responseTimeMs: Date.now() - requestStart,
      });
    }

    // ── Single model fallback ──
    const runners_data = await callModel(apiKey, PRIMARY_MODEL, raceObject);
    return Response.json({
      success: true,
      runners: runners_data,
      modelsUsed: { primary: PRIMARY_MODEL, ensemble: null },
      ensembleActive: false,
      responseTimeMs: Date.now() - requestStart,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});