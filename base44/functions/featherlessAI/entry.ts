import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';
const PROMPT_VERSION = '1.0';

const SYSTEM_PROMPT = `You are an elite Australian horse racing analyst and quantitative betting strategist working inside the Betfair Edge Lab app. You specialise in identifying value betting opportunities on Betfair's exchange markets.

Your task: analyse race data and make ONE disciplined paper-trading decision — BET, NO_BET, or WATCH.

DECISION FRAMEWORK — work through each step before reaching your conclusion:

1. PROBABILITY ESTIMATION
   - Start from Betfair implied probability (1 / back price) as your prior.
   - In LIQUID markets (traded volume > $50K, spread ≤ 2 ticks), the market is highly efficient — your estimate should stay within ±10% of implied probability unless you have overwhelming evidence.
   - In MODERATE markets ($10K-$50K traded), moderate deviation (±20%) is acceptable.
   - In THIN markets (< $10K traded, wide spread), the price is unreliable — wider deviation is justified but confidence must be low.
   - Apply the favourite-longshot bias: favourites (odds < 2.5) are typically over-bet (true prob slightly lower). Outsiders (odds > 15) are typically under-bet (true prob slightly higher).
   - The sum of all runner probabilities MUST equal ~1.0 (±0.05).

2. VALUE IDENTIFICATION
   - Value edge = (betfair_odds / fair_odds - 1) × 100
   - After commission (typically 5%), you need an edge of at LEAST 5% to break even. A genuine betting opportunity requires edge ≥ 8% after commission.
   - Expected ROI = (estimated_probability × (betfair_odds - 1) × (1 - commission)) - (1 - estimated_probability)
   - Only recommend BET if expected_roi is clearly positive (> 3%).

3. RISK ASSESSMENT
   - LIQUIDITY RISK: Markets with < $5K traded are dangerous — your bet may not get matched, or may move the price against you.
   - SPREAD RISK: Spreads > 5 ticks indicate uncertainty or manipulation. Avoid betting in these markets.
   - TIMING RISK: The ideal trading window is 300s-30s before the jump. Outside this window, prices are volatile and unreliable.
   - FIELD SIZE RISK: Races with > 12 runners have higher variance. Lower confidence.
   - SHORT-PRICED FAVOURITE RISK: If a dominant favourite (odds < 1.8) exists, other runners' probabilities are compressed and harder to estimate accurately.

4. DISCIPLINE RULES
   - NO_BET is the default. The burden of proof is on the data to show value, not on you to find a bet.
   - Do NOT bet just because a runner is the favourite — favourites are often over-bet.
   - Do NOT bet just because odds are high — longshots are often under-bet but still lose most of the time.
   - Do NOT chase market drifters (runners whose price is shortening) unless the new price still offers value after the move.
   - If you cannot identify a runner with edge > 8% after commission, return NO_BET.
   - WATCH means the race is interesting but the data doesn't support a bet yet (monitor for price movement).
   - Confidence reflects the strength of your evidence, NOT your enthusiasm for the bet. A well-supported bet in a liquid market = 80-90 confidence. A marginal bet in a thin market = 50-60 confidence.

5. STAKE SIZING
   - Use fractional Kelly criterion (quarter Kelly) adjusted by confidence.
   - Kelly fraction = ((odds - 1) × probability - (1 - probability)) / (odds - 1)
   - Recommended stake = bankroll × kelly_fraction × 0.25 × (confidence / 100)
   - Cap at 1% of bankroll for any single bet.
   - If kelly_fraction ≤ 0, do not bet.

Return valid JSON only. No markdown, no code fences, no commentary outside the JSON.`;

