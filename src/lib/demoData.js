// Demo data for Betfair Edge Lab - realistic horse racing data
export const DEMO_MARKETS = [
  { id: 'dm1', betfairMarketId: '1.234567890', eventType: 'Horse Racing', country: 'AU', venue: 'Flemington', eventName: 'Flemington R6', marketName: 'Flemington R6 1200m', marketType: 'WIN', startTime: '2026-07-02T12:50:00Z', status: 'OPEN', inPlay: false, totalMatched: 256341, numberOfRunners: 10, watched: true },
  { id: 'dm2', betfairMarketId: '1.234567891', eventType: 'Horse Racing', country: 'AU', venue: 'Flemington', eventName: 'Flemington R7', marketName: 'Flemington R7 1400m', marketType: 'WIN', startTime: '2026-07-02T13:25:00Z', status: 'OPEN', inPlay: false, totalMatched: 198765, numberOfRunners: 9, watched: true },
  { id: 'dm3', betfairMarketId: '1.234567892', eventType: 'Horse Racing', country: 'AU', venue: 'Randwick', eventName: 'Randwick R6', marketName: 'Randwick R6 1100m', marketType: 'WIN', startTime: '2026-07-02T13:10:00Z', status: 'OPEN', inPlay: false, totalMatched: 175432, numberOfRunners: 8, watched: true },
  { id: 'dm4', betfairMarketId: '1.234567893', eventType: 'Horse Racing', country: 'AU', venue: 'Flemington', eventName: 'Flemington R5', marketName: 'Flemington R5 1600m', marketType: 'WIN', startTime: '2026-07-02T12:15:00Z', status: 'OPEN', inPlay: true, totalMatched: 312654, numberOfRunners: 11, watched: true },
  { id: 'dm5', betfairMarketId: '1.234567894', eventType: 'Horse Racing', country: 'AU', venue: 'Doomben', eventName: 'Doomben R4', marketName: 'Doomben R4 1350m', marketType: 'WIN', startTime: '2026-07-02T12:40:00Z', status: 'OPEN', inPlay: false, totalMatched: 98765, numberOfRunners: 7, watched: false },
  { id: 'dm6', betfairMarketId: '1.234567895', eventType: 'Horse Racing', country: 'AU', venue: 'Eagle Farm', eventName: 'Eagle Farm R5', marketName: 'Eagle Farm R5 1000m', marketType: 'WIN', startTime: '2026-07-02T13:00:00Z', status: 'OPEN', inPlay: false, totalMatched: 76543, numberOfRunners: 6, watched: false },
  { id: 'dm7', betfairMarketId: '1.234567896', eventType: 'Horse Racing', country: 'AU', venue: 'Flemington', eventName: 'Flemington R8', marketName: 'Flemington R8 2000m', marketType: 'WIN', startTime: '2026-07-02T14:00:00Z', status: 'OPEN', inPlay: false, totalMatched: 143210, numberOfRunners: 12, watched: true },
  { id: 'dm8', betfairMarketId: '1.234567897', eventType: 'Horse Racing', country: 'AU', venue: 'Randwick', eventName: 'Randwick R7', marketName: 'Randwick R7 1200m', marketType: 'WIN', startTime: '2026-07-02T13:45:00Z', status: 'OPEN', inPlay: false, totalMatched: 121098, numberOfRunners: 10, watched: true },
];

