import { calcEdge, calcEVBack, impliedProb } from './botEngine';

// ─── Historical data generation ───────────────────────────────────
// Generates realistic historical horse racing markets with runners,
// odds, and probability-weighted outcomes.

const VENUES = ['Flemington', 'Randwick', 'Doomben', 'Eagle Farm', 'Caulfield', 'Moonee Valley', 'Rosehill', 'Sandown'];
const DISTANCES = ['1000m', '1100m', '1200m', '1350m', '1400m', '1600m', '1800m', '2000m', '2200m'];
const HORSE_PREFIXES = ['Thunder', 'Storm', 'Bold', 'Midnight', 'Star', 'Quick', 'Red', 'Flying', 'Golden', 'Fast', 'Harbour', 'Royal', 'Silver', 'Dark', 'Mighty', 'Lucky', 'Wild', 'Swift', 'Brave', 'Noble'];
const HORSE_SUFFIXES = ['Strike', 'Chaser', 'View', 'Run', 'struck', 'Shot', 'Defence', 'Myth', 'Path', 'Element', 'Master', 'Guard', 'Spirit', 'Knight', 'Arrow', 'Storm', 'Legend', 'Thunder', 'Glory', 'Pride'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randFloat(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(randFloat(min, max + 1)); }

function generateRunnerName(num) {
  return `${num}. ${pick(HORSE_PREFIXES)} ${pick(HORSE_SUFFIXES)}`;
}

function generateOdds(rank, totalRunners) {
  // Favourite gets lowest odds, outsiders get highest
  // Create a realistic odds distribution
  const baseOdds = 1.5 + (rank - 1) * (1.2 + Math.random() * 1.5);
  const spread = 0.02 + Math.random() * 0.08;
  const backPrice = parseFloat(baseOdds.toFixed(2));
  const layPrice = parseFloat((backPrice + spread).toFixed(2));
  return { backPrice, layPrice };
}

function generateHistoricalRace(raceNum, dateOffset) {
  const numRunners = randInt(5, 12);
  const venue = pick(VENUES);
  const distance = pick(DISTANCES);
  const startTime = new Date(Date.now() - dateOffset * 86400000 - raceNum * 3600000).toISOString();
  const totalMatched = Math.floor(randFloat(50000, 400000));
  const marketId = `hist_${raceNum}`;
  const marketName = `${venue} R${raceNum % 8 + 1} ${distance}`;

  const runners = [];
  for (let i = 0; i < numRunners; i++) {
    const rank = i + 1;
    const { backPrice, layPrice } = generateOdds(rank, numRunners);
    const tradedVolume = Math.floor(randFloat(2000, 60000) / rank);
    const lastTradedPrice = parseFloat((backPrice + randFloat(-0.05, 0.05)).toFixed(2));
    runners.push({
      id: `${marketId}_r${i}`,
      marketId,
      betfairSelectionId: String(20000 + raceNum * 100 + i),
      runnerName: generateRunnerName(i + 1),
      status: 'ACTIVE',
      bestBackPrice: backPrice,
      bestBackSize: Math.floor(randFloat(100, 2000)),
      bestLayPrice: layPrice,
      bestLaySize: Math.floor(randFloat(100, 2000)),
      lastTradedPrice,
      tradedVolume,
      impliedProbability: (1 / backPrice) * 100,
      favouriteRank: rank,
      isFavourite: rank === 1,
      isOutsider: rank >= numRunners - 1,
    });
  }

  // Determine winner based on implied probability (not random)
  const totalImplied = runners.reduce((sum, r) => sum + 1 / r.bestBackPrice, 0);
  const normalizedProbs = runners.map(r => ({
    runner: r,
    prob: (1 / r.bestBackPrice) / totalImplied,
  }));

  let rand = Math.random();
  let winner = normalizedProbs[0].runner;
  for (const np of normalizedProbs) {
    rand -= np.prob;
    if (rand <= 0) { winner = np.runner; break; }
  }

  // Closing odds (slightly different from opening — for CLV calculation)
  const closingRunners = runners.map(r => ({
    ...r,
    closingBackPrice: parseFloat((r.bestBackPrice * randFloat(0.92, 1.08)).toFixed(2)),
  }));

  return {
    id: marketId,
    betfairMarketId: `1.${1000000 + raceNum}`,
    eventType: 'Horse Racing',
    country: 'AU',
    venue,
    eventName: `${venue} R${raceNum % 8 + 1}`,
    marketName,
    marketType: 'WIN',
    startTime,
    status: 'SETTLED',
    inPlay: false,
    totalMatched,
    numberOfRunners: numRunners,
    runners: closingRunners,
    winnerId: winner.id,
    winnerName: winner.runnerName,
  };
}

export function generateHistoricalData(numRaces, daysBack = 90) {
  const races = [];
  for (let i = 0; i < numRaces; i++) {
    const dayOffset = Math.floor((i / numRaces) * daysBack);
    races.push(generateHistoricalRace(i + 1, dayOffset));
  }
  return races;
}

// ─── Strategy simulation ──────────────────────────────────────────
// Each strategy has its own signal generation logic that runs against
// historical race data. Returns null if no signal, or a signal object.

function simulateValueBetSignal(market, runner, settings) {
  const odds = runner.bestBackPrice;
  const baseProb = impliedProb(odds);
  // Model probability: historical edge — model is slightly better than market
  const modelProb = Math.min(0.95, Math.max(0.05, baseProb * randFloat(0.95, 1.12)));
  const edge = calcEdge(modelProb, odds);
  const ev = calcEVBack(modelProb, odds, settings.commissionRate || 0.05);

  // Only generate signal if edge exceeds threshold
  if (edge < 5.0) return null;

  const stake = Math.min(
    Math.round(randFloat(settings.baseStake || 100, settings.maxStake || 500)),
    settings.maxStake || 500
  );

  return {
    strategyName: 'Value Bet',
    marketId: market.id,
    runnerId: runner.id,
    side: 'BACK',
    odds,
    stakeSuggestion: stake,
    modelProbability: modelProb,
    impliedProbability: baseProb,
    edgePercent: edge,
    expectedValue: ev,
    runnerName: runner.runnerName,
  };
}

function simulateScalpingSignal(market, runner, settings) {
  const spread = runner.bestLayPrice - runner.bestBackPrice;
  // Scalping: needs tight spread
  if (spread > 0.15) return null;

  const odds = runner.bestBackPrice;
  const baseProb = impliedProb(odds);
  const modelProb = Math.min(0.95, Math.max(0.05, baseProb * randFloat(0.97, 1.08)));
  const edge = calcEdge(modelProb, odds);
  const ev = calcEVBack(modelProb, odds, settings.commissionRate || 0.05);

  if (edge < 1.5) return null;

  const stake = Math.min(
    Math.round(randFloat(settings.baseStake || 100, settings.maxStake || 500)),
    settings.maxStake || 500
  );

  return {
    strategyName: 'Pre-Off Scalping',
    marketId: market.id,
    runnerId: runner.id,
    side: 'BACK',
    odds,
    stakeSuggestion: stake,
    modelProbability: modelProb,
    impliedProbability: baseProb,
    edgePercent: edge,
    expectedValue: ev,
    runnerName: runner.runnerName,
  };
}

function simulateFavOutsiderSignal(market, runner, settings) {
  // Only for 2-3 runner markets, or when there's a clear fav/outsider dynamic
  if (market.numberOfRunners > 5 && !runner.isFavourite && !runner.isOutsider) return null;

  const isFav = runner.isFavourite;
  const odds = isFav ? runner.bestBackPrice : runner.bestLayPrice;
  const baseProb = impliedProb(odds);
  // Fav/Outsider: model favours backing favourites or laying outsiders
  const modelProb = isFav
    ? Math.min(0.95, baseProb * randFloat(1.02, 1.15))
    : Math.min(0.95, baseProb * randFloat(0.88, 0.98));
  const edge = calcEdge(modelProb, odds);
  const ev = calcEVBack(modelProb, odds, settings.commissionRate || 0.05);

  if (edge < 2.0) return null;

  const stake = Math.min(
    Math.round(randFloat(settings.baseStake || 100, settings.maxStake || 500)),
    settings.maxStake || 500
  );

  return {
    strategyName: 'Fav/Outsider',
    marketId: market.id,
    runnerId: runner.id,
    side: isFav ? 'BACK' : 'LAY',
    odds,
    stakeSuggestion: stake,
    modelProbability: modelProb,
    impliedProbability: baseProb,
    edgePercent: edge,
    expectedValue: ev,
    runnerName: runner.runnerName,
  };
}

function simulateSteamDriftSignal(market, runner, settings) {
  // Steam/Drift: detect odds movement (simulated via closing vs opening)
  const movement = (runner.closingBackPrice - runner.bestBackPrice) / runner.bestBackPrice;
  // Only signal if movement is significant (>5%)
  if (Math.abs(movement) < 0.05) return null;

  // Steam = shortening (movement < 0) → BACK; Drift = lengthening → LAY
  const isSteam = movement < 0;
  const odds = isSteam ? runner.bestBackPrice : runner.bestLayPrice;
  const baseProb = impliedProb(odds);
  const modelProb = isSteam
    ? Math.min(0.95, baseProb * randFloat(1.03, 1.12))
    : Math.min(0.95, baseProb * randFloat(0.88, 0.97));
  const edge = calcEdge(modelProb, odds);
  const ev = calcEVBack(modelProb, odds, settings.commissionRate || 0.05);

  if (edge < 3.0) return null;

  const stake = Math.min(
    Math.round(randFloat(settings.baseStake || 100, settings.maxStake || 500)),
    settings.maxStake || 500
  );

  return {
    strategyName: 'Steam/Drift',
    marketId: market.id,
    runnerId: runner.id,
    side: isSteam ? 'BACK' : 'LAY',
    odds,
    stakeSuggestion: stake,
    modelProbability: modelProb,
    impliedProbability: baseProb,
    edgePercent: edge,
    expectedValue: ev,
    runnerName: runner.runnerName,
  };
}

const STRATEGY_SIMULATORS = {
  'Value Bet': simulateValueBetSignal,
  'Pre-Off Scalping': simulateScalpingSignal,
  'Fav/Outsider': simulateFavOutsiderSignal,
  'Steam/Drift': simulateSteamDriftSignal,
};

// ─── Risk check (backtest version) ────────────────────────────────

function backtestRiskCheck(signal, settings, bankroll, openExposure, tradesToday) {
  const reasons = [];
  if (signal.odds < (settings.minOdds || 1.5)) reasons.push(`Odds below minimum (${settings.minOdds})`);
  if (signal.odds > (settings.maxOdds || 20)) reasons.push(`Odds above maximum (${settings.maxOdds})`);
  if (signal.stakeSuggestion > (settings.maxStake || 500)) reasons.push('Stake exceeds max');
  if (openExposure >= (settings.maxMarketExposure || 1000)) reasons.push('Market exposure limit reached');
  if (tradesToday >= (settings.maxTradesPerDay || 50)) reasons.push('Max trades per day reached');
  return { passed: reasons.length === 0, reasons };
}

// ─── Settlement ───────────────────────────────────────────────────

function settleBacktestOrder(signal, market, settings) {
  const isWinner = signal.runnerId === market.winnerId;
  const commissionRate = settings.commissionRate || 0.05;
  const stake = signal.stakeSuggestion;
  const odds = signal.odds;

  if (signal.side === 'BACK') {
    if (isWinner) {
      const gross = (odds - 1) * stake;
      return { result: 'won', grossProfit: gross, commission: gross * commissionRate, netProfit: gross * (1 - commissionRate) };
    } else {
      return { result: 'lost', grossProfit: -stake, commission: 0, netProfit: -stake };
    }
  } else { // LAY
    if (!isWinner) {
      const gross = stake;
      return { result: 'won', grossProfit: gross, commission: gross * commissionRate, netProfit: gross * (1 - commissionRate) };
    } else {
      const liability = (odds - 1) * stake;
      return { result: 'lost', grossProfit: -liability, commission: 0, netProfit: -liability };
    }
  }
}

// ─── Main engine ──────────────────────────────────────────────────

export function runBacktest({ strategies, numRaces, startingBankroll, settings, daysBack = 90 }) {
  const races = generateHistoricalData(numRaces, daysBack);
  const commissionRate = settings.commissionRate || 0.05;

  let bankroll = startingBankroll;
  let peakBankroll = startingBankroll;
  let maxDrawdown = 0;
  let currentLosingStreak = 0;
  let longestLosingStreak = 0;

  let wins = 0, losses = 0;
  let totalStake = 0;
  let totalGrossProfit = 0;
  let totalNetProfit = 0;
  let grossWins = 0, grossLosses = 0;
  let signalsGenerated = 0;
  let ordersBlocked = 0;
  let ordersPlaced = 0;
  let totalEdge = 0;
  let oddsSum = 0;
  let tradesToday = 0;
  let currentDay = null;

  const equityCurve = [{ idx: 0, equity: startingBankroll, race: 'Start' }];
  const trades = [];
  const blockedTrades = [];

  for (const race of races) {
    // Reset daily trade counter
    const raceDay = new Date(race.startTime).toDateString();
    if (raceDay !== currentDay) {
      currentDay = raceDay;
      tradesToday = 0;
    }

    // Run each selected strategy against this race
    for (const strategyName of strategies) {
      const simulator = STRATEGY_SIMULATORS[strategyName];
      if (!simulator) continue;

      // Try each runner (pick the best signal per strategy per race)
      let bestSignal = null;
      for (const runner of race.runners) {
        const signal = simulator(race, runner, settings);
        if (signal && (!bestSignal || signal.edgePercent > bestSignal.edgePercent)) {
          bestSignal = signal;
        }
      }

      if (!bestSignal) continue;
      signalsGenerated++;
      totalEdge += bestSignal.edgePercent;

      // Risk check
      const openExposure = trades.filter(t => t.result === 'pending').reduce((s, t) => s + t.stake, 0);
      const risk = backtestRiskCheck(bestSignal, settings, bankroll, openExposure, tradesToday);

      if (!risk.passed) {
        ordersBlocked++;
        blockedTrades.push({
          race: race.marketName,
          strategy: strategyName,
          runner: bestSignal.runnerName,
          side: bestSignal.side,
          odds: bestSignal.odds,
          stake: bestSignal.stakeSuggestion,
          edge: bestSignal.edgePercent,
          reason: risk.reasons[0],
          date: race.startTime,
        });
        continue;
      }

      // Place order
      ordersPlaced++;
      tradesToday++;
      totalStake += bestSignal.stakeSuggestion;
      oddsSum += bestSignal.odds;

      // Settle immediately (race is historical — we know the outcome)
      const settlement = settleBacktestOrder(bestSignal, race, settings);

      const trade = {
        race: race.marketName,
        venue: race.venue,
        date: race.startTime,
        strategy: strategyName,
        runner: bestSignal.runnerName,
        side: bestSignal.side,
        odds: bestSignal.odds,
        stake: bestSignal.stakeSuggestion,
        edge: bestSignal.edgePercent,
        ev: bestSignal.expectedValue,
        result: settlement.result,
        grossProfit: settlement.grossProfit,
        commission: settlement.commission,
        netProfit: settlement.netProfit,
        winner: race.winnerName,
        closingOdds: race.runners.find(r => r.id === bestSignal.runnerId)?.closingBackPrice || bestSignal.odds,
      };

      // CLV: compare entry odds to closing odds
      trade.clv = ((trade.closingOdds - trade.odds) / trade.odds) * 100;
      if (trade.side === 'LAY') trade.clv = -trade.clv;

      trades.push(trade);

      bankroll += settlement.netProfit;
      totalGrossProfit += settlement.grossProfit;
      totalNetProfit += settlement.netProfit;

      if (settlement.result === 'won') {
        wins++;
        grossWins += settlement.grossProfit;
        currentLosingStreak = 0;
      } else {
        losses++;
        grossLosses += Math.abs(settlement.grossProfit);
        currentLosingStreak++;
        if (currentLosingStreak > longestLosingStreak) longestLosingStreak = currentLosingStreak;
      }

      // Track drawdown
      if (bankroll > peakBankroll) peakBankroll = bankroll;
      const dd = bankroll - peakBankroll;
      if (dd < maxDrawdown) maxDrawdown = dd;

      equityCurve.push({
        idx: equityCurve.length,
        equity: parseFloat(bankroll.toFixed(2)),
        race: race.marketName,
      });
    }
  }

  const totalBets = wins + losses;
  const strikeRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;
  const roi = startingBankroll > 0 ? (totalNetProfit / startingBankroll) * 100 : 0;
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : (grossWins > 0 ? 99 : 0);
  const averageOdds = ordersPlaced > 0 ? oddsSum / ordersPlaced : 0;
  const averageStake = ordersPlaced > 0 ? totalStake / ordersPlaced : 0;
  const averageEdge = signalsGenerated > 0 ? totalEdge / signalsGenerated : 0;
  const avgCLV = trades.length > 0 ? trades.reduce((s, t) => s + t.clv, 0) / trades.length : 0;

  return {
    strategies: strategies.join(', '),
    startingBankroll,
    endingBankroll: parseFloat(bankroll.toFixed(2)),
    totalBets,
    wins,
    losses,
    strikeRate: parseFloat(strikeRate.toFixed(2)),
    grossProfit: parseFloat(totalGrossProfit.toFixed(2)),
    netProfit: parseFloat(totalNetProfit.toFixed(2)),
    roi: parseFloat(roi.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    longestLosingStreak,
    averageOdds: parseFloat(averageOdds.toFixed(2)),
    averageStake: parseFloat(averageStake.toFixed(2)),
    averageEdge: parseFloat(averageEdge.toFixed(2)),
    closingLineValue: parseFloat(avgCLV.toFixed(2)),
    signalsGenerated,
    ordersPlaced,
    ordersBlocked,
    numRaces,
    commissionRate,
    equityCurve,
    trades,
    blockedTrades,
  };
}

export const AVAILABLE_STRATEGIES = ['Value Bet', 'Pre-Off Scalping', 'Fav/Outsider', 'Steam/Drift'];