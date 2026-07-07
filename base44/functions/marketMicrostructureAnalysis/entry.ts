import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';

const PRIMARY_MODEL = 'deepseek-ai/DeepSeek-V4-Flash';
const ENSEMBLE_MODEL = 'Qwen/Qwen3-8B';

const SYSTEM_PROMPT = `You are a quantitative analyst working inside the Betfair Edge Lab app. Your specialty is BETFAIR EXCHANGE MARKET MICROSTRUCTURE ANALYSIS — NOT horse racing form analysis.

CRITICAL DISTINCTION:
- Market microstructure data = Betfair exchange prices, volume, spreads, liquidity, order book depth, price movements, BSP, and time-to-jump. This is ALWAYS available.
- Betfair runner metadata = jockey, trainer, age, sex, weight, official rating, stall draw, recent form string. This is SOMETIMES available from Betfair's RUNNER_METADATA.
- External full form = race distance, race class, track condition, barrier, track/distance record, previous starts, jockey/trainer strike rates, speed/form ratings. This is RARELY available and must come from an external provider.

Your task: estimate each runner's TRUE win probability using whatever data is available, and clearly declare which data source you used.

ANALYTICAL FRAMEWORK:

1. MARKET MICROSTRUCTURE SIGNALS (always available)
   - Start from implied probability (1 / back price) as your prior.
   - In LIQUID markets (traded volume > $50K, spread ≤ 2 ticks), the market is highly efficient — stay within ±15% of implied probability.
   - In THIN markets (< $10K traded, spread > 5 ticks), wider deviation is justified but lower confidence.
   - Back/lay size imbalance indicates directional money. Large back size with small lay size suggests money thinks the runner will win.
   - Order book imbalance = (totalBackSize - totalLaySize) / (totalBackSize + totalLaySize). Positive = back pressure, negative = lay pressure.
   - Price movement (steam = shortening, drift = lengthening) indicates momentum.
   - Traded volume delta shows where money is flowing in real time.

2. BETFAIR RUNNER METADATA (may be null — do NOT hallucinate)
   - If jockeyName, trainerName, officialRating, adjustedRating, weightValue, stallDraw, daysSinceLastRun, or recentForm are provided as non-null, use them to adjust probability.
   - If ANY of these fields are null or missing, IGNORE them entirely. Do not infer or guess.
   - Do NOT assume a runner has a jockey or trainer if the data is not provided.
   - Do NOT guess age, sex, weight, or barrier if they are null.

3. EXTERNAL FULL FORM (rarely available — do NOT hallucinate)
   - If race distance, race class, track condition, barrier, track/distance record, previous starts, jockey/trainer strike rates, or speed/form ratings are provided as non-null, use them.
   - If these fields are null or missing, IGNORE them entirely.
   - Do NOT invent race distances, track conditions, or previous start data.

DATA SOURCE CLASSIFICATION:
- If only market data is available → dataSource = "MARKET_ONLY", label probability as "marketDerivedProbability"
- If market data + Betfair metadata is available → dataSource = "BETFAIR_METADATA_PLUS_MARKET", label probability as "metadataAdjustedProbability"
- If market data + external full form is available → dataSource = "EXTERNAL_FORM_PLUS_MARKET", label probability as "formAdjustedProbability"

PROBABILITY CALIBRATION:
- Sum of all runner probabilities MUST equal approximately 1.0 (±0.05).
- Apply favourite-longshot bias: slightly reduce favourites' probabilities (odds < 2.5), slightly increase outsiders' (odds > 15).
- Confidence reflects how well-supported your estimate is by the available data, NOT your enthusiasm.
- If only market data is available, confidence should reflect market efficiency (liquid = high, thin = low).
- If metadata or external form is available, confidence may increase because you have more evidence.

SCORING (separate components):
- marketScore (0-100): based on edge, liquidity, spread, traded volume, steam/drift, BSP pressure, order book imbalance
- metadataScore (0-100, null if no metadata): based on official rating, adjusted rating, recent form, days since last run, jockey/trainer presence, weight, stall draw
- externalFormScore (0-100, null if no external form): based on track/distance suitability, race class, track condition, previous runs, trainer/jockey statistics, speed/form ratings
- finalScore: marketScore only (MARKET_ONLY), marketScore + metadataScore (BETFAIR_METADATA_PLUS_MARKET), or all three (EXTERNAL_FORM_PLUS_MARKET)

If full racing form is unavailable, your form_assessment MUST say: "Full racing form unavailable. This decision is based on Betfair market behaviour and available runner metadata only."

Return valid JSON only. No markdown, no code fences, no commentary.`;

