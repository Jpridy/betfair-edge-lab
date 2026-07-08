import { calculateCommission, createBetfairOrderStructure, generateCustomerRef, PERSISTENCE_TYPES } from './betfairMapping';
import { isValidTickPrice, roundToNearestTick, calculateSpreadTicks, calculateStopLossPrice, calculateScalpTargetPrice, countTicksBetween } from './tickLadder';
import { runPreOrderChecks } from './orderValidation';
import { ENRICHED_STRATEGY_LIBRARY } from './strategyLibrary';
import { classifyFormData, getProbabilityLabel, getNoFormDisclaimer } from './raceFormProfile';

export const BOT_STEPS = [
  'Scan Markets',
  'Filter Markets',
  'Read Odds (Market Book)',
  'Check Strategies',
  'Create Signal',
  'Run Pre-Order Validation',
  'Run Risk Manager',
  'Submit Paper Order',
  'Track Order Status',
  'Update Bankroll',
  'Update Strategy Stats',
  'Write Audit Log',
];

export const STRATEGY_LABELS = {
  promising: { text: 'Promising', status: 'ok' },
  needs_more_data: { text: 'Needs More Data', status: 'info' },
  unstable: { text: 'Unstable', status: 'warning' },
  risky: { text: 'Risky', status: 'warning' },
  failing: { text: 'Failing', status: 'danger' },
  disabled: { text: 'Disabled', status: 'neutral' },
  archived: { text: 'Archived', status: 'neutral' },
};

export function getEnabledStrategies(settings, featherlessEnabled) {
  if (featherlessEnabled) return ['Featherless AI Value Decision Engine'];
  return [];
}

export function impliedProb(odds) {
  return 1 / odds;
}

// EV_back = modelProbability * (odds - 1) * (1 - commissionRate) - (1 - modelProbability)
export function calcEVBack(modelProb, odds, commissionRate) {
  return modelProb * (odds - 1) * (1 - commissionRate) - (1 - modelProb);
}

export function calcEdge(modelProb, odds) {
  const implied = impliedProb(odds);
  return ((modelProb - implied) / implied) * 100;
}

// Edge for LAY bets: positive when model thinks horse is LESS likely to win than market implies
export function calcEdgeLay(modelProb, odds) {
  const implied = impliedProb(odds);
  return ((implied - modelProb) / implied) * 100;
}

// EV for LAY bets: (1 - modelProb) * (1 - comm) - modelProb * (odds - 1)
export function calcEVLay(modelProb, odds, commissionRate) {
  return (1 - modelProb) * (1 - commissionRate) - modelProb * (odds - 1);
}

