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
    side = Math.random() > 0.5 ? 'BACK' : 'LAY';
  } else {
    side = 'BACK';
  }

  // Use best back price for BACK signals, best lay for LAY
  const odds = side === 'BACK'
    ? (runner.bestBackPrice || runner.lastTradedPrice || 3.0)
    : (runner.bestLayPrice || runner.lastTradedPrice || 3.0);

  const baseProb = impliedProb(odds);
  // Use market microstructure analysis probability if available; otherwise fall back to implied prob adjusted
  const modelProb = formData?.estimated_probability != null
    ? Math.min(0.95, Math.max(0.05, formData.estimated_probability))
    : Math.min(0.95, Math.max(0.05, baseProb * (0.92 + Math.random() * 0.2)));
  
  // Use market base rate or default commission for EV calculation
  const commRate = market?.marketBaseRate || settings.defaultCommissionRate || settings.commissionRate || 0.05;
  const ev = side === 'BACK' ? calcEVBack(modelProb, odds, commRate) : calcEVLay(modelProb, odds, commRate);
  const edge = side === 'BACK' ? calcEdge(modelProb, odds) : calcEdgeLay(modelProb, odds);

  // EV already accounts for commission. Edge is the margin-of-safety filter.
  // Require positive EV AND edge >= strategy threshold.
  if (ev <= 0 || edge < minEdge) {
    return null;
  }

  const stake = Math.min(
    Math.round((settings.baseStake || 100) + Math.random() * ((settings.maxStake || 500) - (settings.baseStake || 100))),
    settings.maxStake || 500
  );
  
  // Calculate CLV estimate
  const clvEstimate = (Math.random() - 0.3) * 4; // -1.2% to +2.8%

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
    confidence: formData?.confidence != null ? formData.confidence / 100 : 0.5 + Math.random() * 0.4,
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

  // Simulate matching — only match if price was realistically available
  const availableSize = signal.side === 'BACK' ? (runner.bestBackSize || 0) : (runner.bestLaySize || 0);
  const availablePrice = signal.side === 'BACK' ? runner.bestBackPrice : runner.bestLayPrice;

  // Paper matching rules:
  // - Only match if price was realistically available
  // - Respect market status (must be OPEN)
  // - Respect in-play lockout (pre-off strategies)
  // In live mode, available size at best price is often thin ($2–50).
  // We match whatever is available (partial fill) rather than requiring 80%+
  // of the full stake — this mirrors real Betfair partial matching.
  const canMatch =
    market.status === 'OPEN' &&
    !market.inPlay &&
    availablePrice > 0 &&
    availableSize > 0;

  const matched = canMatch;

  // Partial fill: match the lesser of requested stake and available size.
  // Never match more than what's actually available in the order book.
  const matchedStakeAmount = matched
    ? Math.min(signal.stakeSuggestion, availableSize)
    : 0;

  // Calculate slippage (difference between requested and matched price)
  const slippage = matched ? (Math.random() * 0.02) : 0; // 0-2% slippage
  const matchedPrice = matched ? Math.round((signal.odds + slippage) * 100) / 100 : null;

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
    matchedStake: matched ? matchedStakeAmount : 0,
    status: matched ? 'matched' : 'unmatched',
    // ── Sync Betfair-style tracking fields with match result ──
    matched_size: matched ? matchedStakeAmount : 0,
    remaining_size: matched ? Math.max(0, signal.stakeSuggestion - matchedStakeAmount) : signal.stakeSuggestion,
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
    simulatedMatchedSize: matched ? matchedStakeAmount : 0,
    simulatedAveragePrice: matched ? matchedPrice : 0,
    simulatedStatus: matched ? 'matched' : 'unmatched',
    simulatedSlippage: slippage,
    entryReason: signal.reason,
    warningFlags: [],
    dataSource: signal.dataSource || 'MARKET_ONLY',
    created_date: new Date().toISOString(),
  };
}

export function settleOrder(order, market, settings, outcome = null) {
  // outcome: 'won' | 'lost' from real market results, or null for random (demo data mode)
  // outcome represents whether the HORSE won the race — NOT whether the bet won.
  // For BACK: bet wins when horse wins. For LAY: bet wins when horse loses.
  const horseWon = outcome === 'won' ? true : outcome === 'lost' ? false : Math.random() > 0.45;
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
    const closingOdds = order.matchedOdds * (0.95 + Math.random() * 0.1);
    const rawClv = ((order.matchedOdds - closingOdds) / closingOdds) * 100;
    const clv = order.side === 'LAY' ? -rawClv : rawClv;
    
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
      settled_date: new Date().toISOString(),
      matched_date: order.matched_date || order.placed_date,
      matched_size: order.matchedStake,
      remaining_size: 0,
      average_price_matched: order.matchedOdds,
      matched_price: order.matchedOdds,
      closingOdds,
      clv,
      exitReason: `Race settled — runner ${horseWon ? 'won' : 'lost'}`,
    };
  } else {
    let gross;
    if (order.side === 'BACK') {
      gross = -order.matchedStake;
    } else {
      const liability = (order.matchedOdds - 1) * order.matchedStake;
      gross = -liability;
    }
    
    const closingOdds = order.matchedOdds * (0.95 + Math.random() * 0.1);
    const rawClv = ((order.matchedOdds - closingOdds) / closingOdds) * 100;
    const clv = order.side === 'LAY' ? -rawClv : rawClv;
    
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
      settled_date: new Date().toISOString(),
      matched_date: order.matched_date || order.placed_date,
      matched_size: order.matchedStake,
      remaining_size: 0,
      average_price_matched: order.matchedOdds,
      matched_price: order.matchedOdds,
      closingOdds,
      clv,
      exitReason: `Race settled — runner ${horseWon ? 'won' : 'lost'}`,
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