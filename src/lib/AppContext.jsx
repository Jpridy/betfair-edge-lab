import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { DEMO_MARKETS, DEMO_RUNNERS, DEMO_PAPER_ORDERS, DEMO_STRATEGY_SIGNALS, DEMO_BANKROLL_STATS, DEMO_RISK_STATUS, DEMO_HEATMAP, DEMO_AUDIT_LOGS, DEMO_BACKTEST_RUNS, DEMO_PL_DATA, DEMO_BOT_CYCLES, DEMO_STRATEGY_STATS, DEMO_BOT_ACTIVITY } from '@/lib/demoData';
import { BOT_STEPS, getEnabledStrategies, createSignal, runRiskCheck, createPaperOrder, settleOrder } from '@/lib/botEngine';

const AppContext = createContext(null);

const DEFAULT_BOT_SETTINGS = {
  scanIntervalSeconds: 10,
  selectedStrategies: ['Value Bet', 'Pre-Off Scalping', 'Fav/Outsider', 'Steam/Drift'],
  autoPaperTradingEnabled: true,
  liveTradingLocked: true,
  liveTradingEnabled: false,
  requireLiveConfirmationText: true,
  confirmationText: 'ENABLE LIVE TRADING',
  maxBotCyclesPerHour: 60,
  stopOnApiError: true,
  stopOnDailyLoss: true,
  stopOnMaxDrawdown: true,
  stopOnLosingStreak: true,
  stopOnEmergency: true,
};