export const DEMO_RUNNERS = [
  { id: 'dr1', marketId: 'dm1', betfairSelectionId: '10001', runnerName: '1. Thunder Strike', status: 'ACTIVE', bestBackPrice: 3.40, bestBackSize: 1250, bestLayPrice: 3.45, bestLaySize: 890, lastTradedPrice: 3.40, tradedVolume: 45230, impliedProbability: 29.41, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'dr2', marketId: 'dm1', betfairSelectionId: '10002', runnerName: '2. Storm Chaser', status: 'ACTIVE', bestBackPrice: 4.80, bestBackSize: 670, bestLayPrice: 4.90, bestLaySize: 540, lastTradedPrice: 4.85, tradedVolume: 32100, impliedProbability: 20.83, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'dr3', marketId: 'dm1', betfairSelectionId: '10003', runnerName: '3. Bold View', status: 'ACTIVE', bestBackPrice: 6.20, bestBackSize: 450, bestLayPrice: 6.40, bestLaySize: 380, lastTradedPrice: 6.30, tradedVolume: 21500, impliedProbability: 16.13, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'dr4', marketId: 'dm1', betfairSelectionId: '10004', runnerName: '4. Midnight Run', status: 'ACTIVE', bestBackPrice: 8.00, bestBackSize: 320, bestLayPrice: 8.20, bestLaySize: 280, lastTradedPrice: 8.10, tradedVolume: 15800, impliedProbability: 12.50, favouriteRank: 4, isFavourite: false, isOutsider: false },
  { id: 'dr5', marketId: 'dm1', betfairSelectionId: '10005', runnerName: '5. Starstruck', status: 'ACTIVE', bestBackPrice: 11.00, bestBackSize: 210, bestLayPrice: 11.50, bestLaySize: 180, lastTradedPrice: 11.20, tradedVolume: 9800, impliedProbability: 9.09, favouriteRank: 5, isFavourite: false, isOutsider: true },
  { id: 'dr6', marketId: 'dm1', betfairSelectionId: '10006', runnerName: '6. Quick Shot', status: 'ACTIVE', bestBackPrice: 15.00, bestBackSize: 150, bestLayPrice: 15.50, bestLaySize: 120, lastTradedPrice: 15.20, tradedVolume: 6500, impliedProbability: 6.67, favouriteRank: 6, isFavourite: false, isOutsider: true },
  { id: 'dr7', marketId: 'dm2', betfairSelectionId: '10007', runnerName: '1. Red Defence', status: 'ACTIVE', bestBackPrice: 5.00, bestBackSize: 980, bestLayPrice: 5.10, bestLaySize: 750, lastTradedPrice: 5.05, tradedVolume: 38900, impliedProbability: 20.00, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'dr8', marketId: 'dm2', betfairSelectionId: '10008', runnerName: '2. Flying Myth', status: 'ACTIVE', bestBackPrice: 2.90, bestBackSize: 1450, bestLayPrice: 2.92, bestLaySize: 1100, lastTradedPrice: 2.90, tradedVolume: 52400, impliedProbability: 34.48, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'dr9', marketId: 'dm3', betfairSelectionId: '10009', runnerName: '1. Golden Path', status: 'ACTIVE', bestBackPrice: 6.00, bestBackSize: 560, bestLayPrice: 6.20, bestLaySize: 440, lastTradedPrice: 6.10, tradedVolume: 28700, impliedProbability: 16.67, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'dr10', marketId: 'dm4', betfairSelectionId: '10010', runnerName: '3. Fast Element', status: 'ACTIVE', bestBackPrice: 3.60, bestBackSize: 890, bestLayPrice: 3.70, bestLaySize: 720, lastTradedPrice: 3.65, tradedVolume: 41200, impliedProbability: 27.78, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'dr11', marketId: 'dm7', betfairSelectionId: '10011', runnerName: '2. Harbour Master', status: 'ACTIVE', bestBackPrice: 7.50, bestBackSize: 410, bestLayPrice: 7.80, bestLaySize: 340, lastTradedPrice: 7.60, tradedVolume: 19500, impliedProbability: 13.33, favouriteRank: 4, isFavourite: false, isOutsider: false },
];

