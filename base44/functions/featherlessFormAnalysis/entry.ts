import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';

const SYSTEM_PROMPT = `You are a professional Australian horse racing form analyst and probability modeller working inside the Betfair Edge Lab app. Your job is to analyse race data and estimate each runner's true win probability.

You will receive a race object containing Betfair market data (prices, volumes, spreads, favourite rank) for each runner. Use this data along with your knowledge of horse racing form, market efficiency, and Australian racing patterns to estimate each runner's true win probability.

Key principles:
- The sum of all estimated probabilities should be approximately 1.0.
- Be conservative. If the market is efficient, your estimates should be close to the implied probabilities.
- Only deviate from the implied probability when you have a strong analytical reason.
- Consider traded volume, spread tightness, and favourite rank as signals of market confidence.
- A runner with high traded volume and tight spread is more likely to be accurately priced.

Return valid JSON only. Do not include markdown, code fences, or commentary outside the JSON.`;

const USER_PROMPT = `Analyse this Betfair Edge Lab race object. Estimate the true win probability for each runner.

For each runner:
- Estimate true win probability (decimal 0-1, e.g. 0.285 for 28.5%)
- Calculate fair odds (1 / probability)
- Rate your confidence in the estimate (0-100)
- Provide a brief form assessment based on the available market data
- Rate the runner: STRONG_VALUE (back price well above fair odds), SMALL_VALUE (slight edge), FAIR_PRICE (fairly priced), UNDERPRICED (back price below fair odds), or AVOID

You MUST return valid JSON only using EXACTLY this structure (no markdown, no code fences, no commentary):

{
  "runners": [
    {
      "runner": "<runner name from the race data>",
      "selection_id": "<selection_id from the race data>",
      "estimated_probability": <decimal 0-1>,
      "fair_odds": <decimal >1>,
      "confidence": <number 0-100>,
      "form_assessment": "<brief assessment>",
      "value_rating": "STRONG_VALUE" | "SMALL_VALUE" | "FAIR_PRICE" | "UNDERPRICED" | "AVOID"
    }
  ]
}

Include one entry per runner. The sum of all estimated_probability values should be approximately 1.0.`;

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
      return {
        runner_name: r.runnerName,
        selection_id: String(r.betfairSelectionId || r.selectionId || ''),
        status: r.status || 'ACTIVE',
        barrier: idx + 1,
        betfair_back_price: r.bestBackPrice || 0,
        betfair_lay_price: r.bestLayPrice || 0,
        betfair_back_size: r.bestBackSize || 0,
        betfair_lay_size: r.bestLaySize || 0,
        betfair_traded_volume: r.tradedVolumeAmount || r.tradedVolume || r.totalMatched || 0,
        back_lay_spread: spreadTicks,
        market_rank: r.favouriteRank || idx + 1,
        betfair_probability: betfairProb,
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
    const { market, runners, settings } = body;

    if (!market) return Response.json({ error: 'market is required' }, { status: 400 });

    const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
    if (!apiKey) return Response.json({ error: 'FEATHERLESS_API_KEY not set' }, { status: 500 });

    const raceObject = buildRaceObject(market, runners, settings);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT + '\n\nRace object:\n' + JSON.stringify(raceObject, null, 2) }
    ];

    const requestStart = Date.now();

    const apiResp = await fetch(`${FEATHERLESS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3.2',
        messages,
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    });

    const responseTimeMs = Date.now() - requestStart;

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      let errMessage = `Featherless API error ${apiResp.status}`;
      try { const errJson = JSON.parse(errText); errMessage = errJson.error?.message || errMessage; } catch (_) {}
      return Response.json({ error: errMessage, status: apiResp.status, responseTimeMs }, { status: 502 });
    }

    const apiData = await apiResp.json();
    const rawContent = apiData.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      return Response.json({ error: 'AI returned invalid JSON', rawResponse: rawContent.slice(0, 2000), responseTimeMs }, { status: 422 });
    }

    return Response.json({
      success: true,
      runners: parsed.runners || [],
      responseTimeMs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});