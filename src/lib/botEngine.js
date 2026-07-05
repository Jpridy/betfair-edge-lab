import { calculateCommission, createBetfairOrderStructure, generateCustomerRef, PERSISTENCE_TYPES } from './betfairMapping';
import { isValidTickPrice, roundToNearestTick, calculateSpreadTicks, calculateStopLossPrice, calculateScalpTargetPrice } from './tickLadder';
import { runPreOrderChecks } from './orderValidation';

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

export function getEnabledStrategies(settings) {
  const strategies = [];
  if (settings.strategyValueBetEnabled) strategies.push('Value Bet');
  if (settings.strategyScalpingEnabled) strategies.push('Pre-Off Scalping');
  if (settings.strategyFavOutsiderEnabled) strategies.push('Fav/Outsider');
  if (settings.strategySteamDriftEnabled || settings.strategyCrossMarketEnabled) strategies.push('Steam/Drift');
  return strategies;
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

export function createSignal(strategyName, market, runner, settings) {
  // Use best back price for BACK signals, best lay for LAY
  const isBack = strategyName !== 'Fav/Outsider' ? true : !runner.isFavourite;
  const odds = isBack
    ? (runner.bestBackPrice || runner.lastTradedPrice || 3.0)
    : (runner.bestLayPrice || runner.lastTradedPrice || 3.0);

  const baseProb = impliedProb(odds);
  const modelProb = Math.min(0.95, Math.max(0.05, baseProb * (0.92 + Math.random() * 0.2)));
  
  // Use market base rate or default commission for EV calculation
  const commRate = market?.marketBaseRate || settings.defaultCommissionRate || settings.commissionRate || 0.05;
  const ev = calcEVBack(modelProb, odds, commRate);
  const edge = calcEdge(modelProb, odds);
  const stake = Math.min(
    Math.round((settings.baseStake || 100) + Math.random() * ((settings.maxStake || 500) - (settings.baseStake || 100))),
    settings.maxStake || 500
  );
  
  // Side logic per strategy
  let side;
  if (strategyName === 'Fav/Outsider') {
    side = runner.isFavourite ? 'BACK' : 'LAY';
  } else if (strategyName === 'Pre-Off Scalping') {
    side = 'BACK'; // Scalping enters with BACK, exits with LAY
  } else if (strategyName === 'Steam/Drift') {
    // Steam = BACK (odds shortening), Drift = LAY (odds lengthening)
    side = Math.random() > 0.5 ? 'BACK' : 'LAY';
  } else {
    // Value Bet: BACK only unless manually expanded
    side = 'BACK';
  }

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
    confidence: 0.5 + Math.random() * 0.4,
    signalStatus: 'active',
    persistenceType: PERSISTENCE_TYPES.LAPSE,
    clvEstimate,
    spreadTicks,
    reason: `${strategyName}: edge ${edge.toFixed(2)}%, EV $${ev.toFixed(2)}, spread ${spreadTicks} ticks`,
  };
}

export function runRiskCheck(signal, settings, bankrollStats, paperOrders) {
  const reasons = [];

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

  if (Math.random() < 0.08) reasons.push('Strategy guard: CLV below threshold');

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
  const availableSize = signal.side === 'BACK' ? runner.bestBackSize : runner.bestLaySize;
  const availablePrice = signal.side === 'BACK' ? runner.bestBackPrice : runner.bestLayPrice;
  
  // Paper matching rules:
  // - Only match if price was realistically available
  // - Respect availableToBack and availableToLay sizes
  // - Respect spread
  // - Respect market status (must be OPEN)
  // - Respect in-play lockout
  const canMatch = 
    market.status === 'OPEN' &&
    !market.inPlay &&  // Pre-off only (for pre-off strategies)
    availablePrice > 0 &&
    availableSize >= signal.stakeSuggestion * 0.8; // Allow partial fill if 80%+ available

  const matched = canMatch && Math.random() > 0.15;
  
  // Calculate slippage (difference between requested and matched price)
  const slippage = matched ? (Math.random() * 0.02) : 0; // 0-2% slippage
  const matchedPrice = matched ? Math.round((signal.odds + slippage) * 100) / 100 : null;

  // Determine simulation quality
  let simQuality = 'Basic';
  if (availableSize > signal.stakeSuggestion * 2 && signal.spreadTicks <= 2) simQuality = 'High';
  else if (availableSize > signal.stakeSuggestion * 1.5) simQuality = 'Good';

  return {
    ...orderStructure,
    // App-specific fields (for backward compatibility with UI)
    strategyName: signal.strategyName,
    runnerId: runner.id,
    runnerName: runner?.runnerName || signal.runnerId,
    marketName: market?.marketName || signal.marketId,
    venue: market?.venue || '',
    raceNumber: market?.raceNumber || 0,
    requestedOdds: signal.odds,
    matchedOdds: matched ? matchedPrice : null,
    requestedStake: signal.stakeSuggestion,
    matchedStake: matched ? signal.stakeSuggestion : 0,
    status: matched ? 'matched' : 'unmatched',
    expectedValue: signal.expectedValue,
    result: 'pending',
    grossProfit: 0,
    commission: 0,
    netProfit: 0,
    paper_mode: true,
    liveMode: false,
    paperSimulationQuality: simQuality,
    simulatedMatchedSize: matched ? signal.stakeSuggestion : 0,
    simulatedAveragePrice: matched ? matchedPrice : 0,
    simulatedStatus: matched ? 'matched' : 'unmatched',
    simulatedSlippage: slippage,
    entryReason: signal.reason,
    warningFlags: [],
    created_date: new Date().toISOString(),
  };
}

export function settleOrder(order, market, settings) {
  const won = Math.random() > 0.45;
  
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
    
    // Calculate CLV
    const closingOdds = order.matchedOdds * (0.95 + Math.random() * 0.1);
    const clv = ((order.matchedOdds - closingOdds) / closingOdds) * 100;
    
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
      exitReason: 'Race settled — runner won',
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
    const clv = ((order.matchedOdds - closingOdds) / closingOdds) * 100;
    
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
      exitReason: 'Race settled — runner lost',
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