export const DEMO_PAPER_ORDERS = [
  { id: 'do1', strategyName: 'Value Bet', marketId: 'dm1', runnerId: 'dr5', runnerName: '5. Starstruck', marketName: 'Flemington R6 1200m', side: 'BACK', orderType: 'LIMIT', requestedOdds: 3.40, matchedOdds: 3.40, requestedStake: 100, matchedStake: 100, status: 'matched', expectedValue: 18.42, result: 'won', grossProfit: 240, commission: 12, netProfit: 120, created_date: '2026-07-02T12:42:15Z' },
  { id: 'do2', strategyName: 'Fav/Outsider', marketId: 'dm2', runnerId: 'dr8', runnerName: '2. Flying Myth', marketName: 'Randwick R6 1100m', side: 'LAY', orderType: 'LIMIT', requestedOdds: 2.90, matchedOdds: 2.90, requestedStake: 80, matchedStake: 80, status: 'matched', expectedValue: 12.35, result: 'lost', grossProfit: -80, commission: 0, netProfit: -80, created_date: '2026-07-02T12:37:02Z' },
  { id: 'do3', strategyName: 'Pre-Off Scalping', marketId: 'dm3', runnerId: 'dr9', runnerName: '1. Golden Path', marketName: 'Flemington R5 1600m', side: 'BACK', orderType: 'LIMIT', requestedOdds: 6.00, matchedOdds: 6.00, requestedStake: 50, matchedStake: 50, status: 'matched', expectedValue: 6.12, result: 'won', grossProfit: 250, commission: 12.50, netProfit: 75, created_date: '2026-07-02T12:30:18Z' },
  { id: 'do4', strategyName: 'Value Bet', marketId: 'dm5', runnerId: 'dr1', runnerName: '3. Bold View', marketName: 'Doomben R4 1350m', side: 'BACK', orderType: 'LIMIT', requestedOdds: 4.20, matchedOdds: 4.20, requestedStake: 60, matchedStake: 60, status: 'matched', expectedValue: 8.75, result: 'pending', grossProfit: 0, commission: 0, netProfit: 0, created_date: '2026-07-02T12:25:47Z' },
  { id: 'do5', strategyName: 'Cross-Market', marketId: 'dm6', runnerId: 'dr6', runnerName: '6. Quick Shot', marketName: 'Eagle Farm R5 1000m', side: 'LAY', orderType: 'LIMIT', requestedOdds: 3.70, matchedOdds: 3.70, requestedStake: 70, matchedStake: 70, status: 'matched', expectedValue: 9.87, result: 'won', grossProfit: 70, commission: 3.50, netProfit: 64.40, created_date: '2026-07-02T12:20:11Z' },
];

export const DEMO_STRATEGY_SIGNALS = [
  { id: 'ds1', strategyName: 'Value Bet', marketId: 'dm1', runnerId: 'dr5', side: 'BACK', odds: 11.00, stakeSuggestion: 50, modelProbability: 0.118, impliedProbability: 0.0909, fairOdds: 8.47, edgePercent: 8.21, expectedValue: 18.42, confidence: 0.72, signalStatus: 'active', reason: 'Model probability exceeds implied' },
  { id: 'ds2', strategyName: 'Fav/Outsider', marketId: 'dm2', runnerId: 'dr7', side: 'BACK', odds: 5.00, stakeSuggestion: 80, modelProbability: 0.268, impliedProbability: 0.2, fairOdds: 3.73, edgePercent: 6.75, expectedValue: 12.35, confidence: 0.68, signalStatus: 'active', reason: 'Favourite undervalued in 2-runner' },
  { id: 'ds3', strategyName: 'Pre-Off Scalping', marketId: 'dm4', runnerId: 'dr10', side: 'BACK', odds: 3.60, stakeSuggestion: 100, modelProbability: 0.310, impliedProbability: 0.2778, fairOdds: 3.23, edgePercent: 3.15, expectedValue: 6.12, confidence: 0.61, signalStatus: 'active', reason: 'Spread tightening pre-off' },
  { id: 'ds4', strategyName: 'Cross-Market', marketId: 'dm7', runnerId: 'dr11', side: 'LAY', odds: 7.50, stakeSuggestion: 60, modelProbability: 0.188, impliedProbability: 0.1333, fairOdds: 5.32, edgePercent: 5.44, expectedValue: 9.87, confidence: 0.65, signalStatus: 'active', reason: 'External odds divergence detected' },
];

export const DEMO_PL_DATA = [
  { time: '00:00', pl: 0 }, { time: '02:00', pl: -50 }, { time: '04:00', pl: 120 },
  { time: '06:00', pl: 80 }, { time: '08:00', pl: -180 }, { time: '10:00', pl: -350 },
  { time: '12:00', pl: -120 }, { time: '14:00', pl: 45 }, { time: '16:00', pl: 180 },
  { time: '18:00', pl: 310 }, { time: '20:00', pl: 250 }, { time: '22:00', pl: 195 },
  { time: '24:00', pl: 212.45 },
];

export const DEMO_BANKROLL_STATS = {
  bankroll: 10000,
  todayPL: 212.45,
  totalPL: 1245.30,
  openExposure: 1320,
  roi: 2.12,
  strikeRate: 63.64,
  maxDrawdown: -312.50,
  longestLosingStreak: 3,
  available: 8680,
  wins: 7,
  losses: 4,
};

