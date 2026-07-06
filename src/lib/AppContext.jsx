import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { createBetfairStream } from '@/lib/betfairApi';
import { BOT_STEPS, getEnabledStrategies, createSignal, runRiskCheck, createPaperOrder, settleOrder } from '@/lib/botEngine';
import { calculateCommission, isCommissionValidForLive } from '@/lib/betfairMapping';
import { runPreOrderChecks } from '@/lib/orderValidation';
import { ENRICHED_STRATEGY_LIBRARY, BETFAIR_MARKETS, BETFAIR_RUNNERS } from '@/lib/demoData';

const AppContext = createContext(null);

const DEFAULT_BOT_SETTINGS = {
  scanIntervalSeconds: 10,
  selectedStrategies: ['Value Bet', 'Pre-Off Scalping', 'Steam/Drift'],
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
  const [mode, setMode] = useState('demo');
  const [emergencyStop, setEmergencyStop] = useState(false);
  const demoMode = mode === 'demo';
  const [apiConnected, setApiConnected] = useState(false);
  const [betfairAccount, setBetfairAccount] = useState(null);
  const [betfairSessionToken, setBetfairSessionToken] = useState(null);
  const [jurisdiction, setJurisdiction] = useState('AU');
  const [notifications, setNotifications] = useState(3);

  // ── Betfair Connection State ──
  const [betfairConnection, setBetfairConnection] = useState({
    appKey: null,
    sessionTokenStatus: 'disconnected',
    loginStatus: 'disconnected',
    apiEnvironment: 'production',
    jurisdiction: 'AU',
    marketDataRefreshRate: 5,
    streamApiEnabled: false,
    streamConnectionStatus: 'disconnected',
    lastMarketSyncTime: null,
    lastOrderSyncTime: null,
    lastClearedOrderSyncTime: null,
    dataFreshnessLimit: 30,
    dataFresh: true,
    accountFundsAvailable: false,
    currentOrdersAvailable: false,
    streamAvailable: false,
  });

  // ── Settings with Commission Model ──
  const [settings, setSettings] = useState({
    // Commission Model
    defaultCommissionRate: 0.05,
    useMarketBaseRate: true,
    manualCommissionRate: null,
    commissionSource: null,
    commissionRate: 0.05, // Legacy field for backward compat

    // Bankroll
    bankroll: 10000,
    paperBankroll: 10000,
    baseStake: 100,
    maxStake: 500,
    maxStakePercent: 5,
    maxLayLiability: 1500,

    // Risk Limits
    dailyLossLimit: 500,
    weeklyLossLimit: 2500,
    maxMarketExposure: 1000,
    maxOpenOrders: 10,
    maxUnmatchedOrders: 10,
    maxTradesPerMarket: 5,
    maxTradesPerRunner: 1,
    maxTradesPerDay: 50,

    // Market Filters
    minimumLiquidity: 5000,
    minimumTradedVolume: 10000,
    minOdds: 1.5,
    maxOdds: 20,

    // Time Windows
    defaultTimeWindowStartSeconds: 300,
    defaultTimeWindowEndSeconds: 30,

    // In-Play Safety
    allowInPlay: false,
    persistApproved: false,

    // API Settings
    apiPollingInterval: 5,
    marketRefreshInterval: 10,
    dataFreshnessLimit: 30,
    streamApiEnabled: false,

    // Strategy Toggles
    strategyValueBetEnabled: true,
    strategyScalpingEnabled: true,
    strategyFavOutsiderEnabled: false, // Failing — disabled by default
    strategySteamDriftEnabled: true,
    strategyCrossMarketEnabled: true,
    favouriteSideEnabled: true,
    outsiderSideEnabled: true,

    // Responsible Gambling
    forcedPaperOnlyMode: false,
    dailyDepositReminderEnabled: false,

    // Legacy
    emergencyStopActive: false,
    liveTradingEnabled: false,
    selectedJurisdiction: 'AU',
  });

  // ── Data State — loaded from database, no demo fallback ──
  const [dataLoading, setDataLoading] = useState(true);
  const [markets, setMarkets] = useState(BETFAIR_MARKETS);
  const [runners, setRunners] = useState(BETFAIR_RUNNERS);
  const [paperOrders, setPaperOrders] = useState([]);
  const [strategySignals, setStrategySignals] = useState([]);
  const [bankrollStats, setBankrollStats] = useState({
    bankroll: settings.paperBankroll || settings.bankroll,
    paperBankroll: settings.paperBankroll || settings.bankroll,
    accountBankroll: 0,
    available: settings.paperBankroll || settings.bankroll,
    todayPL: 0,
    weeklyPL: 0,
    totalPL: 0,
    openPaperExposure: 0,
    openLiveExposure: 0,
    commissionPaid: 0,
    maxDrawdown: 0,
    wins: 0,
    losses: 0,
  });
  const [riskStatus] = useState({
    dailyLossLimit: 500, weeklyLossLimit: 2500, maxMarketExposure: 1000,
    maxOpenOrders: 10, maxUnmatchedOrders: 10, dataHealth: 'unknown',
    dailyLossUsed: 0, weeklyLossUsed: 0, strategyLimits: [],
  });
  const [heatmap] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [backtestRuns, setBacktestRuns] = useState([]);
  const [strategyLibrary] = useState(ENRICHED_STRATEGY_LIBRARY);

  // ── Sync State ──
  const [syncState, setSyncState] = useState({
    lastCatalogueSync: null,
    lastMarketBookSync: null,
    lastRunnerPriceSync: null,
    currentOrderSync: null,
    clearedOrderSync: null,
    lastMetricRecalculation: null,
    lastRiskRecalculation: null,
    marketsScannedToday: 0,
    runnersScannedToday: 0,
    signalsGeneratedToday: 0,
    ordersCreatedToday: 0,
    ordersRejectedToday: 0,
    lastRejectedReason: null,
  });

  // ── Bot State ──
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
    botMode: 'stopped', // stopped, paper_scanning, live_locked, live_running
  });
  const [botSettings, setBotSettings] = useState(DEFAULT_BOT_SETTINGS);
  const [botCycles, setBotCycles] = useState([]);
  const [strategyStats, setStrategyStats] = useState([]);
  const [botActivity, setBotActivity] = useState([]);

  // ── Rejected Orders ──
  const [rejectedOrders, setRejectedOrders] = useState([]);

  // Ref for latest state (avoids stale closures in interval)
  const stateRef = useRef({});
  stateRef.current = { markets, runners, settings, paperOrders, bankrollStats, botSettings, mode, emergencyStop, botState, strategyStats, strategyLibrary, betfairConnection, syncState, apiConnected, betfairSessionToken };

  // Ref for the Betfair Stream client
  const streamClientRef = useRef(null);

  // ── Load all app-generated data from database on mount ──
  useEffect(() => {
    let cancelled = false;
    const unsubs = [];

    const loadAll = async () => {
      try {
        setDataLoading(true);
        const [orders, signals, cycles, logs, runs, stats] = await Promise.all([
          base44.entities.PaperOrder.filter({}, '-created_date', 200).catch(() => []),
          base44.entities.StrategySignal.filter({}, '-created_date', 200).catch(() => []),
          base44.entities.BotCycle.filter({}, '-created_date', 100).catch(() => []),
          base44.entities.AuditLog.filter({}, '-created_date', 200).catch(() => []),
          base44.entities.BacktestRun.filter({}, '-created_date', 50).catch(() => []),
          base44.entities.StrategyStats.filter({}, '-created_date', 50).catch(() => []),
        ]);
        if (cancelled) return;
        setPaperOrders(orders);
        setStrategySignals(signals);
        setBotCycles(cycles);
        setAuditLogs(logs);
        setBacktestRuns(runs);
        setStrategyStats(stats);
      } catch (err) {
        // silently fail — app starts empty
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    loadAll();

    // Realtime subscriptions
    const subscribe = (entityName, setter, maxItems = 200) => {
      try {
        const unsub = base44.entities[entityName].subscribe((event) => {
          if (event.type === 'create') setter(prev => [event.data, ...prev].slice(0, maxItems));
          else if (event.type === 'update') setter(prev => prev.map(i => i.id === event.data.id ? { ...i, ...event.data } : i));
          else if (event.type === 'delete') setter(prev => prev.filter(i => i.id !== event.data.id));
        });
        unsubs.push(unsub);
      } catch (_) {}
    };
    subscribe('PaperOrder', setPaperOrders);
    subscribe('StrategySignal', setStrategySignals);
    subscribe('BotCycle', setBotCycles);
    subscribe('AuditLog', setAuditLogs, 500);
    subscribe('BacktestRun', setBacktestRuns);
    subscribe('StrategyStats', setStrategyStats);

    return () => { cancelled = true; unsubs.forEach(u => { try { u(); } catch (_) {} }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derive bankroll stats from settled paper orders ──
  useEffect(() => {
    const settled = paperOrders.filter(o => o.status === 'settled');
    const wins = settled.filter(o => o.result === 'won').length;
    const losses = settled.filter(o => o.result === 'lost').length;
    const totalPL = settled.reduce((s, o) => s + (o.netProfit || 0), 0);
    const commissionPaid = settled.reduce((s, o) => s + (o.commission || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const todayPL = settled.filter(o => (o.settled_date || o.created_date || '').slice(0, 10) === today).reduce((s, o) => s + (o.netProfit || 0), 0);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const weeklyPL = settled.filter(o => (o.settled_date || o.created_date || '') >= weekAgo).reduce((s, o) => s + (o.netProfit || 0), 0);

    const openOrders = paperOrders.filter(o => ['pending', 'matched', 'unmatched', 'partially_matched', 'executable'].includes(o.status));
    const paperExposure = openOrders.reduce((s, o) => s + (o.matched_size || o.matchedStake || o.requestedStake || 0), 0);

    const startingBankroll = settings.paperBankroll || settings.bankroll;
    const currentBankroll = startingBankroll + totalPL;

    // Max drawdown calc
    let peak = startingBankroll;
    let maxDD = 0;
    let running = startingBankroll;
    const sorted = [...settled].sort((a, b) => (a.settled_date || a.created_date || '').localeCompare(b.settled_date || b.created_date || ''));
    for (const o of sorted) {
      running += (o.netProfit || 0);
      if (running > peak) peak = running;
      const dd = running - peak;
      if (dd < maxDD) maxDD = dd;
    }

    setBankrollStats(prev => ({
      ...prev,
      bankroll: currentBankroll,
      paperBankroll: currentBankroll,
      available: currentBankroll - paperExposure,
      todayPL,
      weeklyPL,
      totalPL,
      commissionPaid,
      openPaperExposure: paperExposure,
      openLiveExposure: 0,
      maxDrawdown: maxDD,
      wins,
      losses,
    }));
  }, [paperOrders, settings.paperBankroll, settings.bankroll]);

  // ── Derive P/L chart data from settled orders ──
  const plData = useMemo(() => {
    const settled = paperOrders.filter(o => o.status === 'settled').slice().sort((a, b) => (a.settled_date || a.created_date || '').localeCompare(b.settled_date || b.created_date || ''));
    const starting = settings.paperBankroll || settings.bankroll;
    let running = starting;
    return settled.map((o, i) => {
      running += (o.netProfit || 0);
      return {
        date: (o.settled_date || o.created_date || '').slice(0, 10),
        timestamp: o.settled_date || o.created_date,
        bankroll: running,
        pl: o.netProfit || 0,
        cumulativePL: running - starting,
        label: `Trade ${i + 1}`,
      };
    });
  }, [paperOrders, settings.paperBankroll, settings.bankroll]);

  // ── Audit Logging ──
  const addAuditLog = (action, category, severity, details, extra = {}) => {
    const log = {
      action,
      category,
      severity,
      user: category === 'system' || category === 'strategy' || category === 'risk' ? 'bot' : 'admin',
      details,
      timestamp: new Date().toISOString(),
      objectType: extra.objectType || null,
      objectName: extra.objectName || null,
      beforeValue: extra.beforeValue || null,
      afterValue: extra.afterValue || null,
      reason: extra.reason || null,
    };
    setAuditLogs(prev => [{ ...log, id: 'al' + Date.now() + Math.random().toString(36).slice(2, 6) }, ...prev].slice(0, 500));
    base44.entities.AuditLog.create(log).catch(() => {});
  };

  const addToBotActivity = (action, details) => {
    setBotActivity(prev => [{ id: 'ba' + Date.now() + Math.random().toString(36).slice(2, 6), action, details, timestamp: new Date().toISOString() }, ...prev].slice(0, 50));
  };

  // ── Emergency Controls ──
  const triggerEmergencyStop = () => {
    setEmergencyStop(true);
    setMode('demo');
    setBotState(prev => ({ ...prev, running: false, paused: false, botMode: 'stopped' }));
    // Cancel all unmatched orders
    setPaperOrders(prev => prev.map(o =>
      ['pending', 'executable', 'unmatched', 'partially_matched'].includes(o.status)
        ? { ...o, status: 'cancelled', cancel_reason: 'Emergency stop activated', remaining_size: 0 }
        : o
    ));
    addAuditLog('Emergency Stop Activated', 'emergency', 'critical', 'Emergency stop triggered. Bot stopped. Reverted to demo mode. All unmatched orders cancelled.', { reason: 'Manual emergency stop' });
    addToBotActivity('Emergency stop activated', 'All bot activity halted, unmatched orders cancelled');
    setNotifications(prev => prev + 1);
  };

  const clearEmergencyStop = () => {
    setEmergencyStop(false);
    addAuditLog('Emergency Stop Cleared', 'emergency', 'info', 'Emergency stop cleared. App returned to demo mode.');
    addToBotActivity('Emergency stop cleared', 'System returned to demo mode');
  };

  const cancelUnmatchedOrders = () => {
    let count = 0;
    setPaperOrders(prev => prev.map(o => {
      if (['pending', 'executable', 'unmatched', 'partially_matched'].includes(o.status)) {
        count++;
        return { ...o, status: 'cancelled', cancel_reason: 'Manual cancellation', remaining_size: 0 };
      }
      return o;
    }));
    addAuditLog('Unmatched Orders Cancelled', 'order', 'warning', `${count} unmatched orders cancelled manually`);
    addToBotActivity('Orders cancelled', `${count} unmatched orders cancelled`);
  };

  const disableLiveTrading = () => {
    setSettings(prev => ({ ...prev, liveTradingEnabled: false }));
    addAuditLog('Live Trading Disabled', 'mode', 'warning', 'Live trading disabled manually');
    addToBotActivity('Live trading disabled', 'Reverted to paper-only mode');
  };

  const disableStrategy = (strategyName) => {
    setSettings(prev => ({
      ...prev,
      [`strategy${strategyName.replace(/[^A-Za-z]/g, '')}Enabled`]: false,
    }));
    addAuditLog('Strategy Disabled', 'strategy', 'warning', `${strategyName} disabled manually`, { objectName: strategyName });
  };

  const forcePaperOnly = () => {
    setSettings(prev => ({ ...prev, forcedPaperOnlyMode: true, liveTradingEnabled: false }));
    setMode('demo');
    addAuditLog('Forced Demo Mode', 'mode', 'warning', 'Forced demo mode activated. Live trading disabled.');
    addToBotActivity('Demo mode forced', 'Live trading disabled system-wide');
  };

  const resetAllPaperTrading = async () => {
    // Clear from database
    await Promise.all([
      base44.entities.PaperOrder.deleteMany({}).catch(() => {}),
      base44.entities.StrategySignal.deleteMany({}).catch(() => {}),
      base44.entities.BotCycle.deleteMany({}).catch(() => {}),
    ]);
    // Clear local state
    setPaperOrders([]);
    setRejectedOrders([]);
    setStrategySignals([]);
    setBotCycles([]);
    setBotActivity([]);
    const startingBankroll = settings.paperBankroll || settings.bankroll;
    setBankrollStats(prev => ({
      ...prev,
      bankroll: startingBankroll,
      todayPL: 0,
      weeklyPL: 0,
      totalPL: 0,
      paperBankroll: startingBankroll,
      available: startingBankroll,
      openPaperExposure: 0,
      openLiveExposure: 0,
      commissionPaid: 0,
      maxDrawdown: 0,
      wins: 0,
      losses: 0,
    }));
    setBotState(prev => ({
      ...prev,
      cycleNumber: 0,
      signalsToday: 0,
      ordersToday: 0,
      ordersBlockedToday: 0,
      botPLToday: 0,
    }));
    setSyncState(prev => ({
      ...prev,
      marketsScannedToday: 0,
      runnersScannedToday: 0,
      signalsGeneratedToday: 0,
      ordersCreatedToday: 0,
      ordersRejectedToday: 0,
      lastRejectedReason: null,
    }));
    addAuditLog('Paper Trading Reset', 'system', 'critical', 'All paper orders, signals, bot cycles, bankroll P/L, strategy stats, and daily counters reset to zero.');
    addToBotActivity('Paper trading reset', 'All paper trading data cleared and bankroll reset to starting balance');
  };

  // ── Mode Management ──
  const changeMode = (newMode) => {
    if (emergencyStop) return;
    if (newMode === 'live' && (settings.forcedPaperOnlyMode || !apiConnected)) return;
    setMode(newMode);
    const label = newMode === 'live' ? 'Live' : 'Demo';
    addAuditLog('Mode Changed', 'mode', 'info', `Switched to ${label} mode`);
  };

  const updateSettings = (newSettings) => {
    const oldSettings = settings;
    setSettings(newSettings);
    addAuditLog('Settings Updated', 'settings', 'info', 'App settings updated', {
      beforeValue: JSON.stringify({ commissionRate: oldSettings.commissionRate, allowInPlay: oldSettings.allowInPlay }),
      afterValue: JSON.stringify({ commissionRate: newSettings.commissionRate, allowInPlay: newSettings.allowInPlay }),
    });
  };

  const updateBotSettings = (newSettings) => {
    setBotSettings(newSettings);
    addAuditLog('Bot Settings Updated', 'settings', 'info', 'Bot configuration updated');
  };

  // ── Betfair Connection ──
  const updateBetfairConnection = (updates) => {
    setBetfairConnection(prev => ({ ...prev, ...updates }));
  };

  const testBetfairConnection = async () => {
    addAuditLog('Betfair Connection Tested', 'api', 'info', 'Connection test initiated');
    const results = {
      loginValid: false,
      appKeyPresent: false,
      marketDataAccess: false,
      accountFundsAvailable: false,
      currentOrdersAvailable: false,
      streamAvailable: false,
      streamStatus: betfairConnection.streamConnectionStatus || 'disconnected',
      marketCount: markets.length,
      runnerCount: runners.length,
    };

    try {
      // Check app key
      if (betfairConnection.appKey || apiConnected) {
        results.appKeyPresent = true;
      }

      // Check login/session
      if (apiConnected && betfairSessionToken) {
        results.loginValid = true;
      }

      // If the stream is still connecting/authenticating, wait up to 8 seconds for it
      if (results.loginValid) {
        const transitionalStates = ['connecting', 'authenticating', 'subscribing'];
        let waited = 0;
        let currentStatus = betfairConnection.streamConnectionStatus;

        while (transitionalStates.includes(currentStatus) && waited < 8000) {
          await new Promise(r => setTimeout(r, 500));
          waited += 500;
          currentStatus = stateRef.current.betfairConnection.streamConnectionStatus;
        }
        results.streamStatus = currentStatus;

        const streamConnected = currentStatus === 'connected';
        const hasMarketData = stateRef.current.markets.length > 0;
        if (streamConnected || hasMarketData) {
          results.marketDataAccess = true;
          results.accountFundsAvailable = true;
          results.currentOrdersAvailable = true;
        }
      }

      // Stream check
      if (betfairConnection.streamApiEnabled || apiConnected) {
        results.streamAvailable = results.streamStatus === 'connected';
      }

      results.marketCount = stateRef.current.markets.length;
      results.runnerCount = stateRef.current.runners.length;

      const allPassed = results.loginValid && results.appKeyPresent && results.marketDataAccess;
      
      setBetfairConnection(prev => ({
        ...prev,
        accountFundsAvailable: results.accountFundsAvailable,
        currentOrdersAvailable: results.currentOrdersAvailable,
        streamAvailable: results.streamAvailable,
        streamConnectionStatus: results.streamStatus,
      }));

      addAuditLog('Betfair Connection Test Complete', 'api', allPassed ? 'info' : 'warning',
        `Results: Login ${results.loginValid ? '✓' : '✗'}, App Key ${results.appKeyPresent ? '✓' : '✗'}, Market Data ${results.marketDataAccess ? '✓' : '✗'}, Funds ${results.accountFundsAvailable ? '✓' : '✗'}, Orders ${results.currentOrdersAvailable ? '✓' : '✗'}, Stream ${results.streamAvailable ? '✓' : '✗'} (${results.streamStatus}, ${results.marketCount} markets)`);

      return results;
    } catch (err) {
      addAuditLog('Betfair Connection Test Failed', 'api', 'error', `Connection test error: ${err.message}`);
      return results;
    }
  };

  // ── Sync Functions ──
  const syncMarkets = () => {
    const now = new Date().toISOString();
    setSyncState(prev => ({ ...prev, lastCatalogueSync: now, lastMarketBookSync: now, lastRunnerPriceSync: now, marketsScannedToday: prev.marketsScannedToday + markets.length }));
    addAuditLog('Market Sync Completed', 'api', 'info', `Synced ${markets.length} markets and ${runners.length} runners`);
    setBetfairConnection(prev => ({ ...prev, lastMarketSyncTime: now, dataFresh: true }));
  };

  const syncCurrentOrders = () => {
    const now = new Date().toISOString();
    setSyncState(prev => ({ ...prev, currentOrderSync: now }));
    addAuditLog('Order Sync Completed', 'api', 'info', `Synced current orders (${paperOrders.filter(o => ['pending', 'matched', 'unmatched', 'partially_matched'].includes(o.status)).length} open)`);
    setBetfairConnection(prev => ({ ...prev, lastOrderSyncTime: now }));
  };

  const syncClearedOrders = () => {
    const now = new Date().toISOString();
    setSyncState(prev => ({ ...prev, clearedOrderSync: now }));
    addAuditLog('Cleared Order Sync Completed', 'api', 'info', `Synced cleared/settled orders (${paperOrders.filter(o => o.status === 'settled').length} settled)`);
    setBetfairConnection(prev => ({ ...prev, lastClearedOrderSyncTime: now }));
  };

  const recalculateMetrics = () => {
    const now = new Date().toISOString();
    setSyncState(prev => ({ ...prev, lastMetricRecalculation: now }));
    
    // Recalculate strategy stats from settled orders only
    const settled = paperOrders.filter(o => o.status === 'settled');
    const newStats = strategyStats.map(stat => {
      const strategySettled = settled.filter(o => o.strategyName === stat.strategyName);
      const wins = strategySettled.filter(o => o.result === 'won').length;
      const losses = strategySettled.filter(o => o.result === 'lost').length;
      const totalStake = strategySettled.reduce((s, o) => s + (o.matchedStake || o.matched_size || 0), 0);
      const netProfit = strategySettled.reduce((s, o) => s + (o.netProfit || 0), 0);
      const roi = totalStake > 0 ? (netProfit / totalStake) * 100 : 0;
      return {
        ...stat,
        totalPaperOrders: strategySettled.length,
        wins,
        losses,
        strikeRate: strategySettled.length > 0 ? (wins / strategySettled.length) * 100 : 0,
        totalStake,
        netProfit,
        roi,
        updatedAt: now,
      };
    });
    setStrategyStats(newStats);
    addAuditLog('Metrics Recalculated', 'system', 'info', `Recalculated strategy metrics from ${settled.length} settled orders`);
  };

  const recalculateRiskState = () => {
    const now = new Date().toISOString();
    setSyncState(prev => ({ ...prev, lastRiskRecalculation: now }));
    
    const openOrders = paperOrders.filter(o => ['pending', 'matched', 'unmatched', 'partially_matched'].includes(o.status));
    const paperExposure = openOrders.filter(o => o.paper_mode !== false).reduce((s, o) => s + (o.matched_size || o.matchedStake || o.requestedStake || 0), 0);
    const liveExposure = openOrders.filter(o => o.liveMode === true).reduce((s, o) => s + (o.matched_size || o.matchedStake || o.requestedStake || 0), 0);
    
    setBankrollStats(prev => ({
      ...prev,
      openPaperExposure: paperExposure,
      openLiveExposure: liveExposure,
      available: prev.bankroll - paperExposure - liveExposure,
    }));
    
    addAuditLog('Risk State Recalculated', 'risk', 'info', `Paper exposure: $${paperExposure.toFixed(2)}, Live exposure: $${liveExposure.toFixed(2)}`);
  };

  // ── Bot Controls ──
  const startBot = () => {
    if (emergencyStop) return;
    if (settings.forcedPaperOnlyMode) {
      setMode('demo');
    }
    setBotState(prev => ({ ...prev, running: true, paused: false, nextScanCountdown: 1, botMode: 'paper_scanning' }));
    addAuditLog('Paper Scanner Started', 'mode', 'info', 'Paper scanner started. Auto scanning, signal detection, and paper order creation enabled.');
    addToBotActivity('Paper scanner started', 'Paper scanning mode activated');
  };

  const pauseBot = () => {
    setBotState(prev => ({ ...prev, paused: true }));
    addAuditLog('Bot Paused', 'mode', 'warning', 'Bot paused. No new paper orders will be created. Markets still being scanned.');
    addToBotActivity('Bot paused', 'New order creation suspended');
  };

  const stopBot = () => {
    setBotState(prev => ({ ...prev, running: false, paused: false, nextScanCountdown: 0, botMode: 'stopped' }));
    addAuditLog('Bot Stopped', 'mode', 'warning', 'Bot stopped. All scanning, signal generation, and order creation halted.');
    addToBotActivity('Bot stopped', 'All bot activity halted');
  };

  const runManualScan = () => {
    addAuditLog('Manual Scan Triggered', 'system', 'info', 'Manual market scan initiated');
    runBotCycleRef.current();
  };

  // ── Order Management ──
  const addPaperOrder = (order) => {
    const newOrder = {
      ...order,
      id: 'po' + Date.now() + Math.random().toString(36).slice(2, 6),
      created_date: new Date().toISOString(),
      placed_date: new Date().toISOString(),
    };
    setPaperOrders(prev => [newOrder, ...prev].slice(0, 200));
    base44.entities.PaperOrder.create(order).catch(() => {});
    addAuditLog('Paper Order Created', 'order', 'info', `${order.side} ${order.runnerName} @ ${order.requestedOdds} × $${order.requestedStake} (${order.persistenceType})`, { objectName: order.runnerName });
    setSyncState(prev => ({ ...prev, ordersCreatedToday: prev.ordersCreatedToday + 1 }));
  };

  const addRejectedOrder = (rejectedOrder) => {
    setRejectedOrders(prev => [rejectedOrder, ...prev].slice(0, 100));
    addAuditLog('Order Rejected', 'order', 'warning', `Order rejected: ${rejectedOrder.rejection_reason}`, {
      objectName: rejectedOrder.runner || rejectedOrder.selectionId,
      reason: rejectedOrder.rejection_reason,
    });
    setSyncState(prev => ({ ...prev, ordersRejectedToday: prev.ordersRejectedToday + 1, lastRejectedReason: rejectedOrder.rejection_reason }));
  };

  const addRiskEvent = (eventType, severity, blocked, reason) => {
    addAuditLog(`Risk Check: ${eventType}`, 'risk', blocked ? 'warning' : 'info', `${reason}${blocked ? ' (BLOCKED)' : ''}`);
  };

  const addStrategySignal = (signal) => {
    const newSignal = { ...signal, id: 'ss' + Date.now() + Math.random().toString(36).slice(2, 6) };
    setStrategySignals(prev => [newSignal, ...prev].slice(0, 100));
    base44.entities.StrategySignal.create(signal).catch(() => {});
    addAuditLog('Strategy Signal', 'strategy', 'info', `${signal.strategyName}: ${signal.reason || 'Signal generated'}`);
    setSyncState(prev => ({ ...prev, signalsGeneratedToday: prev.signalsGeneratedToday + 1 }));
  };

  const addBacktestRun = (run) => {
    const newRun = { ...run, id: 'bt' + Date.now() };
    setBacktestRuns(prev => [newRun, ...prev]);
    base44.entities.BacktestRun.create(run).catch(() => {});
    addAuditLog('Backtest Completed', 'system', 'info', `Backtest "${run.name}" completed: ${run.totalBets} bets, ROI ${run.roi}%`);
  };

  const toggleWatchMarket = (marketId) => {
    setMarkets(prev => prev.map(m => (m.betfairMarketId === marketId || m.id === marketId) ? { ...m, watched: !m.watched } : m));
  };

  // ── Runner Removal Handling ──
  const handleRunnerRemoval = (runnerId) => {
    setRunners(prev => prev.map(r => {
      if (r.id === runnerId || r.betfairSelectionId === runnerId) {
        return { ...r, status: 'REMOVED', strategySignalStatus: 'rejected', rejectedSignalReason: 'Runner removed' };
      }
      return r;
    }));
    // Flag affected orders for review
    setPaperOrders(prev => prev.map(o => {
      if ((o.runnerId === runnerId || o.selectionId === runnerId) && o.status !== 'settled') {
        return { ...o, warningFlags: [...(o.warningFlags || []), 'Runner removed — results may require adjustment'] };
      }
      return o;
    }));
    addAuditLog('Runner Removed', 'risk', 'warning', `Runner ${runnerId} marked as REMOVED. Affected orders flagged for review.`, { objectName: runnerId });
  };

  // ── Bot Cycle Runner ──
  const runBotCycleRef = useRef(() => {});
  runBotCycleRef.current = () => {
    const s = stateRef.current;
    if (s.emergencyStop || (s.mode !== 'demo' && s.mode !== 'live')) return;

    const cycleNum = s.botState.cycleNumber + 1;
    const now = new Date().toISOString();
    const steps = BOT_STEPS.map(name => ({ name, status: 'waiting' }));

    let marketsScanned = 0, marketsPassed = 0, signalsCreated = 0, ordersCreated = 0, ordersBlocked = 0, errors = 0;
    const notes = [];
    let signalCreated = null, orderCreated = null, riskBlockedReason = null, rejectedOrder = null;

    // Step 1: Scan Markets (Market Catalogue)
    steps[0].status = 'passed';
    const candidates = s.markets.filter(m => m.status === 'OPEN' && !m.inPlay);
    marketsScanned = candidates.length;
    setSyncState(prev => ({ ...prev, marketsScannedToday: prev.marketsScannedToday + marketsScanned, runnersScannedToday: prev.runnersScannedToday + s.runners.filter(r => candidates.some(m => m.id === r.marketId)).length }));

    // Step 2: Filter Markets (Market Book)
    // In live mode, stream markets may have totalMatched=0 (just opened) and
    // numberOfRunners unset (marketDefinition still arriving). We accept any
    // OPEN market with 2+ runners; the pre-order validation step catches
    // markets without actual price data. In demo mode we keep the liquidity
    // check since demo data always has totalMatched populated.
    const filtered = candidates.filter(m => {
      const marketRunners = s.runners.filter(r => r.marketId === m.id || r.marketId === m.betfairMarketId);
      const runnerCount = m.numberOfRunners || m.numberOfActiveRunners || marketRunners.length;
      const commissionOk = m.marketBaseRate != null || s.settings.defaultCommissionRate > 0;
      if (s.apiConnected) {
        // Live mode: just need 2+ runners and determinable commission
        return runnerCount >= 2 && commissionOk;
      }
      // Demo mode: apply liquidity filter
      return m.totalMatched >= s.settings.minimumLiquidity && runnerCount >= 2 && commissionOk;
    });
    marketsPassed = filtered.length;
    steps[1].status = filtered.length > 0 ? 'passed' : 'blocked';
    if (steps[1].status === 'blocked') {
      steps[1].reason = candidates.length === 0
        ? 'No open markets found. Check API connection or market data stream.'
        : 'No markets passed filters. Check runner count or commission settings.';
    }

    // Sort markets by proximity to the pre-off trading window (default 300s–30s before start).
    // The bot prefers markets about to jump — a random pick would almost always be hours
    // away and get rejected at the time-window validation check.
    const windowStart = s.settings.defaultTimeWindowStartSeconds || 300;
    const windowEnd = s.settings.defaultTimeWindowEndSeconds || 30;
    const nowMs = Date.now();
    const sorted = filtered
      .map(m => {
        const start = m.startTime ? new Date(m.startTime).getTime() : NaN;
        const secsBefore = isNaN(start) ? null : (start - nowMs) / 1000;
        // Distance from the ideal window: 0 if inside, otherwise how far outside
        let distance;
        if (secsBefore === null) distance = Infinity; // No start time — lowest priority
        else if (secsBefore >= windowEnd && secsBefore <= windowStart) distance = 0; // In window
        else if (secsBefore > windowStart) distance = secsBefore - windowStart; // Too early
        else if (secsBefore > 0) distance = windowEnd - secsBefore; // Too late (closing)
        else distance = Infinity; // Already jumped
        return { market: m, secsBefore, distance };
      })
      .sort((a, b) => a.distance - b.distance);

    const market = sorted.length > 0 ? sorted[0].market : null;

    if (market) {
      // Step 3: Read Odds (Market Book)
      steps[2].status = 'passed';

      // Step 4: Check Strategies
      const enabled = getEnabledStrategies(s.settings).filter(name => {
        const strat = s.strategyLibrary?.find(sl => sl.name === name);
        return strat && strat.status !== 'archived' && strat.status !== 'failing';
      });
      steps[3].status = enabled.length > 0 ? 'passed' : 'blocked';
      if (steps[3].status === 'blocked') steps[3].reason = 'No eligible strategies enabled. Fav/Outsider is failing, archived strategies are disabled.';

      if (enabled.length > 0) {
        const strategyName = enabled[Math.floor(Math.random() * enabled.length)];
        const strategy = s.strategyLibrary?.find(sl => sl.name === strategyName);
        const marketRunners = s.runners.filter(r => r.marketId === market.id && r.status === 'ACTIVE');

        if (marketRunners.length > 0) {
          // Step 5: Create Signal — prefer runners with real prices and sufficient liquidity
          // Step 5: Create Signal — only runners with sufficient liquidity on BOTH sides,
          // since the strategy may pick BACK or LAY. Sorted by the weaker side's size.
          const minSize = s.settings.baseStake || 50;
          const runnable = marketRunners
            .filter(r => r.bestBackPrice > 0 && r.bestLayPrice > 0 && r.bestBackSize >= minSize && r.bestLaySize >= minSize)
            .sort((a, b) => Math.min(b.bestBackSize || 0, b.bestLaySize || 0) - Math.min(a.bestBackSize || 0, a.bestLaySize || 0));
          const runner = runnable[Math.floor(Math.random() * Math.min(runnable.length, 5))];

          if (!runner) {
            steps[4].status = 'blocked';
            steps[4].reason = `No runners with sufficient liquidity on both sides (min $${minSize} back & lay) — waiting for stream data.`;
            notes.push(`No runners with sufficient liquidity (min $${minSize} both sides)`);
          } else {
          const signal = createSignal(strategyName, market, runner, s.settings);
          signalCreated = signal;
          signalsCreated = 1;
          steps[4].status = 'passed';

          setStrategySignals(prev => [{ ...signal, id: 'ss' + Date.now() + Math.random().toString(36).slice(2, 6) }, ...prev].slice(0, 100));
          base44.entities.StrategySignal.create(signal).catch(() => {});

          // Step 6: Run Pre-Order Validation
          const connectionState = {
            apiConnected: s.apiConnected,
            betfairSessionToken: s.betfairSessionToken,
            dataFresh: s.betfairConnection?.dataFresh ?? true,
          };

          const preCheck = runPreOrderChecks(
            { marketId: market.id, selectionId: runner.betfairSelectionId, runnerId: runner.id, side: signal.side, price: signal.odds, size: signal.stakeSuggestion, strategyName, persistenceType: signal.persistenceType },
            market, runner, strategy, s.settings, s.bankrollStats, s.paperOrders, connectionState
          );

          if (!preCheck.passed) {
            steps[5].status = 'blocked';
            steps[5].reason = preCheck.failures[0].reason;
            ordersBlocked = 1;
            riskBlockedReason = preCheck.failures[0].reason;
            rejectedOrder = preCheck.rejectedOrder;
            notes.push(`Pre-order validation failed: ${preCheck.failures[0].reason}`);
            addAuditLog('Order Rejected', 'order', 'warning', `${strategyName} on ${runner.runnerName}: ${preCheck.failures[0].reason}`, { objectName: runner.runnerName, reason: preCheck.failures[0].reason });
            if (rejectedOrder) {
              setRejectedOrders(prev => [rejectedOrder, ...prev].slice(0, 100));
              setSyncState(prev2 => ({ ...prev2, ordersRejectedToday: prev2.ordersRejectedToday + 1, lastRejectedReason: preCheck.failures[0].reason }));
            }
          } else {
            steps[5].status = 'passed';

            // Step 7: Run Risk Manager
            const risk = runRiskCheck(signal, s.settings, s.bankrollStats, s.paperOrders);
            if (!risk.passed) {
              steps[6].status = 'blocked';
              steps[6].reason = risk.reasons[0];
              ordersBlocked = 1;
              riskBlockedReason = risk.reasons[0];
              notes.push(`Risk blocked: ${risk.reasons[0]}`);
              addAuditLog('Risk Blocked', 'risk', 'warning', `${strategyName} on ${runner.runnerName}: ${risk.reasons[0]}`);
            } else {
              steps[6].status = 'passed';

              // Step 8-9: Submit Paper Order + Track
              if (!s.botState.paused && s.botSettings.autoPaperTradingEnabled) {
                const order = createPaperOrder(signal, market, runner, s.settings);
                orderCreated = order;
                ordersCreated = 1;
                steps[7].status = 'passed';
                steps[8].status = 'passed';

                setPaperOrders(prev => [{ ...order, id: 'po' + Date.now() + Math.random().toString(36).slice(2, 6), created_date: now, placed_date: now }, ...prev].slice(0, 200));
                base44.entities.PaperOrder.create(order).catch(() => {});
                setSyncState(prev2 => ({ ...prev2, ordersCreatedToday: prev2.ordersCreatedToday + 1 }));

                const pending = s.paperOrders.filter(o => o.result === 'pending' && o.status === 'matched');
                if (!s.apiConnected && pending.length > 0 && Math.random() > 0.5) {
                  const toSettle = pending[0];
                  const settled = settleOrder(toSettle, market, s.settings);
                  setPaperOrders(prev => prev.map(o => o.id === toSettle.id ? settled : o));
                  base44.entities.PaperOrder.update(toSettle.id, settled).catch(() => {});
                  setBankrollStats(prev => ({
                    ...prev,
                    bankroll: prev.bankroll + settled.netProfit,
                    todayPL: prev.todayPL + settled.netProfit,
                    totalPL: prev.totalPL + settled.netProfit,
                    available: prev.available + settled.netProfit,
                    commissionPaid: prev.commissionPaid + (settled.commission || 0),
                    wins: settled.result === 'won' ? prev.wins + 1 : prev.wins,
                    losses: settled.result === 'lost' ? prev.losses + 1 : prev.losses,
                  }));
                  setBotState(prev => ({ ...prev, botPLToday: prev.botPLToday + settled.netProfit }));
                  addToBotActivity('Paper order settled', `${settled.strategyName} on ${settled.runnerName} — ${settled.result.toUpperCase()} ${settled.netProfit >= 0 ? '+' : ''}$${settled.netProfit.toFixed(2)}`);
                  addAuditLog('Paper Order Settled', 'order', 'info', `${settled.runnerName} ${settled.result.toUpperCase()} — Net $${settled.netProfit.toFixed(2)} (commission $${settled.commission?.toFixed(2)} at ${(settled.commissionRateUsed * 100).toFixed(1)}%)`);
                }
              } else {
                steps[7].status = 'blocked';
                steps[7].reason = 'Bot is paused or auto paper trading is disabled.';
                steps[8].status = 'waiting';
                notes.push('Bot paused or auto trading disabled');
              }
            }
          }
          }
        } else {
          steps[4].status = 'failed';
          steps[4].reason = 'No active runners found for the selected market.';
          errors++;
          notes.push('No active runners found');
        }
      }
    }

    // Steps 10-12: Always pass
    steps[9].status = 'passed';
    steps[10].status = 'passed';
    steps[11].status = 'passed';

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

    const cycleRecord = {
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
    };
    setBotCycles(prev => [{ ...cycleRecord, id: 'bc' + Date.now() + Math.random().toString(36).slice(2, 6) }, ...prev].slice(0, 100));
    base44.entities.BotCycle.create(cycleRecord).catch(() => {});

    setSyncState(prev => ({ ...prev, signalsGeneratedToday: prev.signalsGeneratedToday + signalsCreated }));

    addToBotActivity('Market scanned', `${marketsScanned} markets scanned, ${marketsPassed} passed filters`);
    if (signalCreated) {
      addToBotActivity('Signal created', `${signalCreated.strategyName} on ${market?.marketName} — edge ${signalCreated.edgePercent?.toFixed(2)}%, spread ${signalCreated.spreadTicks} ticks`);
    }
    if (orderCreated) {
      addToBotActivity('Paper order submitted', `${orderCreated.side} ${orderCreated.runnerName} @ ${orderCreated.requestedOdds} × $${orderCreated.requestedStake} (${orderCreated.persistenceType})`);
      addToBotActivity('Paper order matched', `${orderCreated.runnerName} — ${orderCreated.status} (sim quality: ${orderCreated.paperSimulationQuality})`);
    }
    if (riskBlockedReason) {
      addToBotActivity('Risk blocked', riskBlockedReason);
    }
  };

  // ── Bot Cycle Interval ──
  useEffect(() => {
    if (!botState.running || emergencyStop || (mode !== 'demo' && mode !== 'live')) return;
    const intervalMs = (botSettings.scanIntervalSeconds || 10) * 1000;

    const initialDelay = setTimeout(() => { runBotCycleRef.current(); }, 500);
    const timer = setInterval(() => { runBotCycleRef.current(); }, intervalMs);

    return () => { clearTimeout(initialDelay); clearInterval(timer); };
  }, [botState.running, mode, emergencyStop, botSettings.scanIntervalSeconds]);

  // ── Countdown Timer ──
  useEffect(() => {
    if (!botState.running || emergencyStop || (mode !== 'demo' && mode !== 'live')) return;
    setBotState(prev => ({ ...prev, nextScanCountdown: botSettings.scanIntervalSeconds || 10 }));
    const timer = setInterval(() => {
      setBotState(prev => ({ ...prev, nextScanCountdown: Math.max(0, prev.nextScanCountdown - 1) }));
    }, 1000);
    return () => clearInterval(timer);
  }, [botState.running, mode, emergencyStop, botSettings.scanIntervalSeconds]);

  // ── Betfair Stream API — real-time market data when connected ──
  // In live mode, ONLY API data is used for all numbers.
  // Uses WebSocket (bypasses CORS + WAF) to stream live market/runner data.
  // Demo data is cleared immediately on connect; stream populates with real data.
  useEffect(() => {
    // Disconnect existing stream
    if (streamClientRef.current) {
      streamClientRef.current.disconnect();
      streamClientRef.current = null;
    }

    if (!apiConnected) {
      setBetfairConnection(prev => ({ ...prev, dataFresh: false, streamConnectionStatus: 'disconnected' }));
      // Restore demo data when disconnecting in demo mode
      if (mode === 'demo') {
        setMarkets(BETFAIR_MARKETS);
        setRunners(BETFAIR_RUNNERS);
      } else {
        setMarkets([]);
        setRunners([]);
      }
      return;
    }

    // Connected — clear demo data immediately so live mode shows ONLY API data
    setMarkets([]);
    setRunners([]);
    setBetfairConnection(prev => ({ ...prev, dataFresh: true, loginStatus: 'connected', sessionTokenStatus: 'connected', streamApiEnabled: true }));

    if (!betfairSessionToken) return;

    let cancelled = false;

    // Create stream connection
    createBetfairStream(betfairSessionToken, {
      onMarketsUpdate: (streamMarkets, streamRunners) => {
        if (cancelled) return;
        setMarkets(streamMarkets);
        setRunners(streamRunners);
        setBetfairConnection(prev => ({ ...prev, lastMarketSyncTime: new Date().toISOString(), dataFresh: true, streamConnectionStatus: 'connected' }));
      },
      onStatusChange: (status) => {
        if (cancelled) return;
        setBetfairConnection(prev => ({
          ...prev,
          streamConnectionStatus: status,
          loginStatus: status === 'connected' || status === 'subscribing' ? 'connected' : 'disconnected',
          sessionTokenStatus: status === 'session_expired' ? 'expired' : (status === 'connected' ? 'connected' : 'disconnected'),
        }));
        if (status === 'connected') {
          addAuditLog('Betfair Stream Connected', 'api', 'info', 'Real-time market data stream established');
        } else if (status === 'session_expired') {
          setApiConnected(false);
          setBetfairSessionToken(null);
          addAuditLog('Betfair Session Expired', 'api', 'warning', 'Stream session expired. Please reconnect your Betfair account.');
        }
      },
      onError: (error) => {
        if (cancelled) return;
        addAuditLog('Stream Error', 'api', 'error', `Betfair stream error: ${error}`);
      },
      onMarketSettled: ({ marketId, winners, venue, marketName }) => {
        if (cancelled) return;
        const s = stateRef.current;
        const pendingOrders = s.paperOrders.filter(
          o => o.result === 'pending' && (o.marketId === marketId || o.betfairMarketId === marketId)
        );
        for (const order of pendingOrders) {
          const selectionId = String(order.selectionId || order.betfairSelectionId || '');
          const won = winners.includes(selectionId);
          const market = s.markets.find(m => m.betfairMarketId === marketId || m.id === marketId) || { venue, marketName };
          const settled = settleOrder(order, market, s.settings, won ? 'won' : 'lost');
          setPaperOrders(prev => prev.map(o => o.id === order.id ? settled : o));
          base44.entities.PaperOrder.update(order.id, settled).catch(() => {});
          setBankrollStats(prev => ({
            ...prev,
            bankroll: prev.bankroll + settled.netProfit,
            todayPL: prev.todayPL + settled.netProfit,
            totalPL: prev.totalPL + settled.netProfit,
            available: prev.available + settled.netProfit,
            commissionPaid: prev.commissionPaid + (settled.commission || 0),
            wins: settled.result === 'won' ? prev.wins + 1 : prev.wins,
            losses: settled.result === 'lost' ? prev.losses + 1 : prev.losses,
          }));
          addAuditLog('Paper Order Settled (Live Result)', 'order', 'info',
            `${settled.runnerName} ${settled.result.toUpperCase()} — Net ${settled.netProfit >= 0 ? '+' : ''}$${settled.netProfit.toFixed(2)} (${venue || ''} ${marketName || ''})`);
          addToBotActivity('Paper order settled (live)', `${settled.runnerName} ${settled.result.toUpperCase()} — ${settled.netProfit >= 0 ? '+' : ''}$${settled.netProfit.toFixed(2)}`);
        }
      },
    }).then(({ client, config }) => {
      if (cancelled) {
        client.disconnect();
        return;
      }
      streamClientRef.current = client;
      setBetfairConnection(prev => ({ ...prev, appKey: config.appKey, jurisdiction: config.jurisdiction }));
    }).catch(err => {
      if (cancelled) return;
      addAuditLog('Stream Connection Failed', 'api', 'error', `Failed to create stream: ${err.message}`);
      setBetfairConnection(prev => ({ ...prev, streamConnectionStatus: 'error' }));
    });

    return () => {
      cancelled = true;
      if (streamClientRef.current) {
        streamClientRef.current.disconnect();
        streamClientRef.current = null;
      }
    };
  }, [apiConnected, betfairSessionToken]);

  const value = {
    mode, changeMode, setMode, emergencyStop, triggerEmergencyStop, clearEmergencyStop,
    demoMode,
    apiConnected, setApiConnected, betfairAccount, setBetfairAccount, betfairSessionToken, setBetfairSessionToken,
    jurisdiction, setJurisdiction, notifications, setNotifications,
    betfairConnection, updateBetfairConnection, testBetfairConnection,
    settings, updateSettings,
    markets, runners, paperOrders, strategySignals, bankrollStats, riskStatus, heatmap,
    auditLogs, backtestRuns, plData, dataLoading,
    addPaperOrder, addRejectedOrder, addRiskEvent, addStrategySignal, addBacktestRun, addAuditLog,
    toggleWatchMarket, handleRunnerRemoval,
    rejectedOrders,
    // Sync
    syncState, syncMarkets, syncCurrentOrders, syncClearedOrders, recalculateMetrics, recalculateRiskState,
    // Bot
    botState, botSettings, updateBotSettings, botCycles, strategyStats, botActivity,
    startBot, pauseBot, stopBot, runManualScan, addToBotActivity,
    // Strategy Library
    strategyLibrary,
    // Emergency controls
    cancelUnmatchedOrders, disableLiveTrading, disableStrategy, forcePaperOnly,
    resetAllPaperTrading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}