export function AppProvider({ children }) {
  const [mode, setMode] = useState('research');
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
  const [betfairAccount, setBetfairAccount] = useState(null);
  const [jurisdiction, setJurisdiction] = useState('AU');
  const [notifications, setNotifications] = useState(3);
  const [settings, setSettings] = useState({
    commissionRate: 0.05,
    bankroll: 10000,
    baseStake: 100,
    maxStake: 500,
    maxStakePercent: 5,
    dailyLossLimit: 500,
    maxMarketExposure: 1000,
    maxOpenOrders: 10,
    maxTradesPerMarket: 5,
    maxTradesPerDay: 50,
    minimumLiquidity: 5000,
    minimumTradedVolume: 10000,
    minOdds: 1.5,
    maxOdds: 20,
    defaultTimeWindowStartSeconds: 300,
    defaultTimeWindowEndSeconds: 30,
    allowInPlay: false,
    apiPollingInterval: 5,
    strategyValueBetEnabled: true,
    strategyScalpingEnabled: true,
    strategyFavOutsiderEnabled: true,
    strategyCrossMarketEnabled: true,
    favouriteSideEnabled: true,
    outsiderSideEnabled: true,
  });

  const [markets, setMarkets] = useState(DEMO_MARKETS);
  const [runners, setRunners] = useState(DEMO_RUNNERS);
  const [paperOrders, setPaperOrders] = useState(DEMO_PAPER_ORDERS);
  const [strategySignals, setStrategySignals] = useState(DEMO_STRATEGY_SIGNALS);
  const [bankrollStats, setBankrollStats] = useState(DEMO_BANKROLL_STATS);
  const [riskStatus] = useState(DEMO_RISK_STATUS);
  const [heatmap] = useState(DEMO_HEATMAP);
  const [auditLogs, setAuditLogs] = useState(DEMO_AUDIT_LOGS);
  const [backtestRuns, setBacktestRuns] = useState(DEMO_BACKTEST_RUNS);
  const [plData] = useState(DEMO_PL_DATA);

  // Bot state
  const [botState, setBotState] = useState({
    running: false,
    paused: false,
    cycleNumber: 0,
    lastCycleTime: null,
    nextScanCountdown: 10,
    stepStatuses: BOT_STEPS.map(name => ({ name, status: 'waiting' })),
    signalsToday: 0,
    ordersToday: 0,
    ordersBlockedToday: 0,
    botPLToday: 0,
  });
  const [botSettings, setBotSettings] = useState(DEFAULT_BOT_SETTINGS);
  const [botCycles, setBotCycles] = useState(DEMO_BOT_CYCLES);
  const [strategyStats, setStrategyStats] = useState(DEMO_STRATEGY_STATS);
  const [botActivity, setBotActivity] = useState(DEMO_BOT_ACTIVITY);

  // Ref for latest state (avoids stale closures in interval)
  const stateRef = useRef({});
  stateRef.current = { markets, runners, settings, paperOrders, bankrollStats, botSettings, mode, emergencyStop, botState, strategyStats };

  const addAuditLog = (action, category, severity, details) => {
    const log = {
      id: 'al' + Date.now() + Math.random().toString(36).slice(2, 6),
      action,
      category,
      severity,
      user: category === 'system' || category === 'strategy' || category === 'risk' ? 'bot' : 'admin',
      details,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs(prev => [log, ...prev].slice(0, 500));
  };

  const addToBotActivity = (action, details) => {
    const entry = {
      id: 'ba' + Date.now() + Math.random().toString(36).slice(2, 6),
      action,
      details,
      timestamp: new Date().toISOString(),
    };
    setBotActivity(prev => [entry, ...prev].slice(0, 50));
  };

  const triggerEmergencyStop = () => {
    setEmergencyStop(true);
    setMode('research');
    setBotState(prev => ({ ...prev, running: false, paused: false }));
    setPaperOrders(prev => prev.map(o =>
      ['submitted', 'matched', 'partially_matched'].includes(o.status)
        ? { ...o, status: 'cancelled' }
        : o
    ));
    addAuditLog('Emergency Stop Activated', 'emergency', 'critical', 'Emergency stop triggered. Bot stopped. Live mode disabled. Open paper orders cancelled.');
    addToBotActivity('Emergency stop activated', 'All bot activity halted, open orders cancelled');
    setNotifications(prev => prev + 1);
  };

  const clearEmergencyStop = () => {
    setEmergencyStop(false);
    addAuditLog('Emergency Stop Cleared', 'emergency', 'info', 'Emergency stop cleared. App returned to research mode.');
    addToBotActivity('Emergency stop cleared', 'System returned to research mode');
  };

  const changeMode = (newMode) => {
    if (newMode === 'live_locked') return;
    if (emergencyStop) return;
    setMode(newMode);
    const label = newMode === 'research' ? 'Research' : 'Paper Bot';
    addAuditLog('Mode Changed', 'mode', 'info', `Switched to ${label} mode`);
  };

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    addAuditLog('Settings Updated', 'settings', 'info', 'App settings updated');
  };

  const updateBotSettings = (newSettings) => {
    setBotSettings(newSettings);
    addAuditLog('Bot Settings Updated', 'settings', 'info', 'Bot configuration updated');
  };

  const startBot = () => {
    if (emergencyStop) return;
    setMode('paper');
    setBotState(prev => ({ ...prev, running: true, paused: false, nextScanCountdown: 1 }));
    addAuditLog('Paper Bot Started', 'mode', 'info', 'Bot started in Paper Bot mode. Auto scanning, signal detection, and paper order creation enabled.');
    addToBotActivity('Bot started', 'Paper Bot mode activated');
  };

  const pauseBot = () => {
    setBotState(prev => ({ ...prev, paused: true }));
    addAuditLog('Bot Paused', 'mode', 'warning', 'Bot paused. No new paper orders will be created. Markets still being scanned.');
    addToBotActivity('Bot paused', 'New order creation suspended');
  };

  const stopBot = () => {
    setBotState(prev => ({ ...prev, running: false, paused: false, nextScanCountdown: 0 }));
    addAuditLog('Bot Stopped', 'mode', 'warning', 'Bot stopped. All scanning, signal generation, and order creation halted.');
    addToBotActivity('Bot stopped', 'All bot activity halted');
  };

  const addPaperOrder = (order) => {
    const newOrder = {
      ...order,
      id: 'po' + Date.now() + Math.random().toString(36).slice(2, 6),
      created_date: new Date().toISOString(),
    };
    setPaperOrders(prev => [newOrder, ...prev].slice(0, 200));
    addAuditLog('Paper Order Placed', 'order', 'info', `${order.side} ${order.runnerName} @ ${order.requestedOdds} x $${order.requestedStake}`);
  };

  const addRiskEvent = (eventType, severity, blocked, reason) => {
    addAuditLog(`Risk Check: ${eventType}`, 'risk', blocked ? 'warning' : 'info', `${reason}${blocked ? ' (BLOCKED)' : ''}`);
  };

  const addStrategySignal = (signal) => {
    const newSignal = { ...signal, id: 'ss' + Date.now() + Math.random().toString(36).slice(2, 6) };
    setStrategySignals(prev => [newSignal, ...prev].slice(0, 100));
    addAuditLog('Strategy Signal', 'strategy', 'info', `${signal.strategyName}: ${signal.reason || 'Signal generated'}`);
  };

  const addBacktestRun = (run) => {
    const newRun = { ...run, id: 'bt' + Date.now() };
    setBacktestRuns(prev => [newRun, ...prev]);
    addAuditLog('Backtest Completed', 'system', 'info', `Backtest "${run.name}" completed: ${run.totalBets} bets, ROI ${run.roi}%`);
  };

  const toggleWatchMarket = (marketId) => {
    setMarkets(prev => prev.map(m => m.id === marketId ? { ...m, watched: !m.watched } : m));
  };

  // Bot cycle runner — uses ref to always read latest state
  const runBotCycleRef = useRef(() => {});
  runBotCycleRef.current = () => {
    const s = stateRef.current;
    if (s.emergencyStop || s.mode !== 'paper') return;

    const cycleNum = s.botState.cycleNumber + 1;
    const now = new Date().toISOString();
    const steps = BOT_STEPS.map(name => ({ name, status: 'waiting' }));

    let marketsScanned = 0, marketsPassed = 0, signalsCreated = 0, ordersCreated = 0, ordersBlocked = 0, errors = 0;
    const notes = [];
    let signalCreated = null, orderCreated = null, riskBlockedReason = null;

    // Step 1: Scan Markets
    steps[0].status = 'passed';
    const candidates = s.markets.filter(m => m.status === 'OPEN' && !m.inPlay);
    marketsScanned = candidates.length;

    // Step 2: Filter Markets
    const filtered = candidates.filter(m =>
      m.totalMatched >= s.settings.minimumLiquidity && m.numberOfRunners >= 2
    );
    marketsPassed = filtered.length;
    steps[1].status = filtered.length > 0 ? 'passed' : 'blocked';

    const market = filtered.length > 0 ? filtered[Math.floor(Math.random() * filtered.length)] : null;

    if (market) {
      // Step 3: Read Odds
      steps[2].status = 'passed';

      // Step 4: Check Strategies
      const enabled = getEnabledStrategies(s.settings);
      steps[3].status = enabled.length > 0 ? 'passed' : 'blocked';

      if (enabled.length > 0) {
        const strategyName = enabled[Math.floor(Math.random() * enabled.length)];
        const marketRunners = s.runners.filter(r => r.marketId === market.id);

        if (marketRunners.length > 0) {
          // Step 5: Create Signal
          const runner = marketRunners[Math.floor(Math.random() * marketRunners.length)];
          const signal = createSignal(strategyName, market, runner, s.settings);
          signalCreated = signal;
          signalsCreated = 1;
          steps[4].status = 'passed';

          setStrategySignals(prev => [{ ...signal, id: 'ss' + Date.now() + Math.random().toString(36).slice(2, 6) }, ...prev].slice(0, 100));

          // Step 6: Run Risk Manager
          const risk = runRiskCheck(signal, s.settings, s.bankrollStats, s.paperOrders);
          if (!risk.passed) {
            steps[5].status = 'blocked';
            ordersBlocked = 1;
            riskBlockedReason = risk.reasons[0];
            notes.push(`Risk blocked: ${risk.reasons[0]}`);
            addAuditLog('Risk Blocked', 'risk', 'warning', `${strategyName} on ${runner.runnerName}: ${risk.reasons[0]}`);
          } else {
            steps[5].status = 'passed';

            // Step 7-8: Submit Paper Order + Track
            if (!s.botState.paused && s.botSettings.autoPaperTradingEnabled) {
              const order = createPaperOrder(signal, market, runner, s.settings);
              orderCreated = order;
              ordersCreated = 1;
              steps[6].status = 'passed';
              steps[7].status = 'passed';

              setPaperOrders(prev => [{ ...order, id: 'po' + Date.now() + Math.random().toString(36).slice(2, 6), created_date: now }, ...prev].slice(0, 200));

              // Settle a previous pending order
              const pending = s.paperOrders.filter(o => o.result === 'pending' && o.status === 'matched');
              if (pending.length > 0 && Math.random() > 0.5) {
                const toSettle = pending[0];
                const settled = settleOrder(toSettle, s.settings);
                setPaperOrders(prev => prev.map(o => o.id === toSettle.id ? settled : o));
                setBankrollStats(prev => ({
                  ...prev,
                  bankroll: prev.bankroll + settled.netProfit,
                  todayPL: prev.todayPL + settled.netProfit,
                  totalPL: prev.totalPL + settled.netProfit,
                  available: prev.available + settled.netProfit,
                  wins: settled.result === 'won' ? prev.wins + 1 : prev.wins,
                  losses: settled.result === 'lost' ? prev.losses + 1 : prev.losses,
                }));
                setBotState(prev => ({ ...prev, botPLToday: prev.botPLToday + settled.netProfit }));
                addToBotActivity('Paper order settled', `${settled.strategyName} on ${settled.runnerName} - ${settled.result.toUpperCase()} ${settled.netProfit >= 0 ? '+' : ''}$${settled.netProfit.toFixed(2)}`);
              }
            } else {
              steps[6].status = 'blocked';
              steps[7].status = 'waiting';
              notes.push('Bot paused or auto trading disabled');
            }
          }
        } else {
          steps[4].status = 'failed';
          errors++;
          notes.push('No runners found');
        }
      }
    }

    // Steps 8-10: Always pass
    steps[8].status = 'passed';
    steps[9].status = 'passed';
    steps[10].status = 'passed';

    addAuditLog(`Bot Cycle #${cycleNum}`, 'system', 'info',
      `Scanned ${marketsScanned} markets, ${marketsPassed} passed, ${signalsCreated} signals, ${ordersCreated} orders, ${ordersBlocked} blocked`);

    setBotState(prev => ({
      ...prev,
      cycleNumber: cycleNum,
      lastCycleTime: now,
      stepStatuses: steps,
      signalsToday: prev.signalsToday + signalsCreated,
      ordersToday: prev.ordersToday + ordersCreated,
      ordersBlockedToday: prev.ordersBlockedToday + ordersBlocked,
    }));

    setBotCycles(prev => [{
      id: 'bc' + Date.now() + Math.random().toString(36).slice(2, 6),
      cycleNumber: cycleNum,
      botMode: 'paper',
      startedAt: now,
      finishedAt: new Date().toISOString(),
      status: errors > 0 ? 'failed' : ordersBlocked > 0 ? 'blocked' : 'completed',
      marketsScanned,
      marketsPassedFilters: marketsPassed,
      signalsCreated,
      ordersCreated,
      ordersBlocked,
      errors,
      notes: notes.join('; ') || 'Cycle completed',
    }, ...prev].slice(0, 100));

    addToBotActivity('Market scanned', `${marketsScanned} markets scanned, ${marketsPassed} passed filters`);
    if (signalCreated) {
      addToBotActivity('Signal created', `${signalCreated.strategyName} on ${market?.marketName} - edge ${signalCreated.edgePercent?.toFixed(2)}%`);
    }
    if (orderCreated) {
      addToBotActivity('Paper order submitted', `${orderCreated.side} ${orderCreated.runnerName} @ ${orderCreated.requestedOdds} x $${orderCreated.requestedStake}`);
      addToBotActivity('Paper order matched', `${orderCreated.runnerName} - ${orderCreated.status}`);
    }
    if (riskBlockedReason) {
      addToBotActivity('Risk blocked', riskBlockedReason);
    }
  };

  // Bot cycle interval
  useEffect(() => {
    if (!botState.running || emergencyStop || mode !== 'paper') return;
    const intervalMs = (botSettings.scanIntervalSeconds || 10) * 1000;

    const initialDelay = setTimeout(() => { runBotCycleRef.current(); }, 500);
    const timer = setInterval(() => { runBotCycleRef.current(); }, intervalMs);

    return () => { clearTimeout(initialDelay); clearInterval(timer); };
  }, [botState.running, mode, emergencyStop, botSettings.scanIntervalSeconds]);

  // Countdown timer
  useEffect(() => {
    if (!botState.running || emergencyStop || mode !== 'paper') return;
    setBotState(prev => ({ ...prev, nextScanCountdown: botSettings.scanIntervalSeconds || 10 }));
    const timer = setInterval(() => {
      setBotState(prev => ({ ...prev, nextScanCountdown: Math.max(0, prev.nextScanCountdown - 1) }));
    }, 1000);
    return () => clearInterval(timer);
  }, [botState.running, mode, emergencyStop, botSettings.scanIntervalSeconds]);

  const value = {
    mode, changeMode, emergencyStop, triggerEmergencyStop, clearEmergencyStop,
    demoMode, setDemoMode, apiConnected, setApiConnected, betfairAccount, setBetfairAccount,
    jurisdiction, setJurisdiction, notifications, setNotifications,
    settings, updateSettings,
    markets, runners, paperOrders, strategySignals, bankrollStats, riskStatus, heatmap,
    auditLogs, backtestRuns, plData,
    addPaperOrder, addRiskEvent, addStrategySignal, addBacktestRun, addAuditLog,
    toggleWatchMarket,
    // Bot
    botState, botSettings, updateBotSettings, botCycles, strategyStats, botActivity,
    startBot, pauseBot, stopBot, addToBotActivity,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}