export const DEMO_RISK_STATUS = {
  dailyLossLimit: { status: 'ok', value: 12.45, label: 'Daily Loss Limit' },
  maxDrawdown: { status: 'ok', value: 6.25, label: 'Max Drawdown' },
  openExposure: { status: 'ok', value: 13.20, label: 'Open Exposure' },
  unmatchedOrders: { status: 'ok', value: 120, label: 'Unmatched Orders' },
  apiHealth: { status: 'ok', value: 100, label: 'API Health' },
};

export const DEMO_HEATMAP = {
  veryHigh: 6,
  high: 12,
  medium: 8,
  low: 3,
  veryLow: 1,
};

export const DEMO_BACKTEST_RUNS = [
  { id: 'bt1', name: 'Value Bet Backtest - June', strategyName: 'Value Bet', startingBankroll: 10000, endingBankroll: 11245, totalBets: 156, wins: 98, losses: 58, strikeRate: 62.82, grossProfit: 1456, netProfit: 1245, roi: 12.45, profitFactor: 1.85, maxDrawdown: -450, longestLosingStreak: 5, averageOdds: 4.2, averageStake: 85, notes: 'Strong performance on AU markets' },
  { id: 'bt2', name: 'Scalping Test - May', strategyName: 'Pre-Off Scalping', startingBankroll: 5000, endingBankroll: 5380, totalBets: 245, wins: 178, losses: 67, strikeRate: 72.65, grossProfit: 520, netProfit: 380, roi: 7.6, profitFactor: 2.12, maxDrawdown: -180, longestLosingStreak: 3, averageOdds: 2.8, averageStake: 50, notes: 'Low risk, steady returns' },
];

export const DEMO_AUDIT_LOGS = [
  { id: 'al1', action: 'App Started', category: 'system', severity: 'info', user: 'admin', details: 'Betfair Edge Lab v1.0.0 initialized in paper mode', timestamp: '2026-07-02T12:00:00Z' },
  { id: 'al2', action: 'Mode Changed', category: 'mode', severity: 'info', user: 'admin', details: 'Switched to Paper Trading mode', timestamp: '2026-07-02T12:01:15Z' },
  { id: 'al3', action: 'Paper Order Placed', category: 'order', severity: 'info', user: 'admin', details: 'BACK 5. Starstruck @ 3.40 x $100', timestamp: '2026-07-02T12:42:15Z' },
  { id: 'al4', action: 'Strategy Signal', category: 'strategy', severity: 'info', user: 'system', details: 'Value Bet signal: 5. Starstruck edge 8.21%', timestamp: '2026-07-02T12:42:00Z' },
  { id: 'al5', action: 'Risk Check Passed', category: 'risk', severity: 'info', user: 'system', details: 'All risk checks passed for order do1', timestamp: '2026-07-02T12:42:14Z' },
  { id: 'al6', action: 'Settings Updated', category: 'settings', severity: 'info', user: 'admin', details: 'Commission rate changed to 5%', timestamp: '2026-07-02T12:05:00Z' },
  { id: 'al7', action: 'API Health Check', category: 'api', severity: 'info', user: 'system', details: 'Betfair API responding normally, latency 120ms', timestamp: '2026-07-02T12:45:00Z' },
];

export const DEMO_BOT_CYCLES = [
  { id: 'bc1', cycleNumber: 42, botMode: 'paper', startedAt: '2026-07-02T12:44:50Z', finishedAt: '2026-07-02T12:44:51Z', status: 'completed', marketsScanned: 8, marketsPassedFilters: 5, signalsCreated: 1, ordersCreated: 1, ordersBlocked: 0, errors: 0, notes: 'Value Bet signal on Flemington R6' },
  { id: 'bc2', cycleNumber: 41, botMode: 'paper', startedAt: '2026-07-02T12:44:40Z', finishedAt: '2026-07-02T12:44:41Z', status: 'blocked', marketsScanned: 8, marketsPassedFilters: 5, signalsCreated: 1, ordersCreated: 0, ordersBlocked: 1, errors: 0, notes: 'Risk blocked: Odds above maximum' },
  { id: 'bc3', cycleNumber: 40, botMode: 'paper', startedAt: '2026-07-02T12:44:30Z', finishedAt: '2026-07-02T12:44:31Z', status: 'completed', marketsScanned: 8, marketsPassedFilters: 5, signalsCreated: 0, ordersCreated: 0, ordersBlocked: 0, errors: 0, notes: 'No signals generated' },
  { id: 'bc4', cycleNumber: 39, botMode: 'paper', startedAt: '2026-07-02T12:44:20Z', finishedAt: '2026-07-02T12:44:21Z', status: 'completed', marketsScanned: 8, marketsPassedFilters: 5, signalsCreated: 1, ordersCreated: 1, ordersBlocked: 0, errors: 0, notes: 'Pre-Off Scalping signal on Randwick R6' },
  { id: 'bc5', cycleNumber: 38, botMode: 'paper', startedAt: '2026-07-02T12:44:10Z', finishedAt: '2026-07-02T12:44:11Z', status: 'completed', marketsScanned: 8, marketsPassedFilters: 5, signalsCreated: 1, ordersCreated: 1, ordersBlocked: 0, errors: 0, notes: 'Fav/Outsider signal on Flemington R7' },
];