const USER_PROMPT = `Analyse this Betfair Edge Lab race object. Estimate the true win probability for each runner.

IMPORTANT: Only use fields that are provided as non-null. If a field is null, IGNORE it. Do not hallucinate or infer missing data.

Race object:
<RACE_DATA>
__RACE_JSON__
</RACE_DATA>

For each runner, return:
- estimated_probability: decimal 0-1
- fair_odds: 1 / estimated_probability
- confidence: 0-100 (how well-supported the estimate is by AVAILABLE data only)
- form_assessment: brief assessment (max 15 words) — if only market data, say so explicitly
- value_rating: STRONG_VALUE | SMALL_VALUE | FAIR_PRICE | UNDERPRICED | AVOID
- data_source: "MARKET_ONLY" | "BETFAIR_METADATA_PLUS_MARKET" | "EXTERNAL_FORM_PLUS_MARKET"
- market_score: 0-100
- metadata_score: 0-100 or null if no metadata available
- external_form_score: 0-100 or null if no external form available
- final_score: weighted combination per data source rules

CALIBRATION RULES:
- Sum of all estimated_probability values must be approximately 1.0 (±0.05)
- Apply favourite-longshot bias
- If only market data is available, stay close to implied probability unless you have strong microstructure evidence
- Do NOT hallucinate jockey, trainer, barrier, distance, or form data

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
      "value_rating": "STRONG_VALUE" | "SMALL_VALUE" | "FAIR_PRICE" | "UNDERPRICED" | "AVOID",
      "data_source": "MARKET_ONLY" | "BETFAIR_METADATA_PLUS_MARKET" | "EXTERNAL_FORM_PLUS_MARKET",
      "market_score": <0-100>,
      "metadata_score": <0-100 or null>,
      "external_form_score": <0-100 or null>,
      "final_score": <0-100>
    }
  ]
}

Include one entry per runner. Selection IDs must match the race data exactly.`;

