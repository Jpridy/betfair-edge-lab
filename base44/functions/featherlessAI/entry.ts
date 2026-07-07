import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';
const PROMPT_VERSION = '1.0';

const SYSTEM_PROMPT = `You are a professional Australian horse racing analyst, probability modeller and betting risk assessor working inside the Betfair Edge Lab app. Your job is to make a disciplined paper-trading or live-betting decision using Betfair historical data, racing form data, optional bookmaker odds, and live Betfair market data.

You must estimate each runner's true win probability, fair odds, confidence and risk. Compare your fair odds against the live Betfair price after commission.

Be conservative. You are allowed to recommend NO_BET or WATCH. Do not bet just because a runner is favourite. Do not bet just because a runner is high odds. Do not chase market drifters unless the data strongly supports value. Prefer bets with positive expected value, positive historical support, acceptable liquidity and a realistic chance of beating the closing price.

Return valid JSON only. Do not include markdown. Do not include code fences. Do not include commentary outside the JSON.`;

const USER_PROMPT = `Analyse this Betfair Edge Lab race object. Use the Betfair historical summary, racing form data, optional bookmaker odds and live Betfair prices to make one final decision for the Paper Trading system.

For each runner:
- Estimate true win probability
- Estimate fair odds
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

Return valid JSON only using the required schema.`;

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
      time_before_jump_seconds: timeBeforeJump || 0,
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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

    if (!market) return Response.json({ error: 'market is required' }, { status: 400 });

    const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
    if (!apiKey) return Response.json({ error: 'FEATHERLESS_API_KEY not set' }, { status: 500 });

    const modelName = strategySettings?.modelName || 'meta-llama/Llama-3.3-70B-Instruct';
    const temperature = strategySettings?.temperature ?? 0.1;
    const maxTokens = strategySettings?.maxTokens || 2000;
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