export const DEMO_STRATEGY_STATS = [
  { id: 'ss1', strategyName: 'Value Bet', totalSignals: 156, totalPaperOrders: 89, wins: 56, losses: 33, strikeRate: 62.92, grossProfit: 1456, netProfit: 1245, roi: 12.45, profitFactor: 1.85, maxDrawdown: -450, longestLosingStreak: 5, averageOdds: 4.2, averageStake: 85, averageEdge: 6.8, closingLineValue: 2.1, statusLabel: 'promising', updatedAt: '2026-07-02T12:45:00Z' },
  { id: 'ss2', strategyName: 'Pre-Off Scalping', totalSignals: 245, totalPaperOrders: 178, wins: 129, losses: 49, strikeRate: 72.47, grossProfit: 520, netProfit: 380, roi: 7.6, profitFactor: 2.12, maxDrawdown: -180, longestLosingStreak: 3, averageOdds: 2.8, averageStake: 50, averageEdge: 3.2, closingLineValue: 1.5, statusLabel: 'promising', updatedAt: '2026-07-02T12:45:00Z' },
  { id: 'ss3', strategyName: 'Fav/Outsider', totalSignals: 78, totalPaperOrders: 45, wins: 22, losses: 23, strikeRate: 48.89, grossProfit: -120, netProfit: -180, roi: -4.0, profitFactor: 0.85, maxDrawdown: -320, longestLosingStreak: 6, averageOdds: 3.5, averageStake: 70, averageEdge: 2.1, closingLineValue: -0.8, statusLabel: 'failing', updatedAt: '2026-07-02T12:45:00Z' },
  { id: 'ss4', strategyName: 'Steam/Drift', totalSignals: 34, totalPaperOrders: 12, wins: 7, losses: 5, strikeRate: 58.33, grossProfit: 85, netProfit: 62, roi: 5.2, profitFactor: 1.35, maxDrawdown: -95, longestLosingStreak: 2, averageOdds: 5.1, averageStake: 60, averageEdge: 4.5, closingLineValue: 0.5, statusLabel: 'needs_more_data', updatedAt: '2026-07-02T12:45:00Z' },
];

export const DEMO_BOT_ACTIVITY = [
  { id: 'ba1', action: 'Paper order settled', details: 'Value Bet on 5. Starstruck - WON +$228.00', timestamp: '2026-07-02T12:44:51Z' },
  { id: 'ba2', action: 'Paper order matched', details: 'BACK 5. Starstruck @ 3.40 x $100', timestamp: '2026-07-02T12:44:50Z' },
  { id: 'ba3', action: 'Paper order submitted', details: 'Value Bet signal on Flemington R6', timestamp: '2026-07-02T12:44:50Z' },
  { id: 'ba4', action: 'Signal created', details: 'Value Bet: edge 8.21%, EV $18.42', timestamp: '2026-07-02T12:44:50Z' },
  { id: 'ba5', action: 'Market scanned', details: '8 markets scanned, 5 passed filters', timestamp: '2026-07-02T12:44:50Z' },
  { id: 'ba6', action: 'Risk blocked', details: 'Odds above maximum (20.00)', timestamp: '2026-07-02T12:44:40Z' },
  { id: 'ba7', action: 'Paper order settled', details: 'Pre-Off Scalping on 1. Golden Path - WON +$237.50', timestamp: '2026-07-02T12:44:20Z' },
  { id: 'ba8', action: 'Paper order matched', details: 'BACK 1. Golden Path @ 6.00 x $50', timestamp: '2026-07-02T12:44:20Z' },
];