function buildRaceObject(market, runners, settings, raceFormProfiles) {
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

      let liquidityTier = 'THIN';
      if (totalMatched > 50000) liquidityTier = 'LIQUID';
      else if (totalMatched > 10000) liquidityTier = 'MODERATE';

      let spreadTier = 'WIDE';
      if (spreadTicks <= 2) spreadTier = 'TIGHT';
      else if (spreadTicks <= 5) spreadTier = 'MODERATE';

      // Look up RaceFormProfile if provided
      const formProfile = raceFormProfiles?.find(fp =>
        String(fp.selectionId) === String(r.betfairSelectionId || r.selectionId) ||
        fp.runnerName === r.runnerName
      );

      return {
        runner_name: r.runnerName,
        selection_id: String(r.betfairSelectionId || r.selectionId || ''),
        status: r.status || 'ACTIVE',
        market_rank: r.favouriteRank || idx + 1,
        is_favourite: (r.favouriteRank || idx + 1) === 1,
        market_microstructure: {
          betfair_back_price: r.bestBackPrice || 0,
          betfair_lay_price: r.bestLayPrice || 0,
          betfair_back_size: r.bestBackSize || 0,
          betfair_lay_size: r.bestLaySize || 0,
          last_traded_price: r.lastTradedPrice || 0,
          total_traded_volume: totalMatched,
          back_lay_spread_ticks: spreadTicks,
          spread_tier: spreadTier,
          liquidity_tier: liquidityTier,
          betfair_implied_probability: betfairProb,
          available_to_back_ladder: r.availableToBackLadder || null,
          available_to_lay_ladder: r.availableToLayLadder || null,
          mid_price: r.midPrice || null,
          weighted_mid_price: r.weightedMidPrice || null,
          micro_price: r.microPrice || null,
          book_percentage: r.bookPercentage || null,
          order_book_imbalance: r.orderBookImbalance || null,
          back_pressure: r.backPressure || null,
          lay_pressure: r.layPressure || null,
          price_movement_short_term: r.priceMovementShortTerm || null,
          price_movement_medium_term: r.priceMovementMediumTerm || null,
          traded_volume_delta: r.tradedVolumeDelta || null,
          bsp_near_price: r.bspNearPrice || null,
          bsp_far_price: r.bspFarPrice || null,
        },
        betfair_metadata: formProfile ? {
          age: formProfile.age ?? null,
          sex: formProfile.sex ?? null,
          jockey_name: formProfile.jockeyName ?? null,
          trainer_name: formProfile.trainerName ?? null,
          stall_draw: formProfile.stallDraw ?? null,
          weight_value: formProfile.weightValue ?? null,
          weight_units: formProfile.weightUnits ?? null,
          official_rating: formProfile.officialRating ?? null,
          adjusted_rating: formProfile.adjustedRating ?? null,
          recent_form: formProfile.recentForm ?? null,
          days_since_last_run: formProfile.daysSinceLastRun ?? null,
          wearing: formProfile.wearing ?? null,
          cloth_number: formProfile.clothNumber ?? null,
          sort_priority: formProfile.sortPriority ?? null,
          sire_name: formProfile.sireName ?? null,
          dam_name: formProfile.damName ?? null,
          bred_country: formProfile.bredCountry ?? null,
          colour_type: formProfile.colourType ?? null,
          jockey_claim: formProfile.jockeyClaim ?? null,
          forecast_price_numerator: formProfile.forecastPriceNumerator ?? null,
          forecast_price_denominator: formProfile.forecastPriceDenominator ?? null,
          colours_description: formProfile.coloursDescription ?? null,
          owner_name: formProfile.ownerName ?? null,
        } : null,
        external_form: formProfile?.externalFormData ? {
          race_distance: formProfile.externalFormData.raceDistance ?? null,
          race_class: formProfile.externalFormData.raceClass ?? null,
          track_condition: formProfile.externalFormData.trackCondition ?? null,
          barrier: formProfile.externalFormData.barrier ?? null,
          track_distance_record: formProfile.externalFormData.trackDistanceRecord ?? null,
          previous_starts: formProfile.externalFormData.previousStarts ?? null,
          jockey_strike_rate: formProfile.externalFormData.jockeyStrikeRate ?? null,
          trainer_strike_rate: formProfile.externalFormData.trainerStrikeRate ?? null,
          speed_rating: formProfile.externalFormData.speedRating ?? null,
          form_rating: formProfile.externalFormData.formRating ?? null,
        } : null,
      };
    });

  return {
    race_context: {
      app: 'Betfair Edge Lab',
      analysis_type: 'Market Microstructure Analysis (not horse racing form)',
      description: 'Market Microstructure Analysis uses Betfair exchange prices, volume, spread, liquidity, price movement, implied probability, and time-to-jump to estimate market-derived probability. It does not represent full horse racing form unless runner metadata or external form data is available.',
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
      active_runner_count: runnerObjects.length,
    },
    runners: runnerObjects,
  };
}

async function callModel(apiKey, modelName, raceObject) {
  const userPrompt = USER_PROMPT.replace('__RACE_JSON__', JSON.stringify(raceObject, null, 2));

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
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

  rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  let normalized = rawContent.trim();
  if (normalized.startsWith('"runners"')) {
    normalized = '{' + normalized;
  }

  let parsed;
  try {
    parsed = JSON.parse(normalized);
  } catch (_) {
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
    const { market, runners, settings, raceFormProfiles, useEnsemble } = body;

    if (!market) return Response.json({ error: 'market is required' }, { status: 400 });

    const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
    if (!apiKey) return Response.json({ error: 'FEATHERLESS_API_KEY not set' }, { status: 500 });

    const raceObject = buildRaceObject(market, runners, settings, raceFormProfiles);
    const requestStart = Date.now();

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

      const merged = primaryRunners.length > 0 ? primaryRunners : ensembleRunners;
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