const USER_PROMPT = `Analyse this Betfair Edge Lab race object. Use the Betfair historical summary, racing form data, optional bookmaker odds and live Betfair prices to make one final decision for the Paper Trading system.

For each runner:
- Estimate true win probability (as a decimal 0-1, e.g. 0.285 for 28.5%)
- Estimate fair odds (decimal, e.g. 3.5)
- Compare fair odds against Betfair odds after commission
- Assess form strength
- Assess historical support
- Assess live market strength
- Assess liquidity
- Assess price movement risk
- Rate runner as STRONG_VALUE, SMALL_VALUE, FAIR_PRICE, UNDERPRICED or AVOID

Then make one race decision:
BET, NO_BET or WATCH.

Only recommend BET if there is a clear positive edge after commission and enough evidence to support it.

You MUST return valid JSON only using EXACTLY this structure (no markdown, no code fences, no commentary):

{
  "race_decision": {
    "decision": "BET" | "NO_BET" | "WATCH",
    "overall_confidence": <number 0-100>,
    "race_risk_level": "LOW" | "MEDIUM" | "HIGH",
    "summary": "<brief race summary>",
    "primary_no_bet_reason": "<reason if NO_BET, else empty string>",
    "data_quality_score": <number 0-100>
  },
  "selected_bet": {
    "runner": "<runner name from the race data>",
    "selection_id": "<selection_id from the race data>",
    "estimated_probability": <decimal 0-1>,
    "fair_odds": <decimal >1>,
    "betfair_odds": <decimal, the back price>,
    "break_even_probability": <decimal 0-1>,
    "value_edge": <decimal percentage, e.g. 5.0 for 5%>,
    "expected_roi": <decimal, e.g. 0.03 for 3%>,
    "confidence": <number 0-100>,
    "minimum_acceptable_odds": <decimal >1>,
    "stake_multiplier": <decimal 0-1>,
    "reason": "<why this runner was selected>",
    "risks": ["<risk 1>", "<risk 2>"]
  },
  "most_likely_winner": {
    "runner": "<runner name>",
    "selection_id": "<selection_id>",
    "estimated_probability": <decimal 0-1>,
    "fair_odds": <decimal >1>,
    "confidence": <number 0-100>,
    "reason": "<why this runner is most likely to win>"
  },
  "runner_assessments": [
    {
      "runner": "<runner name>",
      "selection_id": "<selection_id>",
      "estimated_probability": <decimal 0-1>,
      "fair_odds": <decimal >1>,
      "betfair_odds": <decimal>,
      "value_edge": <decimal percentage>,
      "expected_roi": <decimal>,
      "confidence": <number 0-100>,
      "rating": "STRONG_VALUE" | "SMALL_VALUE" | "FAIR_PRICE" | "UNDERPRICED" | "AVOID",
      "form_view": "<assessment>",
      "historical_view": "<assessment>",
      "market_view": "<assessment>",
      "liquidity_view": "<assessment>",
      "reason": "<brief reason>",
      "risks": ["<risk>"]
    }
  ],
  "decision_checks": {
    "form_supports_selection": <boolean>,
    "historical_data_supports_selection": <boolean>,
    "live_market_supports_selection": <boolean>,
    "bookmaker_odds_support_selection": <boolean>,
    "betfair_price_is_value": <boolean>,
    "expected_roi_positive": <boolean>,
    "liquidity_acceptable": <boolean>,
    "price_movement_acceptable": <boolean>,
    "data_quality_acceptable": <boolean>
  },
  "recommended_app_action": {
    "place_bet": <boolean>,
    "paper_trade": <boolean>,
    "recheck_before_bet": <boolean>,
    "reason": "<brief reason>"
  },
  "warnings": ["<warning 1>", "<warning 2>"]
}

If the decision is NO_BET or WATCH, set selected_bet to an object with empty strings and zero values, but still include all the keys. The sum of all runner estimated_probability values should be approximately 1.0.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    race_decision: {
      type: 'object',
      properties: {
        decision: { type: 'string', enum: ['BET', 'NO_BET', 'WATCH'] },
        overall_confidence: { type: 'number' },
        race_risk_level: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
        summary: { type: 'string' },
        primary_no_bet_reason: { type: 'string' },
        data_quality_score: { type: 'number' }
      },
      required: ['decision', 'overall_confidence', 'race_risk_level', 'data_quality_score']
    },
    selected_bet: {
      type: 'object',
      properties: {
        runner: { type: 'string' },
        selection_id: { type: 'string' },
        estimated_probability: { type: 'number' },
        fair_odds: { type: 'number' },
        betfair_odds: { type: 'number' },
        break_even_probability: { type: 'number' },
        value_edge: { type: 'number' },
        expected_roi: { type: 'number' },
        confidence: { type: 'number' },
        minimum_acceptable_odds: { type: 'number' },
        stake_multiplier: { type: 'number' },
        reason: { type: 'string' },
        risks: { type: 'array', items: { type: 'string' } }
      }
    },
    most_likely_winner: {
      type: 'object',
      properties: {
        runner: { type: 'string' },
        selection_id: { type: 'string' },
        estimated_probability: { type: 'number' },
        fair_odds: { type: 'number' },
        confidence: { type: 'number' },
        reason: { type: 'string' }
      }
    },
    runner_assessments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          runner: { type: 'string' },
          selection_id: { type: 'string' },
          estimated_probability: { type: 'number' },
          fair_odds: { type: 'number' },
          betfair_odds: { type: 'number' },
          value_edge: { type: 'number' },
          expected_roi: { type: 'number' },
          confidence: { type: 'number' },
          rating: { type: 'string', enum: ['STRONG_VALUE', 'SMALL_VALUE', 'FAIR_PRICE', 'UNDERPRICED', 'AVOID'] },
          form_view: { type: 'string' },
          historical_view: { type: 'string' },
          market_view: { type: 'string' },
          liquidity_view: { type: 'string' },
          reason: { type: 'string' },
          risks: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    decision_checks: {
      type: 'object',
      properties: {
        form_supports_selection: { type: 'boolean' },
        historical_data_supports_selection: { type: 'boolean' },
        live_market_supports_selection: { type: 'boolean' },
        bookmaker_odds_support_selection: { type: 'boolean' },
        betfair_price_is_value: { type: 'boolean' },
        expected_roi_positive: { type: 'boolean' },
        liquidity_acceptable: { type: 'boolean' },
        price_movement_acceptable: { type: 'boolean' },
        data_quality_acceptable: { type: 'boolean' }
      }
    },
    recommended_app_action: {
      type: 'object',
      properties: {
        place_bet: { type: 'boolean' },
        paper_trade: { type: 'boolean' },
        recheck_before_bet: { type: 'boolean' },
        reason: { type: 'string' }
      }
    },
    warnings: { type: 'array', items: { type: 'string' } }
  },
  required: ['race_decision', 'selected_bet', 'most_likely_winner', 'runner_assessments', 'decision_checks', 'recommended_app_action']
};

function buildRaceObject(market, runners, settings, strategySettings) {
  const marketRunners = runners.filter(r => r.marketId === market.id || r.marketId === market.betfairMarketId);
  const startTime = market.startTime || market.marketStartTime;
  const timeBeforeJump = startTime ? Math.round((new Date(startTime).getTime() - Date.now()) / 1000) : null;
  const commissionRate = market.marketBaseRate ?? settings.defaultCommissionRate ?? 0.05;

  const runnerObjects = marketRunners
    .filter(r => r.status === 'ACTIVE')
    .map((r, idx) => {
      const betfairProb = r.bestBackPrice > 0 ? (1 / r.bestBackPrice) * 100 : 0;
      const spreadTicks = r.spreadTicks || 0;
      const appModelProb = r.modelProbability || (r.impliedProbability ? r.impliedProbability * (1 + (Math.random() - 0.5) * 0.08) : 0);
      const appFairOdds = appModelProb > 0 ? 100 / appModelProb : 0;
      const appEdge = appFairOdds > 0 && r.bestBackPrice > 0 ? ((r.bestBackPrice - appFairOdds) / appFairOdds) * 100 : 0;
      const appExpectedROI = r.bestBackPrice > 0 ? (appModelProb / 100) * (r.bestBackPrice - 1) * (1 - commissionRate) - (1 - appModelProb / 100) : 0;

      return {
        runner_name: r.runnerName,
        selection_id: String(r.betfairSelectionId || r.selectionId || ''),
        status: r.status || 'ACTIVE',
        barrier: idx + 1,
        weight: 0,
        jockey: '',
        trainer: '',
        days_since_last_run: 0,
        recent_form: '',
        last_10_starts: [],
        speed_map_position: '',
        run_style: '',
        sectional_rating: null,
        form_fair_price: null,
        form_rank: null,
        form_score: null,
        bookmaker_consensus_fair_price: null,
        bookmaker_no_vig_probability: null,
        betfair_back_price: r.bestBackPrice || 0,
        betfair_lay_price: r.bestLayPrice || 0,
        betfair_back_size: r.bestBackSize || 0,
        betfair_lay_size: r.bestLaySize || 0,
        betfair_traded_volume: r.tradedVolume || r.totalMatched || 0,
        back_lay_spread: spreadTicks,
        price_movement_5m: 'stable',
        price_movement_2m: 'stable',
        price_movement_60s: 'stable',
        market_rank: r.favouriteRank || idx + 1,
        betfair_probability: betfairProb,
        break_even_probability: betfairProb,
        app_model_probability: appModelProb,
        app_model_fair_odds: appFairOdds,
        app_expected_roi: appExpectedROI,
        app_value_edge: appEdge,
        historical_runner_summary: {
          similar_runner_sample_size: 0,
          similar_runner_win_rate: 0,
          similar_runner_roi_after_commission: 0,
          similar_runner_clv: 0,
          similar_runner_notes: 'No historical data available for this runner profile.'
        },
        runner_match_confidence: 1.0
      };
    });

  return {
    race_context: {
      app: 'Betfair Edge Lab',
      mode: 'paper_trading',
      track: market.venue || '',
      meeting_date: (startTime || '').slice(0, 10),
      race_number: market.raceNumber || 0,
      race_name: market.marketName || '',
      distance: 0,
      race_class: '',
      track_condition: '',
      weather: '',
      start_time: startTime || '',
      time_before_jump_seconds: timeBeforeJump === null ? -1 : timeBeforeJump,
      commission_rate: commissionRate,
      market_status: market.status || 'OPEN',
      in_play: market.inPlay || false,
      total_traded_volume: market.totalMatched || 0,
      active_runner_count: runnerObjects.length
    },
    strategy_settings: {
      minimum_ai_confidence: strategySettings.minConfidence || 75,
      minimum_edge: (strategySettings.minEdge || 5) / 100,
      minimum_expected_roi: (strategySettings.minExpectedROI || 3) / 100,
      minimum_liquidity: strategySettings.minLiquidity || settings.minimumLiquidity || 5000,
      min_odds: strategySettings.minOdds || 2.0,
      max_odds: strategySettings.maxOdds || 12.0,
      max_bets_per_race: 1,
      staking_mode: strategySettings.stakingMode || 'confidence_weighted_fractional_kelly',
      kelly_fraction: 0.25,
      max_stake_percent_bankroll: 0.01
    },
    historical_summary: {
      similar_setup_sample_size: 0,
      similar_setup_win_rate: 0,
      similar_setup_roi_after_commission: 0,
      similar_setup_average_odds: 0,
      similar_setup_average_bsp: 0,
      similar_setup_clv: 0,
      similar_setup_max_drawdown: 0,
      similar_setup_longest_losing_streak: 0,
      notes: 'No historical pattern data available yet.'
    },
    runners: runnerObjects
  };
}

function validateDecision(parsed, raceObject) {
  const errors = [];
  const runners = raceObject.runners || [];

  if (!parsed.race_decision) {
    errors.push('Missing race_decision object');
    return { valid: false, errors };
  }

  const decision = parsed.race_decision.decision;
  if (!['BET', 'NO_BET', 'WATCH'].includes(decision)) {
    errors.push(`Invalid decision: ${decision} (must be BET, NO_BET, or WATCH)`);
  }

  const confidence = parsed.race_decision.overall_confidence;
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 100) {
    errors.push(`Invalid overall_confidence: ${confidence} (must be 0-100)`);
  }

  const dataQuality = parsed.race_decision.data_quality_score;
  if (typeof dataQuality !== 'number' || dataQuality < 0 || dataQuality > 100) {
    errors.push(`Invalid data_quality_score: ${dataQuality} (must be 0-100)`);
  }

  if (decision === 'BET' && parsed.selected_bet) {
    const bet = parsed.selected_bet;
    if (!bet.runner || !runners.some(r => r.runner_name === bet.runner)) {
      errors.push(`Selected runner "${bet.runner}" does not exist in race`);
    }
    if (bet.selection_id && !runners.some(r => r.selection_id === String(bet.selection_id))) {
      errors.push(`Selected selection_id "${bet.selection_id}" does not match any runner`);
    }
    if (typeof bet.estimated_probability !== 'number' || bet.estimated_probability < 0 || bet.estimated_probability > 1) {
      errors.push(`Invalid estimated_probability: ${bet.estimated_probability} (must be 0-1)`);
    }
    if (typeof bet.fair_odds !== 'number' || bet.fair_odds <= 1) {
      errors.push(`Invalid fair_odds: ${bet.fair_odds} (must be > 1)`);
    }
    if (typeof bet.value_edge !== 'number') {
      errors.push('value_edge must be numeric');
    }
    if (typeof bet.expected_roi !== 'number') {
      errors.push('expected_roi must be numeric');
    }
  }

  // Check for impossible probabilities (sum > 1.5 is suspicious)
  if (parsed.runner_assessments && Array.isArray(parsed.runner_assessments)) {
    const probSum = parsed.runner_assessments.reduce((s, r) => s + (r.estimated_probability || 0), 0);
    if (probSum > 1.5) {
      errors.push(`Impossible probabilities: sum = ${probSum.toFixed(2)} (exceeds 1.5)`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function applySafetyGate(parsed, raceObject, settings, bankrollStats, strategySettings) {
  const failures = [];
  const ctx = raceObject.race_context;
  const bet = parsed.selected_bet || {};
  const raceDecision = parsed.race_decision || {};
  const runners = raceObject.runners || [];

  // 1. Decision is BET
  if (raceDecision.decision !== 'BET') {
    failures.push(`Decision is ${raceDecision.decision}, not BET`);
    return { passed: false, failures };
  }

  // 2. recommended_app_action.paper_trade is true
  if (parsed.recommended_app_action && parsed.recommended_app_action.paper_trade === false) {
    failures.push('AI recommended_app_action.paper_trade is false');
  }

  // 3. AI confidence >= minimum
  if (raceDecision.overall_confidence < (strategySettings.minConfidence || 75)) {
    failures.push(`AI confidence ${raceDecision.overall_confidence} below minimum ${strategySettings.minConfidence || 75}`);
  }

  // 4. Data quality acceptable
  if (raceDecision.data_quality_score < 50) {
    failures.push(`Data quality score ${raceDecision.data_quality_score} below 50`);
  }

  // 5. Selected runner exists
  const selectedRunner = runners.find(r => r.runner_name === bet.runner);
  if (!selectedRunner) {
    failures.push(`Selected runner "${bet.runner}" not found in race`);
    return { passed: false, failures };
  }

  // 6. Runner active
  if (selectedRunner.status !== 'ACTIVE') {
    failures.push(`Runner ${selectedRunner.runner_name} is ${selectedRunner.status}, not ACTIVE`);
  }

  // 7. Market open
  if (ctx.market_status !== 'OPEN') {
    failures.push(`Market is ${ctx.market_status}, not OPEN`);
  }

  // 8. Race not in-play
  if (ctx.in_play) {
    failures.push('Race is in-play');
  }

  // 9. Time window
  const timeBeforeJump = ctx.time_before_jump_seconds;
  const windowStart = strategySettings.timeWindowStart || settings.defaultTimeWindowStartSeconds || 300;
  const windowEnd = strategySettings.timeWindowEnd || settings.defaultTimeWindowEndSeconds || 30;
  if (timeBeforeJump < windowEnd) {
    failures.push(`Race starts in ${timeBeforeJump}s — inside ${windowEnd}s cutoff`);
  }
  if (timeBeforeJump > windowStart) {
    failures.push(`Race starts in ${timeBeforeJump}s — outside ${windowStart}s window`);
  }

  // 10. Back price exists
  if (!selectedRunner.betfair_back_price || selectedRunner.betfair_back_price <= 0) {
    failures.push('No Betfair back price available');
  }

  // 11. Back price >= minimum acceptable odds
  if (bet.minimum_acceptable_odds && selectedRunner.betfair_back_price < bet.minimum_acceptable_odds) {
    failures.push(`Back price ${selectedRunner.betfair_back_price} below minimum acceptable ${bet.minimum_acceptable_odds}`);
  }

  // 12. Back price above fair odds by minimum edge
  const minEdge = (strategySettings.minEdge || 5) / 100;
  if (bet.fair_odds && selectedRunner.betfair_back_price < bet.fair_odds * (1 + minEdge)) {
    failures.push(`Back price ${selectedRunner.betfair_back_price} not above fair odds ${bet.fair_odds} by ${minEdge * 100}% edge`);
  }

  // 13. Expected ROI positive after commission
  if (typeof bet.expected_roi === 'number' && bet.expected_roi <= 0) {
    failures.push(`Expected ROI ${bet.expected_roi} is not positive`);
  }

  // 14. Liquidity above minimum
  const minLiquidity = strategySettings.minLiquidity || settings.minimumLiquidity || 5000;
  if (ctx.total_traded_volume < minLiquidity) {
    failures.push(`Liquidity $${ctx.total_traded_volume} below minimum $${minLiquidity}`);
  }

  // 15. Spread acceptable
  if (selectedRunner.back_lay_spread > 5) {
    failures.push(`Spread ${selectedRunner.back_lay_spread} ticks too wide (max 5)`);
  }

  // 17. Runner match confidence >= 95%
  if (selectedRunner.runner_match_confidence < 0.95) {
    failures.push(`Runner match confidence ${(selectedRunner.runner_match_confidence * 100).toFixed(0)}% below 95%`);
  }

  // 18. Risk Manager returns positive stake (Kelly)
  const bankroll = bankrollStats?.bankroll || settings.paperBankroll || settings.bankroll || 10000;
  const odds = selectedRunner.betfair_back_price;
  const prob = bet.estimated_probability || 0;
  const kellyFraction = odds > 1 ? ((odds - 1) * prob - (1 - prob)) / (odds - 1) : 0;
  const kellyStake = bankroll * kellyFraction * 0.25 * (raceDecision.overall_confidence / 100);
  const maxStake = bankroll * 0.01;

  if (kellyFraction <= 0) {
    failures.push('Kelly fraction <= 0 — no positive stake');
  }

  const finalStake = Math.max(0, Math.min(kellyStake, maxStake));
  if (finalStake <= 0) {
    failures.push('Risk Manager returned zero stake');
  }

  // 19. Daily stop loss
  if (bankrollStats?.todayPL !== undefined && bankrollStats.todayPL < -(settings.dailyLossLimit || 500)) {
    failures.push('Daily stop loss reached');
  }

  // 20. Max exposure
  const currentExposure = bankrollStats?.openPaperExposure || 0;
  if (currentExposure + finalStake > (settings.maxMarketExposure || 1000)) {
    failures.push('Max market exposure breached');
  }

  return { passed: failures.length === 0, failures, stake: finalStake, kellyStake, kellyFraction };
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
    const { market, runners, settings, strategySettings, bankrollStats, action } = body;

    if (action === 'test') {
      const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
      if (!apiKey) return Response.json({ error: 'FEATHERLESS_API_KEY not set' }, { status: 500 });
      try {
        const resp = await fetch(`${FEATHERLESS_BASE_URL}/models`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10000),
        });
        return Response.json({ connected: resp.ok, status: resp.status });
      } catch (err) {
        return Response.json({ connected: false, error: err.message }, { status: 500 });
      }
    }

    if (action === 'models') {
      const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
      if (!apiKey) return Response.json({ error: 'FEATHERLESS_API_KEY not set' }, { status: 500 });
      try {
        const resp = await fetch(`${FEATHERLESS_BASE_URL}/models`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(15000),
        });
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

    if (!market) return Response.json({ error: 'market is required' }, { status: 400 });

    // ── Hard pre-check: don't call the AI if the race is outside the trading window ──
    // Saves API credits and guarantees the time-window rule is enforced even if the
    // model or safety gate has a bug.
    const _startTime = market.startTime || market.marketStartTime;
    const _windowStart = strategySettings?.timeWindowStart || settings?.defaultTimeWindowStartSeconds || 300;
    const _windowEnd = strategySettings?.timeWindowEnd || settings?.defaultTimeWindowEndSeconds || 30;
    if (!_startTime) {
      return Response.json({
        success: true,
        decision: {
          strategyName: 'Featherless AI Value Decision Engine',
          marketId: market.id || market.betfairMarketId,
          betfairMarketId: market.betfairMarketId,
          decision: 'NO_BET',
          noBetReason: `No market start time — cannot verify trading window (must be within ${_windowEnd}s–${_windowStart}s of jump)`,
          safetyGatePassed: false,
          safetyGateFailures: ['No market start time — cannot verify trading window'],
          validationStatus: 'valid',
          validationErrors: [],
        },
      });
    }
    const _timeBeforeJump = Math.round((new Date(_startTime).getTime() - Date.now()) / 1000);
    if (_timeBeforeJump > _windowStart) {
      return Response.json({
        success: true,
        decision: {
          strategyName: 'Featherless AI Value Decision Engine',
          marketId: market.id || market.betfairMarketId,
          betfairMarketId: market.betfairMarketId,
          decision: 'NO_BET',
          noBetReason: `Race starts in ${_timeBeforeJump}s — outside ${_windowStart}s trading window`,
          safetyGatePassed: false,
          safetyGateFailures: [`Race starts in ${_timeBeforeJump}s — outside ${_windowStart}s window`],
          validationStatus: 'valid',
          validationErrors: [],
        },
      });
    }

    const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
    if (!apiKey) return Response.json({ error: 'FEATHERLESS_API_KEY not set' }, { status: 500 });

    const modelName = strategySettings?.modelName || 'deepseek-ai/DeepSeek-V4-Pro';
    const temperature = strategySettings?.temperature ?? 0.1;
    const maxTokens = strategySettings?.maxTokens || 4000;
    const timeoutMs = (strategySettings?.timeoutSeconds || 10) * 1000;

    // Build race object
    const raceObject = buildRaceObject(market, runners, settings, strategySettings);

    // Build messages
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT + '\n\nRace object:\n' + JSON.stringify(raceObject, null, 2) }
    ];

    const requestStart = Date.now();

    // Call Featherless API (OpenAI-compatible)
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
        response_format: { type: 'json_object' },
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
        status: apiResp.status,
        responseTimeMs,
        raceObject,
      }, { status: 502 });
    }

    const apiData = await apiResp.json();
    const rawContent = apiData.choices?.[0]?.message?.content || '';

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      return Response.json({
        error: 'AI returned invalid JSON',
        rawResponse: rawContent.slice(0, 2000),
        raceObject,
        responseTimeMs,
      }, { status: 422 });
    }

    // Validate decision
    const validation = validateDecision(parsed, raceObject);

    // Apply safety gate
    let safetyGate = { passed: false, failures: ['Validation failed — safety gate skipped'] };
    if (validation.valid) {
      safetyGate = applySafetyGate(parsed, raceObject, settings, bankrollStats, strategySettings);
    }

    // Build decision record
    const decision = parsed.race_decision || {};
    const bet = parsed.selected_bet || {};
    const winner = parsed.most_likely_winner || {};

    const decisionRecord = {
      strategyName: 'Featherless AI Value Decision Engine',
      marketId: market.id || market.betfairMarketId,
      betfairMarketId: market.betfairMarketId,
      modelName,
      promptVersion: PROMPT_VERSION,
      decision: decision.decision || 'NO_BET',
      selectedRunner: bet.runner || '',
      selectionId: String(bet.selection_id || ''),
      estimatedProbability: bet.estimated_probability || 0,
      fairOdds: bet.fair_odds || 0,
      betfairOdds: bet.betfair_odds || 0,
      minimumAcceptableOdds: bet.minimum_acceptable_odds || 0,
      valueEdge: bet.value_edge || 0,
      expectedROI: bet.expected_roi || 0,
      confidence: decision.overall_confidence || 0,
      raceRiskLevel: decision.race_risk_level || 'MEDIUM',
      dataQualityScore: decision.data_quality_score || 0,
      mostLikelyWinner: winner.runner || '',
      mainReason: bet.reason || decision.summary || decision.primary_no_bet_reason || '',
      risks: bet.risks || [],
      warnings: parsed.warnings || [],
      runnerAssessments: parsed.runner_assessments || [],
      decisionChecks: parsed.decision_checks || {},
      validationStatus: validation.valid ? 'valid' : 'invalid',
      validationErrors: validation.errors,
      safetyGatePassed: safetyGate.passed,
      safetyGateFailures: safetyGate.failures || [],
      paperTradeCreated: false,
      recommendedStake: safetyGate.stake || 0,
      stakingMode: strategySettings?.stakingMode || 'confidence_weighted_fractional_kelly',
      responseTimeMs,
      rawResponse: rawContent.slice(0, 5000),
      raceContextJson: JSON.stringify(raceObject).slice(0, 10000),
      noBetReason: decision.primary_no_bet_reason || (safetyGate.passed ? '' : safetyGate.failures?.[0] || ''),
    };

    // Save to database
    try {
      const saved = await base44.entities.FeatherlessAIDecision.create(decisionRecord);
      decisionRecord.id = saved.id;
    } catch (_) {}

    return Response.json({
      success: true,
      decision: decisionRecord,
      raceObject,
      validation,
      safetyGate,
      rawParsed: parsed,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});