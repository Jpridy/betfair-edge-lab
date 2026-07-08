import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1';
const PROMPT_VERSION = '2.0';

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
   - Value edge = estimated_probability - implied_probability (decimal, e.g. 0.05 = 5%)
   - After commission (typically 5%), you need a small edge to break even.
   - Expected ROI = estimated_probability × (betfair_odds - 1) × (1 - commission) - (1 - estimated_probability) (decimal, e.g. 0.03 = 3%)
   - Expected ROI already accounts for commission. Only recommend BET if expected_roi is positive and above minimum_expected_roi from strategy_settings.
   - The minimum_edge and minimum_expected_roi in strategy_settings are DECIMALS (0.05 = 5%). Do NOT require more than those thresholds.
   - All value_edge and expected_roi values in your response MUST be decimals, never percentages.

3. RISK ASSESSMENT
   - LIQUIDITY RISK: The key test is whether there is sufficient size available at the target runner's best price (at least $2). Total market traded volume is a secondary signal only — early markets naturally have low volume but can still offer value. Do NOT reject solely because total traded volume is low if the runner has available size at the best price.
   - SPREAD RISK: Spreads > 5 ticks indicate uncertainty or manipulation. Avoid betting in these markets.
   - TIMING RISK: The ideal trading window is 300s-30s before the jump. Outside this window, prices are volatile and unreliable.
   - FIELD SIZE RISK: Races with > 12 runners have higher variance. Lower confidence.
   - SHORT-PRICED FAVOURITE RISK: If a dominant favourite (odds < 1.8) exists, other runners' probabilities are compressed and harder to estimate accurately.

4. PAPER DISCOVERY MODE
   - The strategy_settings include a "decision_mode" field: "strict", "balanced_paper", or "active_paper_discovery".
   - STRICT mode: NO_BET is the default. Only strong value (edge ≥ min, ROI ≥ min, confidence ≥ min) gets BET.
   - BALANCED_PAPER mode: Paper-only research. Rank every runner. If the best runner clears configured minimums, return BET. Do not force a bet.
   - ACTIVE_PAPER_DISCOVERY mode: Paper-only data collection. Lower thresholds. More bets for testing. Do not invent value — if no runner clears minimums, return NO_BET.
   - In ALL modes: do not invent value. Do not force a bet. But if the best runner clears configured minimums, return BET.
   - Always return full runner_assessments with diagnostics for every runner, regardless of decision.

5. DISCIPLINE RULES
   - In strict mode, NO_BET is the default. In paper discovery modes, BET is allowed when minimums are met.
   - Do NOT bet just because a runner is the favourite — favourites are often over-bet.
   - Do NOT bet just because odds are high — longshots are often under-bet but still lose most of the time.
   - Do NOT chase market drifters unless the new price still offers value after the move.
   - WATCH means the race is interesting but the data doesn't support a bet yet.
   - Confidence reflects the strength of your evidence, NOT your enthusiasm for the bet.

5. STAKE SIZING
   - Use fractional Kelly criterion (quarter Kelly) adjusted by confidence.
   - Kelly fraction = ((odds - 1) × probability - (1 - probability)) / (odds - 1)
   - Recommended stake = bankroll × kelly_fraction × 0.25 × (confidence / 100)
   - Cap at 1% of bankroll for any single bet.
   - If kelly_fraction ≤ 0, do not bet.