export function createSignal(strategyName, market, runner, settings, formData = null, raceFormProfile = null) {
  // Look up strategy config for edge threshold and side restriction
  const strategy = ENRICHED_STRATEGY_LIBRARY.find(s => s.name === strategyName);
  const minEdge = strategy?.minEdge || 0;

  // Classify form data source — MARKET_ONLY, BETFAIR_METADATA_PLUS_MARKET, or EXTERNAL_FORM_PLUS_MARKET
  const formClassification = classifyFormData(raceFormProfile);
  const dataSource = formData?.data_source || formClassification.dataSource;

  // ── Hard gate: no betting without form data ──
  // The user requires that at least Betfair metadata or external form data
  // be available before any signal is created. MARKET_ONLY (exchange prices
  // and microstructure alone) is insufficient.
  if (dataSource === 'MARKET_ONLY') {
    return null;
  }

  // Determine side first so odds match the side
  let side;
  if (strategyName === 'Fav/Outsider') {
    side = runner.isFavourite ? 'BACK' : 'LAY';
  } else if (strategyName === 'Pre-Off Scalping') {
    side = 'BACK';
  } else if (strategyName === 'Steam/Drift') {
    // Deterministic: use price movement direction (not random)
    side = (runner.priceMovementShortTerm || 0) > 0 ? 'BACK' : 'LAY';
  } else {
    side = 'BACK';
  }

  // Use best back price for BACK signals, best lay for LAY
  const odds = side === 'BACK'
    ? (runner.bestBackPrice || runner.lastTradedPrice || 3.0)
    : (runner.bestLayPrice || runner.lastTradedPrice || 3.0);

  const baseProb = impliedProb(odds);
  // Use market microstructure analysis probability if available; otherwise use implied prob (no random)
  const modelProb = formData?.estimated_probability != null
    ? Math.min(0.95, Math.max(0.05, formData.estimated_probability))
    : Math.min(0.95, Math.max(0.05, baseProb));
  
  // Use market base rate or default commission for EV calculation
  const commRate = market?.marketBaseRate || settings.defaultCommissionRate || settings.commissionRate || 0.05;
  const ev = side === 'BACK' ? calcEVBack(modelProb, odds, commRate) : calcEVLay(modelProb, odds, commRate);
  const edge = side === 'BACK' ? calcEdge(modelProb, odds) : calcEdgeLay(modelProb, odds);

  // EV already accounts for commission. Edge is the margin-of-safety filter.
  // Require positive EV AND edge >= strategy threshold.
  if (ev <= 0 || edge < minEdge) {
    return null;
  }

  const stake = settings.baseStake || 100;
  
  // CLV estimate — no random; set to 0 until real closing data available
  const clvEstimate = 0;

  // Calculate spread ticks
  const spreadTicks = calculateSpreadTicks(runner.bestBackPrice, runner.bestLayPrice);

  return {
    strategyName,
    marketId: market.id,
    betfairMarketId: market.betfairMarketId || market.id,
    selectionId: runner.betfairSelectionId || runner.selectionId,
    runnerId: runner.id,
    side,
    odds,
    stakeSuggestion: stake,
    modelProbability: modelProb,
    impliedProbability: baseProb,
    fairOdds: 1 / modelProb,
    edgePercent: edge,
    expectedValue: ev,
    confidence: formData?.confidence != null ? formData.confidence / 100 : 50,
    signalStatus: 'active',
    persistenceType: PERSISTENCE_TYPES.LAPSE,
    clvEstimate,
    spreadTicks,
    dataSource,
    probabilityLabel: getProbabilityLabel(dataSource),
    formDataStatus: formClassification.status,
    formDataCompleteness: formClassification.completeness,
    marketScore: formData?.market_score ?? null,
    metadataScore: formData?.metadata_score ?? null,
    externalFormScore: formData?.external_form_score ?? null,
    finalScore: formData?.final_score ?? null,
    reason: formData?.form_assessment
      ? `${strategyName}: ${formData.form_assessment} (edge ${edge.toFixed(2)}%, EV $${ev.toFixed(2)}, data: ${dataSource})`
      : dataSource === 'MARKET_ONLY'
        ? `${strategyName}: market-derived edge ${edge.toFixed(2)}%, EV $${ev.toFixed(2)}, spread ${spreadTicks} ticks (market microstructure only — no horse form data)`
        : `${strategyName}: edge ${edge.toFixed(2)}%, EV $${ev.toFixed(2)}, spread ${spreadTicks} ticks (data: ${dataSource})`,
  };
}

export function runRiskCheck(signal, settings, bankrollStats, paperOrders) {
  const reasons = [];

  // Master bypass: all risk limits disabled for testing
  if (settings?.riskLimitsDisabled === true) {
    return { passed: true, reasons };
  }

  if (signal.odds < (settings.minOdds || 1.5)) reasons.push(`Odds below minimum (${settings.minOdds})`);
  if (signal.odds > (settings.maxOdds || 20)) reasons.push(`Odds above maximum (${settings.maxOdds})`);
  if (signal.stakeSuggestion > (settings.maxStake || 500)) reasons.push('Stake exceeds max');
  if (bankrollStats.todayPL < -(settings.dailyLossLimit || 500)) reasons.push('Daily loss limit reached');
  if (bankrollStats.weeklyPL !== undefined && bankrollStats.weeklyPL < -(settings.weeklyLossLimit || 2500)) reasons.push('Weekly loss limit reached');

  const openOrders = paperOrders.filter(o => ['pending', 'executable', 'matched', 'partially_matched', 'unmatched'].includes(o.status));
  if (openOrders.length >= (settings.maxOpenOrders || 10)) reasons.push('Max open orders reached');

  const unmatchedOrders = paperOrders.filter(o => o.status === 'unmatched' || o.status === 'partially_matched');
  const maxUnmatched = settings.maxUnmatchedOrders || settings.maxOpenOrders || 10;
  if (unmatchedOrders.length >= maxUnmatched) reasons.push(`Max unmatched orders reached (${unmatchedOrders.length}/${maxUnmatched})`);

  const exposure = openOrders.reduce((sum, o) => sum + (o.matched_size || o.matchedStake || o.requestedStake || 0), 0);
  if (exposure >= (settings.maxMarketExposure || 1000)) reasons.push('Market exposure limit reached');

  const todayOrders = paperOrders.filter(o => {
    try { return new Date(o.created_date || o.placed_date).toDateString() === new Date().toDateString(); }
    catch { return false; }
  });
  if (todayOrders.length >= (settings.maxTradesPerDay || 50)) reasons.push('Max trades per day reached');

  return { passed: reasons.length === 0, reasons };
}

