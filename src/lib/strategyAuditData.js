// ============================================================================
// Extended Strategy Audit Data
// Detailed per-strategy metrics, time series, and breakdowns for the
// Strategy Audit Panel, Detail Page, and Performance Charts.
// ============================================================================

export const STRATEGY_AUDIT_DATA = {
  'Value Bet': {
    totalSignals: 312, totalPaperOrders: 89, matchedOrders: 89, unmatchedOrders: 0,
    wins: 56, losses: 33, strikeRate: 62.92,
    totalStake: 7565, totalLiability: 7565,
    grossProfit: 1456, commissionPaid: 72.80, netProfit: 1245,
    grossLoss: 783.20, roi: 16.45, liabilityRoi: 16.45, profitFactor: 1.86,
    maxDrawdown: -450, longestLosingStreak: 5,
    averageOdds: 4.20, averageStake: 85, averageEdge: 6.80, averageMatchedPrice: 4.18,
    closingPrice: 4.05, closingLineValue: 2.10, slippage: 0.05,
    averageTimeBeforeStart: 187, lastRunDate: '2026-07-02T12:44:50+10:00',
    hasDataWarnings: false, hasSettlementGap: false, commissionError: false, dataQualityError: false,
    equityCurve: [
      { week: 'W1', value: 10000 }, { week: 'W2', value: 10120 }, { week: 'W3', value: 9980 },
      { week: 'W4', value: 10240 }, { week: 'W5', value: 10380 }, { week: 'W6', value: 10560 },
      { week: 'W7', value: 10420 }, { week: 'W8', value: 10780 }, { week: 'W9', value: 10950 },
      { week: 'W10', value: 11120 }, { week: 'W11', value: 11080 }, { week: 'W12', value: 11245 },
    ],
    drawdownCurve: [
      { week: 'W1', drawdown: 0 }, { week: 'W2', drawdown: -80 }, { week: 'W3', drawdown: -210 },
      { week: 'W4', drawdown: -150 }, { week: 'W5', drawdown: -95 }, { week: 'W6', drawdown: -180 },
      { week: 'W7', drawdown: -280 }, { week: 'W8', drawdown: -200 }, { week: 'W9', drawdown: -120 },
      { week: 'W10', drawdown: -310 }, { week: 'W11', drawdown: -250 }, { week: 'W12', drawdown: -180 },
    ],
    clvHistory: [
      { week: 'W1', clv: 1.2 }, { week: 'W2', clv: 1.5 }, { week: 'W3', clv: 0.8 },
      { week: 'W4', clv: 1.8 }, { week: 'W5', clv: 2.0 }, { week: 'W6', clv: 2.3 },
      { week: 'W7', clv: 1.9 }, { week: 'W8', clv: 2.4 }, { week: 'W9', clv: 2.6 },
      { week: 'W10', clv: 2.1 }, { week: 'W11', clv: 2.3 }, { week: 'W12', clv: 2.1 },
    ],
    strikeRateHistory: [
      { week: 'W1', rate: 58 }, { week: 'W2', rate: 61 }, { week: 'W3', rate: 55 },
      { week: 'W4', rate: 64 }, { week: 'W5', rate: 63 }, { week: 'W6', rate: 66 },
      { week: 'W7', rate: 60 }, { week: 'W8', rate: 65 }, { week: 'W9', rate: 64 },
      { week: 'W10', rate: 63 }, { week: 'W11', rate: 61 }, { week: 'W12', rate: 63 },
    ],
    weeklyROI: [
      { week: 'W1', roi: 1.2 }, { week: 'W2', roi: 2.5 }, { week: 'W3', roi: -1.4 },
      { week: 'W4', roi: 3.1 }, { week: 'W5', roi: 2.8 }, { week: 'W6', roi: 3.5 },
      { week: 'W7', roi: -0.8 }, { week: 'W8', roi: 4.2 }, { week: 'W9', roi: 3.1 },
      { week: 'W10', roi: 2.6 }, { week: 'W11', roi: -0.4 }, { week: 'W12', roi: 2.1 },
    ],
    profitByMarketType: [
      { type: 'WIN', profit: 980 }, { type: 'PLACE', profit: 265 },
    ],
    profitByOddsRange: [
      { range: '1.5-3.0', profit: 320 }, { range: '3.0-5.0', profit: 580 },
      { range: '5.0-10.0', profit: 285 }, { range: '10.0-20.0', profit: 60 },
    ],
    profitByTimeWindow: [
      { window: '5-3min', profit: 180 }, { window: '3-1min', profit: 520 },
      { window: '1-0.5min', profit: 385 }, { window: '<30s', profit: 160 },
    ],
  },

  'Pre-Off Scalping': {
    totalSignals: 489, totalPaperOrders: 178, matchedOrders: 178, unmatchedOrders: 0,
    wins: 129, losses: 49, strikeRate: 72.47,
    totalStake: 8900, totalLiability: 8900,
    grossProfit: 520, commissionPaid: 26.00, netProfit: 380,
    grossLoss: 140, roi: 4.27, liabilityRoi: 4.27, profitFactor: 3.71,
    maxDrawdown: -180, longestLosingStreak: 3,
    averageOdds: 2.80, averageStake: 50, averageEdge: 3.20, averageMatchedPrice: 2.79,
    closingPrice: 2.78, closingLineValue: 1.50, slippage: 0.02,
    averageTimeBeforeStart: 142, lastRunDate: '2026-07-02T12:44:20+10:00',
    hasDataWarnings: false, hasSettlementGap: false, commissionError: false, dataQualityError: false,
    equityCurve: [
      { week: 'W1', value: 10000 }, { week: 'W2', value: 10040 }, { week: 'W3', value: 10080 },
      { week: 'W4', value: 10110 }, { week: 'W5', value: 10160 }, { week: 'W6', value: 10190 },
      { week: 'W7', value: 10240 }, { week: 'W8', value: 10270 }, { week: 'W9', value: 10310 },
      { week: 'W10', value: 10340 }, { week: 'W11', value: 10360 }, { week: 'W12', value: 10380 },
    ],
    drawdownCurve: [
      { week: 'W1', drawdown: 0 }, { week: 'W2', drawdown: -40 }, { week: 'W3', drawdown: -60 },
      { week: 'W4', drawdown: -30 }, { week: 'W5', drawdown: -80 }, { week: 'W6', drawdown: -50 },
      { week: 'W7', drawdown: -110 }, { week: 'W8', drawdown: -70 }, { week: 'W9', drawdown: -40 },
      { week: 'W10', drawdown: -90 }, { week: 'W11', drawdown: -60 }, { week: 'W12', drawdown: -30 },
    ],
    clvHistory: [
      { week: 'W1', clv: 0.8 }, { week: 'W2', clv: 1.0 }, { week: 'W3', clv: 0.9 },
      { week: 'W4', clv: 1.2 }, { week: 'W5', clv: 1.4 }, { week: 'W6', clv: 1.3 },
      { week: 'W7', clv: 1.6 }, { week: 'W8', clv: 1.5 }, { week: 'W9', clv: 1.7 },
      { week: 'W10', clv: 1.4 }, { week: 'W11', clv: 1.6 }, { week: 'W12', clv: 1.5 },
    ],
    strikeRateHistory: [
      { week: 'W1', rate: 68 }, { week: 'W2', rate: 70 }, { week: 'W3', rate: 65 },
      { week: 'W4', rate: 73 }, { week: 'W5', rate: 71 }, { week: 'W6', rate: 74 },
      { week: 'W7', rate: 69 }, { week: 'W8', rate: 75 }, { week: 'W9', rate: 72 },
      { week: 'W10', rate: 74 }, { week: 'W11', rate: 71 }, { week: 'W12', rate: 72 },
    ],
    weeklyROI: [
      { week: 'W1', roi: 0.4 }, { week: 'W2', roi: 0.8 }, { week: 'W3', roi: 0.3 },
      { week: 'W4', roi: 0.6 }, { week: 'W5', roi: 0.9 }, { week: 'W6', roi: 0.5 },
      { week: 'W7', roi: 1.1 }, { week: 'W8', roi: 0.7 }, { week: 'W9', roi: 0.9 },
      { week: 'W10', roi: 0.6 }, { week: 'W11', roi: 0.8 }, { week: 'W12', roi: 0.7 },
    ],
    profitByMarketType: [
      { type: 'WIN', profit: 280 }, { type: 'PLACE', profit: 100 },
    ],
    profitByOddsRange: [
      { range: '1.5-3.0', profit: 210 }, { range: '3.0-5.0', profit: 120 },
      { range: '5.0-10.0', profit: 50 }, { range: '10.0-20.0', profit: 0 },
    ],
    profitByTimeWindow: [
      { window: '5-3min', profit: 80 }, { window: '3-1min', profit: 180 },
      { window: '1-0.5min', profit: 95 }, { window: '<30s', profit: 25 },
    ],
  },

  'Fav/Outsider': {
    totalSignals: 156, totalPaperOrders: 45, matchedOrders: 45, unmatchedOrders: 2,
    wins: 22, losses: 23, strikeRate: 48.89,
    totalStake: 3150, totalLiability: 2800,
    grossProfit: -120, commissionPaid: 11.00, netProfit: -180,
    grossLoss: 240, roi: -5.71, liabilityRoi: -6.43, profitFactor: 0.50,
    maxDrawdown: -320, longestLosingStreak: 6,
    averageOdds: 3.50, averageStake: 70, averageEdge: 2.10, averageMatchedPrice: 3.48,
    closingPrice: 3.55, closingLineValue: -0.80, slippage: 0.03,
    averageTimeBeforeStart: 165, lastRunDate: '2026-07-02T12:44:40+10:00',
    hasDataWarnings: true, hasSettlementGap: false, commissionError: false, dataQualityError: false,
    equityCurve: [
      { week: 'W1', value: 10000 }, { week: 'W2', value: 9950 }, { week: 'W3', value: 9980 },
      { week: 'W4', value: 9900 }, { week: 'W5', value: 9850 }, { week: 'W6', value: 9880 },
      { week: 'W7', value: 9800 }, { week: 'W8', value: 9750 }, { week: 'W9', value: 9780 },
      { week: 'W10', value: 9700 }, { week: 'W11', value: 9720 }, { week: 'W12', value: 9680 },
    ],
    drawdownCurve: [
      { week: 'W1', drawdown: 0 }, { week: 'W2', drawdown: -50 }, { week: 'W3', drawdown: -120 },
      { week: 'W4', drawdown: -180 }, { week: 'W5', drawdown: -220 }, { week: 'W6', drawdown: -190 },
      { week: 'W7', drawdown: -260 }, { week: 'W8', drawdown: -300 }, { week: 'W9', drawdown: -280 },
      { week: 'W10', drawdown: -320 }, { week: 'W11', drawdown: -310 }, { week: 'W12', drawdown: -330 },
    ],
    clvHistory: [
      { week: 'W1', clv: -0.2 }, { week: 'W2', clv: -0.5 }, { week: 'W3', clv: -0.3 },
      { week: 'W4', clv: -0.8 }, { week: 'W5', clv: -0.6 }, { week: 'W6', clv: -0.9 },
      { week: 'W7', clv: -0.7 }, { week: 'W8', clv: -1.0 }, { week: 'W9', clv: -0.8 },
      { week: 'W10', clv: -1.1 }, { week: 'W11', clv: -0.9 }, { week: 'W12', clv: -0.8 },
    ],
    strikeRateHistory: [
      { week: 'W1', rate: 52 }, { week: 'W2', rate: 48 }, { week: 'W3', rate: 50 },
      { week: 'W4', rate: 45 }, { week: 'W5', rate: 47 }, { week: 'W6', rate: 46 },
      { week: 'W7', rate: 44 }, { week: 'W8', rate: 48 }, { week: 'W9', rate: 45 },
      { week: 'W10', rate: 47 }, { week: 'W11', rate: 46 }, { week: 'W12', rate: 49 },
    ],
    weeklyROI: [
      { week: 'W1', roi: -0.5 }, { week: 'W2', roi: 0.3 }, { week: 'W3', roi: -0.8 },
      { week: 'W4', roi: -1.0 }, { week: 'W5', roi: 0.2 }, { week: 'W6', roi: -0.9 },
      { week: 'W7', roi: -1.2 }, { week: 'W8', roi: 0.4 }, { week: 'W9', roi: -0.7 },
      { week: 'W10', roi: -1.1 }, { week: 'W11', roi: 0.3 }, { week: 'W12', roi: -0.8 },
    ],
    profitByMarketType: [
      { type: 'WIN', profit: -180 },
    ],
    profitByOddsRange: [
      { range: '1.5-3.0', profit: -80 }, { range: '3.0-5.0', profit: -60 },
      { range: '5.0-10.0', profit: -40 }, { range: '10.0-20.0', profit: 0 },
    ],
    profitByTimeWindow: [
      { window: '5-3min', profit: -60 }, { window: '3-1min', profit: -50 },
      { window: '1-0.5min', profit: -40 }, { window: '<30s', profit: -30 },
    ],
    // Fav/Outsider specific breakdown
    favOutsiderBreakdown: {
      favBack: { orders: 18, wins: 9, losses: 9, profit: -45 },
      favLay: { orders: 12, wins: 5, losses: 7, profit: -65 },
      outBack: { orders: 8, wins: 4, losses: 4, profit: -20 },
      outLay: { orders: 7, wins: 4, losses: 3, profit: -50 },
      twoRunner: { orders: 15, wins: 8, losses: 7, profit: -30 },
      threeRunner: { orders: 30, wins: 14, losses: 16, profit: -150 },
      byTrack: [
        { track: 'Flemington', orders: 12, profit: -80 },
        { track: 'Hawkesbury', orders: 10, profit: -40 },
        { track: 'Ballarat', orders: 8, profit: -30 },
        { track: 'Other', orders: 15, profit: -30 },
      ],
      byDayOfWeek: [
        { day: 'Mon-Wed', orders: 10, profit: -20 },
        { day: 'Thu-Fri', orders: 15, profit: -60 },
        { day: 'Sat', orders: 14, profit: -70 },
        { day: 'Sun', orders: 6, profit: -30 },
      ],
      byHour: [
        { hour: '11-12', orders: 5, profit: -10 },
        { hour: '12-14', orders: 12, profit: -50 },
        { hour: '14-16', orders: 15, profit: -70 },
        { hour: '16+', orders: 13, profit: -50 },
      ],
    },
  },

  'Steam/Drift': {
    totalSignals: 68, totalPaperOrders: 12, matchedOrders: 12, unmatchedOrders: 1,
    wins: 7, losses: 5, strikeRate: 58.33,
    totalStake: 720, totalLiability: 720,
    grossProfit: 85, commissionPaid: 4.25, netProfit: 62,
    grossLoss: 23, roi: 8.61, liabilityRoi: 8.61, profitFactor: 3.70,
    maxDrawdown: -95, longestLosingStreak: 2,
    averageOdds: 5.10, averageStake: 60, averageEdge: 4.50, averageMatchedPrice: 5.08,
    closingPrice: 5.05, closingLineValue: 0.50, slippage: 0.06,
    averageTimeBeforeStart: 210, lastRunDate: '2026-07-02T12:43:10+10:00',
    hasDataWarnings: false, hasSettlementGap: false, commissionError: false, dataQualityError: false,
    equityCurve: [
      { week: 'W1', value: 10000 }, { week: 'W2', value: 10010 }, { week: 'W3', value: 10005 },
      { week: 'W4', value: 10025 }, { week: 'W5', value: 10040 }, { week: 'W6', value: 10030 },
      { week: 'W7', value: 10050 }, { week: 'W8', value: 10060 }, { week: 'W9', value: 10055 },
      { week: 'W10', value: 10070 }, { week: 'W11', value: 10062 }, { week: 'W12', value: 10062 },
    ],
    drawdownCurve: [
      { week: 'W1', drawdown: 0 }, { week: 'W2', drawdown: -20 }, { week: 'W3', drawdown: -35 },
      { week: 'W4', drawdown: -15 }, { week: 'W5', drawdown: -40 }, { week: 'W6', drawdown: -25 },
      { week: 'W7', drawdown: -55 }, { week: 'W8', drawdown: -30 }, { week: 'W9', drawdown: -45 },
      { week: 'W10', drawdown: -20 }, { week: 'W11', drawdown: -35 }, { week: 'W12', drawdown: -15 },
    ],
    clvHistory: [
      { week: 'W1', clv: 0.2 }, { week: 'W2', clv: 0.4 }, { week: 'W3', clv: 0.3 },
      { week: 'W4', clv: 0.5 }, { week: 'W5', clv: 0.6 }, { week: 'W6', clv: 0.4 },
      { week: 'W7', clv: 0.7 }, { week: 'W8', clv: 0.5 }, { week: 'W9', clv: 0.6 },
      { week: 'W10', clv: 0.8 }, { week: 'W11', clv: 0.5 }, { week: 'W12', clv: 0.5 },
    ],
    strikeRateHistory: [
      { week: 'W1', rate: 50 }, { week: 'W2', rate: 60 }, { week: 'W3', rate: 55 },
      { week: 'W4', rate: 62 }, { week: 'W5', rate: 58 }, { week: 'W6', rate: 55 },
      { week: 'W7', rate: 60 }, { week: 'W8', rate: 58 }, { week: 'W9', rate: 62 },
      { week: 'W10', rate: 57 }, { week: 'W11', rate: 58 }, { week: 'W12', rate: 58 },
    ],
    weeklyROI: [
      { week: 'W1', roi: 0.1 }, { week: 'W2', roi: 0.3 }, { week: 'W3', roi: -0.1 },
      { week: 'W4', roi: 0.4 }, { week: 'W5', roi: 0.2 }, { week: 'W6', roi: -0.1 },
      { week: 'W7', roi: 0.5 }, { week: 'W8', roi: 0.2 }, { week: 'W9', roi: -0.1 },
      { week: 'W10', roi: 0.3 }, { week: 'W11', roi: -0.1 }, { week: 'W12', roi: 0.0 },
    ],
    profitByMarketType: [
      { type: 'WIN', profit: 62 },
    ],
    profitByOddsRange: [
      { range: '1.5-3.0', profit: 10 }, { range: '3.0-5.0', profit: 25 },
      { range: '5.0-10.0', profit: 27 }, { range: '10.0-20.0', profit: 0 },
    ],
    profitByTimeWindow: [
      { window: '5-3min', profit: 15 }, { window: '3-1min', profit: 30 },
      { window: '1-0.5min', profit: 12 }, { window: '<30s', profit: 5 },
    ],
  },

  'In-Play Front Runner': {
    totalSignals: 42, totalPaperOrders: 18, matchedOrders: 18, unmatchedOrders: 3,
    wins: 8, losses: 10, strikeRate: 44.44,
    totalStake: 1260, totalLiability: 1260,
    grossProfit: -85, commissionPaid: 4.00, netProfit: -120,
    grossLoss: 205, roi: -9.52, liabilityRoi: -9.52, profitFactor: 0.41,
    maxDrawdown: -310, longestLosingStreak: 4,
    averageOdds: 2.50, averageStake: 70, averageEdge: 4.00, averageMatchedPrice: 2.48,
    closingPrice: 2.45, closingLineValue: -1.20, slippage: 0.04,
    averageTimeBeforeStart: 0, lastRunDate: '2026-05-15T10:30:00+10:00',
    hasDataWarnings: true, hasSettlementGap: true, commissionError: false, dataQualityError: false,
    equityCurve: [
      { week: 'W1', value: 10000 }, { week: 'W2', value: 9980 }, { week: 'W3', value: 9950 },
      { week: 'W4', value: 9970 }, { week: 'W5', value: 9930 }, { week: 'W6', value: 9900 },
      { week: 'W7', value: 9920 }, { week: 'W8', value: 9890 }, { week: 'W9', value: 9870 },
      { week: 'W10', value: 9890 }, { week: 'W11', value: 9880 }, { week: 'W12', value: 9880 },
    ],
    drawdownCurve: [
      { week: 'W1', drawdown: 0 }, { week: 'W2', drawdown: -40 }, { week: 'W3', drawdown: -90 },
      { week: 'W4', drawdown: -120 }, { week: 'W5', drawdown: -180 }, { week: 'W6', drawdown: -220 },
      { week: 'W7', drawdown: -190 }, { week: 'W8', drawdown: -260 }, { week: 'W9', drawdown: -290 },
      { week: 'W10', drawdown: -250 }, { week: 'W11', drawdown: -310 }, { week: 'W12', drawdown: -280 },
    ],
    clvHistory: [
      { week: 'W1', clv: -0.3 }, { week: 'W2', clv: -0.6 }, { week: 'W3', clv: -0.4 },
      { week: 'W4', clv: -0.8 }, { week: 'W5', clv: -0.5 }, { week: 'W6', clv: -0.9 },
      { week: 'W7', clv: -0.7 }, { week: 'W8', clv: -1.0 }, { week: 'W9', clv: -0.8 },
      { week: 'W10', clv: -1.1 }, { week: 'W11', clv: -0.9 }, { week: 'W12', clv: -1.2 },
    ],
    strikeRateHistory: [
      { week: 'W1', rate: 50 }, { week: 'W2', rate: 42 }, { week: 'W3', rate: 45 },
      { week: 'W4', rate: 40 }, { week: 'W5', rate: 48 }, { week: 'W6', rate: 42 },
      { week: 'W7', rate: 46 }, { week: 'W8', rate: 40 }, { week: 'W9', rate: 44 },
      { week: 'W10', rate: 42 }, { week: 'W11', rate: 45 }, { week: 'W12', rate: 44 },
    ],
    weeklyROI: [
      { week: 'W1', roi: -0.3 }, { week: 'W2', roi: -0.5 }, { week: 'W3', roi: 0.2 },
      { week: 'W4', roi: -0.8 }, { week: 'W5', roi: -0.4 }, { week: 'W6', roi: -0.6 },
      { week: 'W7', roi: 0.1 }, { week: 'W8', roi: -0.7 }, { week: 'W9', roi: -0.3 },
      { week: 'W10', roi: 0.2 }, { week: 'W11', roi: -0.5 }, { week: 'W12', roi: 0.0 },
    ],
    profitByMarketType: [
      { type: 'WIN', profit: -120 },
    ],
    profitByOddsRange: [
      { range: '1.5-3.0', profit: -80 }, { range: '3.0-5.0', profit: -40 },
      { range: '5.0-10.0', profit: 0 }, { range: '10.0-20.0', profit: 0 },
    ],
    profitByTimeWindow: [
      { window: 'In-Play', profit: -120 },
    ],
  },

  'Cross-Market Arbitrage': {
    totalSignals: 28, totalPaperOrders: 15, matchedOrders: 15, unmatchedOrders: 2,
    wins: 11, losses: 4, strikeRate: 73.33,
    totalStake: 750, totalLiability: 750,
    grossProfit: 45, commissionPaid: 2.25, netProfit: 42,
    grossLoss: 3, roi: 5.60, liabilityRoi: 5.60, profitFactor: 15.00,
    maxDrawdown: -45, longestLosingStreak: 1,
    averageOdds: 3.00, averageStake: 50, averageEdge: 2.00, averageMatchedPrice: 2.99,
    closingPrice: 2.98, closingLineValue: 0.30, slippage: 0.01,
    averageTimeBeforeStart: 300, lastRunDate: '2026-04-20T14:00:00+10:00',
    hasDataWarnings: true, hasSettlementGap: false, commissionError: false, dataQualityError: false,
    equityCurve: [
      { week: 'W1', value: 10000 }, { week: 'W2', value: 10005 }, { week: 'W3', value: 10010 },
      { week: 'W4', value: 10015 }, { week: 'W5', value: 10020 }, { week: 'W6', value: 10022 },
      { week: 'W7', value: 10025 }, { week: 'W8', value: 10028 }, { week: 'W9', value: 10030 },
      { week: 'W10', value: 10032 }, { week: 'W11', value: 10035 }, { week: 'W12', value: 10042 },
    ],
    drawdownCurve: [
      { week: 'W1', drawdown: 0 }, { week: 'W2', drawdown: -10 }, { week: 'W3', drawdown: -5 },
      { week: 'W4', drawdown: -15 }, { week: 'W5', drawdown: -8 }, { week: 'W6', drawdown: -20 },
      { week: 'W7', drawdown: -12 }, { week: 'W8', drawdown: -25 }, { week: 'W9', drawdown: -15 },
      { week: 'W10', drawdown: -30 }, { week: 'W11', drawdown: -18 }, { week: 'W12', drawdown: -10 },
    ],
    clvHistory: [
      { week: 'W1', clv: 0.1 }, { week: 'W2', clv: 0.2 }, { week: 'W3', clv: 0.15 },
      { week: 'W4', clv: 0.25 }, { week: 'W5', clv: 0.2 }, { week: 'W6', clv: 0.3 },
      { week: 'W7', clv: 0.25 }, { week: 'W8', clv: 0.35 }, { week: 'W9', clv: 0.3 },
      { week: 'W10', clv: 0.4 }, { week: 'W11', clv: 0.35 }, { week: 'W12', clv: 0.3 },
    ],
    strikeRateHistory: [
      { week: 'W1', rate: 70 }, { week: 'W2', rate: 75 }, { week: 'W3', rate: 72 },
      { week: 'W4', rate: 74 }, { week: 'W5', rate: 71 }, { week: 'W6', rate: 76 },
      { week: 'W7', rate: 73 }, { week: 'W8', rate: 75 }, { week: 'W9', rate: 72 },
      { week: 'W10', rate: 74 }, { week: 'W11', rate: 73 }, { week: 'W12', rate: 73 },
    ],
    weeklyROI: [
      { week: 'W1', roi: 0.1 }, { week: 'W2', roi: 0.2 }, { week: 'W3', roi: 0.15 },
      { week: 'W4', roi: 0.25 }, { week: 'W5', roi: 0.2 }, { week: 'W6', roi: 0.3 },
      { week: 'W7', roi: 0.25 }, { week: 'W8', roi: 0.35 }, { week: 'W9', roi: 0.3 },
      { week: 'W10', roi: 0.4 }, { week: 'W11', roi: 0.35 }, { week: 'W12', roi: 0.3 },
    ],
    profitByMarketType: [
      { type: 'WIN', profit: 25 }, { type: 'PLACE', profit: 17 },
    ],
    profitByOddsRange: [
      { range: '1.5-3.0', profit: 20 }, { range: '3.0-5.0', profit: 15 },
      { range: '5.0-10.0', profit: 7 }, { range: '10.0-20.0', profit: 0 },
    ],
    profitByTimeWindow: [
      { window: 'Any', profit: 42 },
    ],
  },
};

export function getAuditData(strategyName) {
  return STRATEGY_AUDIT_DATA[strategyName] || null;
}