6. WEB RESEARCH CONTEXT
   - You may receive web_research data containing public race-day information gathered from web search (track conditions, scratchings, form, tips, etc.).
   - This is SUPPLEMENTARY context only. Use it to inform your probability estimates and risk assessment.
   - Do NOT bet based solely on public tips or media previews. The Betfair market is your primary signal.
   - If web research CONFLICTS with Betfair market data (e.g. market says horse is favourite but tips say it won't perform), lower your confidence by 10-20 points.
   - If web research is MISSING, unclear, or poor quality, note this as a risk and rely on market data.
   - If web research SUPPORTS the Betfair data (e.g. track suits the favourite, no scratchings, good form), you may increase confidence slightly (max +5 points).
   - Never let web tips override market-derived probability. A tipster's opinion is not worth more than thousands of dollars of matched money.

Return valid JSON only. No markdown, no code fences, no commentary outside the JSON.`;

const USER_PROMPT = `Analyse this race object and make one paper-trading decision.

Race object:
<RACE_DATA>
__RACE_JSON__
</RACE_DATA>

Return ONLY this JSON (no markdown, no commentary):
{
  "race_decision": {
    "decision": "BET" | "NO_BET" | "WATCH",
    "overall_confidence": <0-100>,
    "race_risk_level": "LOW" | "MEDIUM" | "HIGH",
    "summary": "<max 20 words>",
    "primary_no_bet_reason": "<reason if NO_BET, else empty>",
    "data_quality_score": <0-100>,
    "closest_runner": "<runner name of closest candidate if NO_BET, else empty>",
    "main_blocker": "<specific threshold that blocked the bet, e.g. 'Edge below threshold'>",
    "required_thresholds": {
      "min_confidence": <number>,
      "min_edge": <decimal>,
      "min_expected_roi": <decimal>,
      "min_liquidity": <number>
    }
  },
  "selected_bet": {
    "runner": "<runner name from race data>",
    "selection_id": "<selection_id from race data>",
    "estimated_probability": <0-1>,
    "fair_odds": <decimal >1>,
    "betfair_odds": <the back price>,
    "value_edge": <decimal, e.g. 0.05 means 5%>,
    "expected_roi": <decimal, e.g. 0.03 means 3%>,
    "minimum_acceptable_odds": <decimal >1>,
    "reason": "<max 20 words>",
    "risks": ["<risk>"]
  }
}

If NO_BET or WATCH, set selected_bet fields to empty strings and zeros. Probabilities across all runners should sum to ~1.0.

For runner_assessments, include EVERY runner with:
- runner: name
- selection_id
- odds: betfair back price
- implied_probability: 1 / odds (decimal)
- estimated_probability: your estimate (decimal)
- fair_odds: 1 / estimated_probability
- value_edge: estimated_probability - implied_probability (decimal, e.g. 0.05)
- expected_roi: estimated_probability * (odds - 1) * (1 - commission) - (1 - estimated_probability) (decimal)
- confidence: 0-100
- failed_thresholds: array of strings listing which thresholds this runner failed (empty if none)
- rating: STRONG_VALUE | SMALL_VALUE | FAIR_PRICE | UNDERPRICED | AVOID
- notes: brief assessment

If NO_BET, race_decision must include:
- closest_runner: the runner that came closest to passing all thresholds
- main_blocker: the specific threshold that blocked the bet (e.g. "Edge below threshold")
- required_thresholds: { min_confidence, min_edge, min_expected_roi, min_liquidity }

value_edge and expected_roi are ALWAYS decimals (0.05 = 5%), never percentages.

If web_research data is included in the race object, also return:
{
  "web_research_assessment": {
    "assessment": "supports" | "conflicts" | "neutral" | "missing",
    "key_findings": "<max 30 words summarising what the web research says>",
    "impact_on_confidence": <number, -10 to +5>,
    "supports_betfair_data": <boolean>,
    "conflicts_with_betfair_data": <boolean>
  }
}

If no web_research data is provided, set assessment to "missing" and all other fields to defaults.`;

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
        data_quality_score: { type: 'number' },
        closest_runner: { type: 'string' },
        main_blocker: { type: 'string' },
        required_thresholds: { type: 'object' }
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
          implied_probability: { type: 'number' },
          estimated_probability: { type: 'number' },
          fair_odds: { type: 'number' },
          failed_thresholds: { type: 'array', items: { type: 'string' } },
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
    warnings: { type: 'array', items: { type: 'string' } },
    web_research_assessment: {
      type: 'object',
      properties: {
        assessment: { type: 'string', enum: ['supports', 'conflicts', 'neutral', 'missing'] },
        key_findings: { type: 'string' },
        impact_on_confidence: { type: 'number' },
        supports_betfair_data: { type: 'boolean' },
        conflicts_with_betfair_data: { type: 'boolean' }
      }
    }
  },
  required: ['race_decision', 'selected_bet', 'most_likely_winner', 'runner_assessments', 'decision_checks', 'recommended_app_action']
};

function buildRaceObject(market, runners, settings, strategySettings, raceFormProfiles, webResearch) {
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
        runner_match_confidence: 1.0,
        betfair_metadata: formProfile ? {
          age: formProfile.age ?? null,
          sex: formProfile.sex ?? null,
          jockey_name: formProfile.jockeyName ?? null,
          trainer_name: formProfile.trainerName ?? null,
          stall_draw: formProfile.stallDraw ?? null,
          weight_value: formProfile.weightValue ?? null,
          official_rating: formProfile.officialRating ?? null,
          adjusted_rating: formProfile.adjustedRating ?? null,
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
      active_runner_count: runnerObjects.length
    },
    strategy_settings: {
      decision_mode: strategySettings?.aiDecisionMode || 'strict',
      require_external_form_data: strategySettings?.requireExternalFormData || false,
      minimum_ai_confidence: strategySettings?.minConfidence || 75,
      minimum_edge: (strategySettings?.minEdge || 5) / 100,
      minimum_expected_roi: (strategySettings?.minExpectedROI || 3) / 100,
      minimum_liquidity: strategySettings?.minLiquidity || settings?.minimumLiquidity || 500,
      min_odds: strategySettings?.minOdds || 2.0,
      max_odds: strategySettings?.maxOdds || 12.0,
      max_spread: strategySettings?.maxSpread || 5,
      kelly_fraction: 0.25,
      max_stake_percent_bankroll: 0.01
    },
    runners: runnerObjects,
    web_research: webResearch || null
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

  // 2. AI confidence >= minimum
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
  const windowStart = strategySettings.timeWindowStart || settings.defaultTimeWindowStartSeconds || 500;
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
  // (expected_roi already accounts for commission — checked separately in step 13)
  const minEdge = (strategySettings.minEdge || 5) / 100;
  if (bet.fair_odds && selectedRunner.betfair_back_price < bet.fair_odds * (1 + minEdge)) {
    failures.push(`Back price ${selectedRunner.betfair_back_price} not above fair odds ${bet.fair_odds} by ${minEdge * 100}% edge`);
  }

  // 13. Expected ROI positive after commission
  if (typeof bet.expected_roi === 'number' && bet.expected_roi <= 0) {
    failures.push(`Expected ROI ${bet.expected_roi} is not positive`);
  }

  // 14. Liquidity — runner-level depth at target price only
  // Market total traded volume is not a reliable gate for early AU racing markets.
  const runnerBackSize = selectedRunner.betfair_back_size || 0;
  if (runnerBackSize < 2) {
    failures.push(`Runner back size $${runnerBackSize} too thin at best price`);
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
    const body = await req.json();
    const { market, runners, settings, strategySettings, bankrollStats, action, raceFormProfiles, webResearch } = body;

    // Connection test and model listing don't need user auth — they only
    // validate the server-side FEATHERLESS_API_KEY.
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

    // ── Hard pre-check: don't call the AI if the race is outside the trading window ──
    // Saves API credits and guarantees the time-window rule is enforced even if the
    // model or safety gate has a bug.
    const _startTime = market.startTime || market.marketStartTime;
    const _windowStart = strategySettings?.timeWindowStart || settings?.defaultTimeWindowStartSeconds || 500;
    const _windowEnd = strategySettings?.timeWindowEnd || settings?.defaultTimeWindowEndSeconds || 30;
    if (!_startTime) {
      const preCheckDecision = {
          strategyName: 'Featherless AI Value Decision Engine',
          marketId: market.id || market.betfairMarketId,
          betfairMarketId: market.betfairMarketId,
          decision: 'NO_BET',
          noBetReason: `No market start time — cannot verify trading window (must be within ${_windowEnd}s–${_windowStart}s of jump)`,
          safetyGatePassed: false,
          safetyGateFailures: ['No market start time — cannot verify trading window'],
          validationStatus: 'valid',
          validationErrors: [],
          closestRunner: '',
          mainBlocker: 'No market start time — cannot verify trading window',
      };
      try { await base44.entities.FeatherlessAIDecision.create(preCheckDecision); } catch (_) {}
      return Response.json({ success: true, decision: preCheckDecision });
    }
    const _timeBeforeJump = Math.round((new Date(_startTime).getTime() - Date.now()) / 1000);
    if (_timeBeforeJump > _windowStart) {
      const preCheckDecision = {
          strategyName: 'Featherless AI Value Decision Engine',
          marketId: market.id || market.betfairMarketId,
          betfairMarketId: market.betfairMarketId,
          decision: 'NO_BET',
          noBetReason: `Race starts in ${_timeBeforeJump}s — outside ${_windowStart}s trading window`,
          safetyGatePassed: false,
          safetyGateFailures: [`Race starts in ${_timeBeforeJump}s — outside ${_windowStart}s window`],
          validationStatus: 'valid',
          validationErrors: [],
          closestRunner: '',
          mainBlocker: `Race outside trading window (${_timeBeforeJump}s before jump, max ${_windowStart}s)`,
      };
      try { await base44.entities.FeatherlessAIDecision.create(preCheckDecision); } catch (_) {}
      return Response.json({ success: true, decision: preCheckDecision });
    }

    const apiKey = Deno.env.get('FEATHERLESS_API_KEY');
    if (!apiKey) return Response.json({ error: 'FEATHERLESS_API_KEY not set' }, { status: 500 });

    const modelName = strategySettings?.modelName || 'deepseek-ai/DeepSeek-V4-Flash';
    const temperature = strategySettings?.temperature ?? 0.1;
    const maxTokens = strategySettings?.maxTokens || 2000;
    const timeoutMs = (strategySettings?.timeoutSeconds || 90) * 1000;

    // Build race object — pass raceFormProfiles so the AI can use Betfair metadata when available
    const hasFormProfiles = raceFormProfiles && raceFormProfiles.length > 0;
    const hasWebResearch = webResearch && webResearch.research_summary;
    const dataSource = hasFormProfiles
      ? (raceFormProfiles.some(fp => fp.externalFormData) ? 'EXTERNAL_FORM_PLUS_MARKET' : 'BETFAIR_METADATA_PLUS_MARKET')
      : hasWebResearch ? 'EXTERNAL_FORM_PLUS_MARKET' : 'MARKET_ONLY';
    const raceObject = buildRaceObject(market, runners, settings, strategySettings, raceFormProfiles, webResearch);

    // Build messages
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT.replace('__RACE_JSON__', JSON.stringify(raceObject)) }
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
    let rawContent = apiData.choices?.[0]?.message?.content || '';

    // Strip DeepSeek-V4 reasoning blocks
    rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Normalize: if content starts with a quoted key, prepend opening brace
    if (rawContent.startsWith('"')) {
      rawContent = '{' + rawContent;
    }

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (_) {
      // Try to recover: close unmatched brackets
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
          rawResponse: rawContent.slice(0, 2000),
          raceObject,
          responseTimeMs,
        }, { status: 422 });
      }
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
      mostLikelyWinner: parsed.most_likely_winner?.runner || bet.runner || '',
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
      dataSource,
      closestRunner: decision.closest_runner || '',
      mainBlocker: decision.main_blocker || decision.primary_no_bet_reason || '',
      requiredThresholds: decision.required_thresholds || null,
      runnerDiagnostics: parsed.runner_assessments || [],
      webResearchSummary: webResearch?.research_summary || null,
      webResearchSourceLinks: webResearch?.source_links || [],
      webResearchAssessment: parsed.web_research_assessment?.assessment || (webResearch ? 'neutral' : 'missing'),
      webResearchDataQuality: webResearch?.data_quality || null,
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