export function createPaperOrder(signal, market, runner, settings) {
  // Use the Betfair order structure — paper orders mirror live orders
  const orderStructure = createBetfairOrderStructure({
    marketId: market.betfairMarketId || market.id,
    selectionId: runner.betfairSelectionId || runner.selectionId,
    handicap: runner.handicap || 0,
    side: signal.side,
    orderType: 'LIMIT',
    size: signal.stakeSuggestion,
    price: signal.odds,
    persistenceType: signal.persistenceType || PERSISTENCE_TYPES.LAPSE,
    customerStrategyRef: 'BEL_' + signal.strategyName.toUpperCase().replace(/[^A-Z]/g, ''),
  });

  // Simulate matching — respect available size at best price
  const availableSize = signal.side === 'BACK' ? (runner.bestBackSize || 0) : (runner.bestLaySize || 0);
  const availablePrice = signal.side === 'BACK' ? runner.bestBackPrice : runner.bestLayPrice;

  // Paper matching rules:
  // - Respect market status (must be OPEN, not in-play unless allowed)
  // - Respect available size: 0 → unmatched, partial → partially_matched, full → matched
  const canMatch =
    market.status === 'OPEN' &&
    (!market.inPlay || signal.persistenceType === 'PERSIST') &&
    availablePrice > 0;

  // Determine matched/unmatched based on available size
  let matchedStakeAmount, remainingStakeAmount, orderStatus;

  if (!canMatch || availableSize <= 0) {
    matchedStakeAmount = 0;
    remainingStakeAmount = signal.stakeSuggestion;
    orderStatus = 'unmatched';
  } else if (availableSize < signal.stakeSuggestion) {
    matchedStakeAmount = availableSize;
    remainingStakeAmount = signal.stakeSuggestion - availableSize;
    orderStatus = 'partially_matched';
  } else {
    matchedStakeAmount = signal.stakeSuggestion;
    remainingStakeAmount = 0;
    orderStatus = 'matched';
  }

  const matched = matchedStakeAmount > 0;

  // Paper matching uses the exact requested price — no random slippage.
  // Slippage is only meaningful with real closing line data, which paper mode doesn't have.
  const slippage = 0;
  const matchedPrice = matched ? Math.round(signal.odds * 100) / 100 : null;

  // Determine simulation quality
  let simQuality = 'Basic';
  if (availableSize > matchedStakeAmount * 2 && signal.spreadTicks <= 2) simQuality = 'High';
  else if (availableSize > matchedStakeAmount * 1.5) simQuality = 'Good';

  return {
    ...orderStructure,
    // App-specific fields (for backward compatibility with UI)
    strategyName: signal.strategyName,
    runnerId: runner.id,
    runnerName: runner?.runnerName || 'Unknown Runner',
    horseNumber: runner?.horseNumber || runner?.sortPriority || 0,
    marketName: market?.venue ? `${market.venue} - ${market.marketName || 'Win'}` : (market?.marketName || 'Unknown Market'),
    venue: market?.venue || '',
    raceNumber: market?.raceNumber || 0,
    marketStartTime: market?.startTime || null,
    requestedOdds: signal.odds,
    matchedOdds: matched ? matchedPrice : null,
    requestedStake: signal.stakeSuggestion,
    matchedStake: matchedStakeAmount,
    status: orderStatus,
    // ── Sync Betfair-style tracking fields with match result ──
    matched_size: matchedStakeAmount,
    remaining_size: remainingStakeAmount,
    average_price_matched: matched ? matchedPrice : 0,
    matched_price: matched ? matchedPrice : null,
    requested_price: signal.odds,
    requested_size: signal.stakeSuggestion,
    size: signal.stakeSuggestion,
    price: signal.odds,
    matched_date: matched ? new Date().toISOString() : null,
    expectedValue: signal.expectedValue,
    result: 'pending',
    grossProfit: 0,
    commission: 0,
    netProfit: 0,
    paper_mode: true,
    liveMode: false,
    paperSimulationQuality: simQuality,
    simulatedMatchedSize: matchedStakeAmount,
    simulatedAveragePrice: matched ? matchedPrice : 0,
    simulatedStatus: orderStatus,
    simulatedSlippage: slippage,
    entryReason: signal.reason,
    warningFlags: [],
    dataSource: signal.dataSource || 'MARKET_ONLY',
    created_date: new Date().toISOString(),
  };
}

export function settleOrder(order, market, settings, outcome = null) {
  // outcome: 'won' | 'lost' from real market results — REQUIRED, no random fallback.
  // If outcome is null, return the order unchanged with awaiting_result status.
  if (!outcome) {
    return {
      ...order,
      status: 'awaiting_result',
      settlementStatus: 'result_unknown',
      netProfit: null,
      exitReason: 'No result provided — awaiting real market result',
      resultSource: 'missing',
      resultConfidence: 'unknown',
    };
  }
  // outcome represents whether the HORSE won the race — NOT whether the bet won.
  // For BACK: bet wins when horse wins. For LAY: bet wins when horse loses.
  const horseWon = outcome === 'won';
  const won = order.side === 'LAY' ? !horseWon : horseWon;
  
  // Calculate commission using Market Base Rate model
  const commResult = calculateCommission(
    won ? (order.side === 'BACK' ? (order.matchedOdds - 1) * order.matchedStake : order.matchedStake) : 0,
    market,
    settings
  );
  
  const commissionRate = commResult.rate;
  const commissionSource = commResult.source;

  if (won) {
    let gross, net, commission;
    if (order.side === 'BACK') {
      gross = (order.matchedOdds - 1) * order.matchedStake;
      commission = gross * commissionRate;
      net = gross - commission;
    } else {
      gross = order.matchedStake;
      commission = gross * commissionRate;
      net = gross - commission;
    }
    
    // Calculate CLV — for BACK, positive CLV means odds shortened (good).
    // For LAY, positive CLV means odds drifted (good), so invert the sign.
    // CLV: no random closingOdds — set to null if not provided by caller
    const closingOdds = null;
    const clv = 0;
    
    return {
      ...order,
      result: 'won',
      grossProfit: gross,
      commission,
      commissionRateUsed: commissionRate,
      commissionSource,
      commission_calculation_status: commResult.status,
      netProfit: net,
      status: 'settled',
      settlementStatus: 'settled',
      settled_date: new Date().toISOString(),
      settledAt: new Date().toISOString(),
      matched_date: order.matched_date || order.placed_date,
      matched_size: order.matchedStake,
      remaining_size: 0,
      average_price_matched: order.matchedOdds,
      matched_price: order.matchedOdds,
      closingOdds,
      clv,
      exitReason: `Race settled — runner ${horseWon ? 'won' : 'lost'}`,
      resultSource: 'manual',
      resultConfidence: 'confirmed',
      voided: false,
    };
  } else {
    let gross;
    if (order.side === 'BACK') {
      gross = -order.matchedStake;
    } else {
      const liability = (order.matchedOdds - 1) * order.matchedStake;
      gross = -liability;
    }
    
    // CLV: no random closingOdds
    const closingOdds = null;
    const clv = 0;
    
    return {
      ...order,
      result: 'lost',
      grossProfit: gross,
      commission: 0,
      commissionRateUsed: commissionRate,
      commissionSource,
      commission_calculation_status: commResult.status,
      netProfit: gross,
      status: 'settled',
      settlementStatus: 'settled',
      settled_date: new Date().toISOString(),
      settledAt: new Date().toISOString(),
      matched_date: order.matched_date || order.placed_date,
      matched_size: order.matchedStake,
      remaining_size: 0,
      average_price_matched: order.matchedOdds,
      matched_price: order.matchedOdds,
      closingOdds,
      clv,
      exitReason: `Race settled — runner ${horseWon ? 'won' : 'lost'}`,
      resultSource: 'manual',
      resultConfidence: 'confirmed',
      voided: false,
    };
  }
}

export function getStrategyLabel(stats) {
  if (!stats || stats.totalPaperOrders < 10) return 'needs_more_data';
  if (stats.netProfit <= 0 || stats.roi <= 0) return 'failing';
  if (stats.profitFactor < 1) return 'failing';
  if (stats.maxDrawdown < -500) return 'risky';
  if (stats.longestLosingStreak >= 5) return 'unstable';
  if (stats.closingLineValue <= 0) return 'risky';
  return 'promising';
}