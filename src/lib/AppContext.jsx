import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { createBetfairStream } from '@/lib/betfairApi';
import { BOT_STEPS, getEnabledStrategies, runRiskCheck, createPaperOrder, settleOrder, createSignal } from '@/lib/botEngine';
import { calculateCommission, isCommissionValidForLive } from '@/lib/betfairMapping';
import { runPreOrderChecks } from '@/lib/orderValidation';
import { countTicksBetween } from '@/lib/tickLadder';
import { ENRICHED_STRATEGY_LIBRARY } from '@/lib/strategyLibrary';
import { buildScanDiagnostics } from './scanDiagnostics';
import { computeCalibration } from './calibration';
import { fmtPct } from './candidateScoring';
import { calculateRiskMetrics } from '@/lib/riskCalculations';
import { runExchangeCycle, opportunityToSignal } from '@/lib/exchangeOpportunityEngine';
import { settleOrderWithResult, lapseUnmatchedOrder } from '@/lib/settlementService';
import { PAPER_PROOF_BOT_SETTINGS, PAPER_PROOF_APP_SETTINGS, PAPER_PROOF_FEATHERLESS_SETTINGS, isPaperProofModeActive } from '@/lib/paperProofDefaults';
import { buildProofOpportunity } from '@/lib/paperProofScanner';
import { runSettlementCheck } from '@/lib/settlementWatcher';
import { mergeBetfairMarkets, getMarketDataSourceLabel } from '@/lib/betfairMarketMerge';

// ── Metadata fields to strip when loading settings from DB ──
const DB_META_FIELDS = ['id', 'created_date', 'updated_date', 'created_by_id', 'owner', 'owner_id', '_v'];

function stripDbMeta(rec) {
  if (!rec || typeof rec !== 'object') return {};
  const clean = { ...rec };
  for (const f of DB_META_FIELDS) delete clean[f];
  return clean;
}

// ── Safe defaults for Featherless AI — never allow live handoff by default ──
const DEFAULT_FEATHERLESS_SETTINGS = {
  enabled: false,
  modelName: 'deepseek-ai/DeepSeek-V4-Flash',
  temperature: 0.1,
  maxTokens: 4000,
  timeoutSeconds: 60,
  minConfidence: 50,
  minEdge: 3,
  minExpectedROI: 1,
  paperTradeOnly: true,
  allowLiveHandoff: false,
  storeLogs: true,
  minOdds: 1.5,
  maxOdds: 50,
  minLiquidity: 20,
  timeWindowStart: 500,
  timeWindowEnd: 30,
  stakingMode: 'confidence_weighted_fractional_kelly',
  webResearchEnabled: false,
  aiDecisionMode: 'strict',
  requireExternalFormData: false,
  targetPaperBetsPerDay: 'low',
  maxSpread: 7,
  winMinOdds: 1.5, winMaxOdds: 50, winMinLiquidity: 20, winMaxSpreadTicks: 7, winMinEdge: 3, winMinROI: 1,
  placeMinOdds: 1.2, placeMaxOdds: 30, placeMinLiquidity: 10, placeMaxSpreadTicks: 7, placeMinEdge: 2, placeMinROI: 1,
  h2hMinOdds: 1.2, h2hMaxOdds: 15, h2hMinLiquidity: 10, h2hMaxSpreadTicks: 5, h2hMinEdge: 3, h2hMinROI: 1,
  allowHedging: false,
  debugScanMode: false,
  externalSearchEnabled: false,
  maxExternalProbabilityAdjustment: 0.05,
  minExternalSourceCount: 2,
  minExternalDataQuality: 50,
  requireExternalSearchForLiveBetting: false,
  externalSearchCacheTtlMinutes: 5,
};

const AppContext = createContext(null);

const DEFAULT_BOT_SETTINGS = {
  botEnabled: false,
  botMode: 'demo',
  scanIntervalSeconds: 30,
  selectedStrategies: ['Featherless AI Value Decision Engine'],
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
  const [emergencyStop, setEmergencyStop] = useState(false);
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
    lastCatalogueRefreshAt: null,
    lastPriceFetchAt: null,
    catalogueMarketsCount: 0,
    catalogueRunnersCount: 0,
    marketsWithPriceData: 0,
    marketCatalogueError: null,
    priceFeedStale: false,
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
    minimumLiquidity: 500,
    minimumTradedVolume: 1000,
    minOdds: 1.5,
    maxOdds: 20,

    // Time Windows
    defaultTimeWindowStartSeconds: 500,
    defaultTimeWindowEndSeconds: 30,

    // In-Play Safety
    allowInPlay: false,
    persistApproved: false,

    // API Settings
    apiPollingInterval: 5,
    marketRefreshInterval: 10,
    dataFreshnessLimit: 30,
    streamApiEnabled: false,

    // Strategy Toggles — only Featherless AI is available
    favouriteSideEnabled: true,
    outsiderSideEnabled: true,

    // Responsible Gambling
    forcedPaperOnlyMode: false,
    dailyDepositReminderEnabled: false,

    // Testing — bypass all risk limits
    riskLimitsDisabled: false,

    // Hedging — allow conflicting BACK+LAY positions on same selection
    allowHedging: false,

    // Legacy
    emergencyStopActive: false,
    liveTradingEnabled: false,
    selectedJurisdiction: 'AU',
  });

  // ── Data State — loaded from database, no demo fallback ──
  const [dataLoading, setDataLoading] = useState(true);
  const [markets, setMarkets] = useState([]);
  const [runners, setRunners] = useState([]);
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
    roi: 0,
    strikeRate: 0,
  });
  const riskStatus = useMemo(() => {
    const rm = calculateRiskMetrics(paperOrders, settings);
    const dailyLossUsed = Math.max(0, -(rm.dailyPL || 0));
    const weeklyLossUsed = Math.max(0, -(rm.weeklyPL || 0));
    const dailyLossLimit = settings.dailyLossLimit || 500;
    const weeklyLossLimit = settings.weeklyLossLimit || 2500;
    const maxMarketExposure = settings.maxMarketExposure || 1000;
    const maxOpenOrders = settings.maxOpenOrders || 10;
    const maxUnmatched = settings.maxUnmatchedOrders || settings.maxOpenOrders || 10;
    return {
      dailyLossLimit: { status: dailyLossUsed >= dailyLossLimit ? 'danger' : 'ok', value: dailyLossLimit > 0 ? (dailyLossUsed / dailyLossLimit) * 100 : 0, label: 'Daily Loss Used', max: dailyLossLimit },
      weeklyLossLimit: { status: weeklyLossUsed >= weeklyLossLimit ? 'danger' : 'ok', value: weeklyLossLimit > 0 ? (weeklyLossUsed / weeklyLossLimit) * 100 : 0, label: 'Weekly Loss Used', max: weeklyLossLimit },
      maxMarketExposure: { status: rm.openExposure >= maxMarketExposure ? 'danger' : 'ok', value: maxMarketExposure > 0 ? (rm.openExposure / maxMarketExposure) * 100 : 0, label: 'Market Exposure', max: maxMarketExposure },
      maxOpenOrders: { status: rm.activeOrderCount >= maxOpenOrders ? 'danger' : 'ok', value: maxOpenOrders > 0 ? (rm.activeOrderCount / maxOpenOrders) * 100 : 0, label: 'Open Orders', max: maxOpenOrders },
      maxUnmatchedOrders: { status: rm.unmatchedOrderCount >= maxUnmatched ? 'warning' : 'ok', value: maxUnmatched > 0 ? (rm.unmatchedOrderCount / maxUnmatched) * 100 : 0, label: 'Unmatched Orders', max: maxUnmatched },
      dataHealth: { status: apiConnected ? 'ok' : 'warning', value: apiConnected ? 100 : 0, label: 'API Health', max: 100 },
    };
  }, [paperOrders, settings.dailyLossLimit, settings.weeklyLossLimit, settings.maxMarketExposure, settings.maxOpenOrders, settings.maxUnmatchedOrders, apiConnected]);
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

  // ── Featherless AI ──
  const [featherlessSettings, setFeatherlessSettings] = useState({ ...DEFAULT_FEATHERLESS_SETTINGS });
  const [aiDecisions, setAiDecisions] = useState([]);
  const [lastScanDiagnostics, setLastScanDiagnostics] = useState(null);
  const [exchangeOpportunities, setExchangeOpportunities] = useState([]);
  const [lastExchangeDiagnostics, setLastExchangeDiagnostics] = useState(null);

  // Refs for DB record IDs (for settings persistence)
  const settingsRecordId = useRef(null);
  const botSettingsRecordId = useRef(null);
  const featherlessSettingsRecordId = useRef(null);

  // Ref for latest state (avoids stale closures in interval)
  const stateRef = useRef({});
  stateRef.current = { markets, runners, settings, paperOrders, bankrollStats, botSettings, emergencyStop, botState, strategyStats, strategyLibrary, betfairConnection, syncState, apiConnected, betfairSessionToken, featherlessSettings, featherlessSettingsRecordId };

  // Ref for the Betfair Stream client
  const streamClientRef = useRef(null);

  // Ref for the market catalogue cache — the stream's marketDefinition for AU
  // racing often omits runner names (returns "Selection XXXXX"). The catalogue
  // API returns proper horse names, so we fetch it periodically and merge names
  // into the stream data by selection ID.
  const catalogueRef = useRef(null);
  const catalogueTimerRef = useRef(null);

  // Guard against overlapping bot cycles — the form analysis API call can take
  // 7-22s, which may exceed the scan interval. Without this guard, setInterval
  // would fire a new cycle while the previous one is still running.
  const cycleInProgressRef = useRef(false);

  // ── Load all app-generated data from database on mount ──
  useEffect(() => {
    let cancelled = false;
    const unsubs = [];

    const loadAll = async () => {
      try {
        setDataLoading(true);
        const [orders, signals, cycles, logs, runs, stats, aiDecls, appSettingsRecs, botSettingsRecs, featherlessRecs] = await Promise.all([
          base44.entities.PaperOrder.filter({}, '-created_date', 200).catch(() => []),
          base44.entities.StrategySignal.filter({}, '-created_date', 200).catch(() => []),
          base44.entities.BotCycle.filter({}, '-created_date', 100).catch(() => []),
          base44.entities.AuditLog.filter({}, '-created_date', 200).catch(() => []),
          base44.entities.BacktestRun.filter({}, '-created_date', 50).catch(() => []),
          base44.entities.StrategyStats.filter({}, '-created_date', 50).catch(() => []),
          base44.entities.FeatherlessAIDecision.filter({}, '-created_date', 100).catch(() => []),
          base44.entities.AppSettings.list('-created_date', 1).catch(() => []),
          base44.entities.BotSettings.list('-created_date', 1).catch(() => []),
          base44.entities.FeatherlessSettings.list('-created_date', 1).catch(() => []),
        ]);
        if (cancelled) return;
        setPaperOrders(orders);
        setStrategySignals(signals);
        setBotCycles(cycles);
        setAuditLogs(logs);
        setBacktestRuns(runs);
        setStrategyStats(stats);
        setAiDecisions(aiDecls);
        // Load persisted settings — strip DB metadata, merge with defaults so new fields are never lost
        if (appSettingsRecs && appSettingsRecs.length > 0) {
          const rec = appSettingsRecs[0];
          settingsRecordId.current = rec.id;
          const clean = stripDbMeta(rec);
          // Safety: never allow liveTradingEnabled from DB
          clean.liveTradingEnabled = false;
          setSettings(prev => ({ ...prev, ...clean }));
        }
        if (botSettingsRecs && botSettingsRecs.length > 0) {
          const rec = botSettingsRecs[0];
          botSettingsRecordId.current = rec.id;
          const clean = stripDbMeta(rec);
          clean.liveTradingEnabled = false;
          setBotSettings(prev => ({ ...prev, ...clean }));
        }
        if (featherlessRecs && featherlessRecs.length > 0) {
          const rec = featherlessRecs[0];
          featherlessSettingsRecordId.current = rec.id;
          const clean = stripDbMeta(rec);
          // Safety: never allow live handoff from DB
          clean.allowLiveHandoff = false;
          setFeatherlessSettings(prev => ({ ...prev, ...clean }));
        }
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
          if (event.type === 'create') {
            setter(prev => {
              // Deduplicate: if a local optimistic copy already exists (matched by
              // customerRef for orders, or by the same created_date), replace it
              // with the real DB record instead of adding a second entry.
              const dupIdx = prev.findIndex(i =>
                (i.customerRef && event.data.customerRef && i.customerRef === event.data.customerRef) ||
                (i.created_date && event.data.created_date && i.created_date === event.data.created_date) ||
                (i.cycleNumber != null && event.data.cycleNumber != null && i.cycleNumber === event.data.cycleNumber)
              );
              if (dupIdx >= 0) {
                const updated = [...prev];
                updated[dupIdx] = { ...prev[dupIdx], ...event.data };
                return updated;
              }
              if (prev.some(i => i.id === event.data.id)) return prev;
              return [event.data, ...prev].slice(0, maxItems);
            });
          } else if (event.type === 'update') setter(prev => prev.map(i => i.id === event.data.id ? { ...i, ...event.data } : i));
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
    subscribe('FeatherlessAIDecision', setAiDecisions);

    return () => { cancelled = true; unsubs.forEach(u => { try { u(); } catch (_) {} }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derive bankroll stats from settled paper orders (unified calculation) ──
  useEffect(() => {
    const rm = calculateRiskMetrics(paperOrders, settings);
    const settled = paperOrders.filter(o => o.status === 'settled');
    const wins = settled.filter(o => o.result === 'won').length;
    const losses = settled.filter(o => o.result === 'lost').length;
    const commissionPaid = settled.reduce((s, o) => s + (o.commission || 0), 0);
    const startingBankroll = settings.paperBankroll || settings.bankroll;
    const currentBankroll = startingBankroll + rm.totalPL;
    const totalStake = settled.reduce((s, o) => s + (o.matchedStake || o.matched_size || 0), 0);
    const roi = totalStake > 0 ? (rm.totalPL / totalStake) * 100 : 0;
    const strikeRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;

    setBankrollStats(prev => ({
      ...prev,
      bankroll: currentBankroll,
      paperBankroll: currentBankroll,
      available: currentBankroll - rm.openExposure,
      todayPL: rm.dailyPL,
      weeklyPL: rm.weeklyPL,
      totalPL: rm.totalPL,
      commissionPaid,
      openPaperExposure: rm.paperExposure,
      openLiveExposure: rm.liveExposure,
      maxDrawdown: rm.drawdown,
      longestLosingStreak: rm.longestLosingStreak,
      wins,
      losses,
      roi,
      strikeRate,
    }));
  }, [paperOrders, settings.paperBankroll, settings.bankroll, settings.dailyLossLimit, settings.weeklyLossLimit, settings.maxMarketExposure, settings.maxOpenOrders, settings.maxUnmatchedOrders]);

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
    addAuditLog('Forced Paper-Only Mode', 'mode', 'warning', 'Forced paper-only mode activated. Live trading disabled.');
    addToBotActivity('Paper-only mode forced', 'Live trading disabled system-wide');
  };

  const resetAllPaperTrading = async () => {
    // Clear from database
    await Promise.all([
      base44.entities.PaperOrder.deleteMany({}).catch(() => {}),
      base44.entities.StrategySignal.deleteMany({}).catch(() => {}),
      base44.entities.BotCycle.deleteMany({}).catch(() => {}),
      base44.entities.StrategyStats.deleteMany({}).catch(() => {}),
      base44.entities.FeatherlessAIDecision.deleteMany({}).catch(() => {}),
    ]);
    // Clear local state
    setPaperOrders([]);
    setRejectedOrders([]);
    setStrategySignals([]);
    setBotCycles([]);
    setStrategyStats([]);
    setAiDecisions([]);
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
    addAuditLog('Paper Trading Reset', 'system', 'critical', 'All paper orders, signals, bot cycles, strategy stats, AI decisions, bankroll P/L, and daily counters reset to zero.');
    addToBotActivity('Paper trading reset', 'All paper trading data cleared and bankroll reset to starting balance');
  };

  // ── Reset Daily Stats (does NOT delete paper orders) ──
  // Sets a dailyResetAt cutoff timestamp. Today metrics will only count
  // orders settled/created after this timestamp. All historical data preserved.
  const resetDailyStats = () => {
    const resetAt = new Date().toISOString();
    setSettings(prev => {
      const merged = { ...prev, dailyResetAt: resetAt };
      const payload = { ...merged, mode: 'demo' };
      if (settingsRecordId.current) {
        base44.entities.AppSettings.update(settingsRecordId.current, payload).catch(() => {});
      } else {
        base44.entities.AppSettings.create(payload).then(rec => { if (rec) settingsRecordId.current = rec.id; }).catch(() => {});
      }
      return merged;
    });
    setBankrollStats(prev => ({ ...prev, todayPL: 0 }));
    setBotState(prev => ({
      ...prev,
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
    addAuditLog('Daily Stats Reset', 'system', 'warning', `Daily reset at ${resetAt}. Daily P/L, bot daily counters, and sync daily counters reset to zero. Historical paper orders, total P/L, and analytics history are preserved. Today metrics will count only orders settled after ${resetAt}.`);
    addToBotActivity('Daily stats reset', `Cutoff set to ${resetAt} — daily counters reset, historical data preserved`);
  };

  // ── Clear All Audit Logs ──
  const clearLogs = async () => {
    await base44.entities.AuditLog.deleteMany({}).catch(() => {});
    setAuditLogs([]);
  };

  // ── Clear Decision Log (Bot Cycles) ──
  const clearBotCycles = async () => {
    await base44.entities.BotCycle.deleteMany({}).catch(() => {});
    setBotCycles([]);
    addAuditLog('Decision Log Cleared', 'system', 'warning', 'All bot cycle decision logs cleared.');
  };

  // ── Reset Strategy Data Only ──
  const resetStrategyData = async () => {
    await Promise.all([
      base44.entities.StrategyStats.deleteMany({}).catch(() => {}),
      base44.entities.StrategySignal.deleteMany({}).catch(() => {}),
      base44.entities.FeatherlessAIDecision.deleteMany({}).catch(() => {}),
    ]);
    setStrategyStats([]);
    setStrategySignals([]);
    setAiDecisions([]);
    addAuditLog('Strategy Data Reset', 'strategy', 'critical', 'All strategy stats, signals, and AI decisions cleared to zero.');
    addToBotActivity('Strategy data reset', 'All strategy stats, signals, and AI decisions cleared');
  };

  // Partial merge — uses functional update to avoid stale closures. Persists to DB.
  const updateSettings = (patch) => {
    setSettings(prev => {
      const merged = { ...prev, ...patch };
      addAuditLog('Settings Updated', 'settings', 'info', 'App settings updated', {
        beforeValue: JSON.stringify({ commissionRate: prev.commissionRate, allowInPlay: prev.allowInPlay }),
        afterValue: JSON.stringify({ commissionRate: patch.commissionRate ?? prev.commissionRate, allowInPlay: patch.allowInPlay ?? prev.allowInPlay }),
      });
      const payload = { ...merged, mode: 'demo' };
      if (settingsRecordId.current) {
        base44.entities.AppSettings.update(settingsRecordId.current, payload).catch(() => {});
      } else {
        base44.entities.AppSettings.create(payload).then(rec => { if (rec) settingsRecordId.current = rec.id; }).catch(() => {});
      }
      return merged;
    });
  };

  // Partial merge for bot settings — functional update. Persists to DB.
  const updateBotSettings = (patch) => {
    setBotSettings(prev => {
      const merged = { ...prev, ...patch };
      addAuditLog('Bot Settings Updated', 'settings', 'info', 'Bot configuration updated');
      const payload = { ...merged, botMode: 'demo' };
      if (botSettingsRecordId.current) {
        base44.entities.BotSettings.update(botSettingsRecordId.current, payload).catch(() => {});
      } else {
        base44.entities.BotSettings.create(payload).then(rec => { if (rec) botSettingsRecordId.current = rec.id; }).catch(() => {});
      }
      return merged;
    });
  };

  // Persist Featherless AI settings to DB
  const updateFeatherlessSettings = (patch) => {
    setFeatherlessSettings(prev => {
      const merged = { ...prev, ...patch };
      if (featherlessSettingsRecordId.current) {
        base44.entities.FeatherlessSettings.update(featherlessSettingsRecordId.current, merged).catch(() => {});
      } else {
        base44.entities.FeatherlessSettings.create(merged).then(rec => { if (rec) featherlessSettingsRecordId.current = rec.id; }).catch(() => {});
      }
      return merged;
    });
  };

  // ── Betfair Connection ──
  const updateBetfairConnection = (updates) => {
    setBetfairConnection(prev => ({ ...prev, ...updates }));
  };

  // Full disconnect — clears all connection state so UI never shows connected
  const disconnectBetfair = () => {
    setApiConnected(false);
    setBetfairAccount(null);
    setBetfairSessionToken(null);
    setMarkets([]);
    setRunners([]);
    setBetfairConnection(prev => ({
      ...prev,
      appKey: null,
      loginStatus: 'disconnected',
      sessionTokenStatus: 'disconnected',
      streamConnectionStatus: 'disconnected',
      dataFresh: false,
      accountFundsAvailable: false,
      currentOrdersAvailable: false,
      streamAvailable: false,
      lastMarketSyncTime: null,
      lastOrderSyncTime: null,
      lastClearedOrderSyncTime: null,
      lastCatalogueRefreshAt: null,
      lastPriceFetchAt: null,
      catalogueMarketsCount: 0,
      catalogueRunnersCount: 0,
      marketsWithPriceData: 0,
      marketCatalogueError: null,
      priceFeedStale: false,
    }));
    if (streamClientRef.current) {
      try { streamClientRef.current.disconnect(); } catch (_) {}
      streamClientRef.current = null;
    }
    addAuditLog('Betfair Disconnected', 'api', 'warning', 'Betfair account disconnected. API, session, stream, markets, and runners all cleared.');
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

        const streamConnected = currentStatus === 'connected' || currentStatus === 'polling';
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

  // ── Refresh Functions (local recalculation — not Betfair API sync) ──
  const refreshMarketState = () => {
    const now = new Date().toISOString();
    setSyncState(prev => ({ ...prev, lastCatalogueSync: now, lastMarketBookSync: now, lastRunnerPriceSync: now }));
    addAuditLog('Market State Refreshed', 'api', 'info', `Refreshed local market state: ${markets.length} markets, ${runners.length} runners in memory`);
    setBetfairConnection(prev => ({ ...prev, lastMarketSyncTime: now, dataFresh: true }));
  };

  const refreshOrderState = () => {
    const now = new Date().toISOString();
    setSyncState(prev => ({ ...prev, currentOrderSync: now }));
    const rm = calculateRiskMetrics(paperOrders, settings);
    addAuditLog('Order State Refreshed', 'api', 'info', `Refreshed order state: ${rm.activeOrderCount} open, ${rm.unmatchedOrderCount} unmatched`);
    setBetfairConnection(prev => ({ ...prev, lastOrderSyncTime: now }));
  };

  const recalculateSettledStats = () => {
    const now = new Date().toISOString();
    setSyncState(prev => ({ ...prev, clearedOrderSync: now, lastMetricRecalculation: now }));
    addAuditLog('Settled Stats Recalculated', 'api', 'info', `Recalculated settled stats: ${paperOrders.filter(o => o.status === 'settled').length} settled orders`);
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
    
    const rm = calculateRiskMetrics(paperOrders, settings);
    
    setBankrollStats(prev => ({
      ...prev,
      openPaperExposure: rm.paperExposure,
      openLiveExposure: rm.liveExposure,
      todayPL: rm.dailyPL,
      weeklyPL: rm.weeklyPL,
      totalPL: rm.totalPL,
      drawdown: rm.drawdown,
      available: prev.bankroll - rm.openExposure,
    }));
    
    addAuditLog('Risk State Recalculated', 'risk', 'info', `Paper exposure: $${rm.paperExposure.toFixed(2)}, Live exposure: $${rm.liveExposure.toFixed(2)}, Daily P/L: $${rm.dailyPL.toFixed(2)}, Drawdown: $${rm.drawdown.toFixed(2)}`);
  };

  // ── Bot Controls ──
  const startBot = () => {
    if (emergencyStop) return;
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

  // ── Debug Scan Cycle — diagnostic only, never creates orders/signals ──
  const runDebugScanCycle = async () => {
    if (cycleInProgressRef.current) return;
    cycleInProgressRef.current = true;
    try {
      const s = stateRef.current;
      if (s.emergencyStop) return;

      const cycleNum = s.botState.cycleNumber + 1;
      const now = new Date().toISOString();
      addAuditLog('Debug Scan Cycle Triggered', 'system', 'info', 'Diagnostic-only scan initiated. No orders or signals will be created.');

      const diagnostics = buildScanDiagnostics(s.markets, s.runners, s.settings, s.featherlessSettings, s.paperOrders, s.bankrollStats, s.emergencyStop);
      setLastScanDiagnostics(diagnostics);

      // Always run the exchange engine, regardless of Featherless enabled/disabled
      try {
        const debugScanMode = true; // Always true for debug scans
        const conn = s.betfairConnection || {};
        const connectionState = {
          apiConnected: s.apiConnected,
          streamConnected: conn.streamConnectionStatus === 'connected' || conn.streamConnectionStatus === 'polling',
          lastStreamUpdateAt: conn.lastMarketSyncTime || null,
          lastCatalogueRefreshAt: conn.lastMarketSyncTime || null,
          marketCatalogueError: null,
          streamError: conn.streamConnectionStatus === 'error' ? 'Stream connection error' : null,
          priceFeedStale: conn.dataFresh === false,
        };

        const aiEnabled = s.featherlessSettings?.enabled !== false;
        const result = await runExchangeCycle({
          markets: s.markets,
          runners: s.runners,
          settings: s.settings,
          featherlessSettings: { ...s.featherlessSettings, debugScanMode: true },
          bankrollStats: s.bankrollStats,
          paperOrders: s.paperOrders,
          emergencyStop: s.emergencyStop,
          connectionState,
          callAI: aiEnabled ? async (cluster, primaryMarket, marketRunners) => {
            let webResearch = null;
            if (s.featherlessSettings?.webResearchEnabled) {
              try {
                const researchResp = await base44.functions.invoke('raceWebResearch', { market: primaryMarket, runners: marketRunners });
                if (researchResp.data?.research) webResearch = researchResp.data.research;
              } catch (err) { /* skip */ }
            }
            const resp = await base44.functions.invoke('featherlessAI', {
              market: primaryMarket, runners: marketRunners, settings: s.settings,
              strategySettings: s.featherlessSettings, bankrollStats: s.bankrollStats,
              raceFormProfiles: marketRunners.map(r => r.raceFormProfile).filter(Boolean),
              webResearch,
              allEventMarkets: [...cluster.winMarkets, ...cluster.placeMarkets, ...cluster.h2hMarkets],
            });
            if (resp.data?.error) throw new Error(resp.data.error);
            return resp.data?.aiResult || null;
          } : null, // null callAI = market-only mode
          callExternalSearch: s.featherlessSettings?.externalSearchEnabled ? async (cluster, primaryMarket, marketRunners) => {
            try {
              const resp = await base44.functions.invoke('openAIWebSearch', {
                market: primaryMarket, runners: marketRunners, settings: s.featherlessSettings,
              });
              if (resp.data?.error) throw new Error(resp.data.error);
              return resp.data?.externalSearchResult || null;
            } catch (err) {
              return { searchStatus: 'error', sourceCount: 0, sources: [], runnerResearch: [], raceLevelNotes: '', dataQuality: 0, errorMessage: err.message, searchQuery: '', searchedAt: new Date().toISOString(), searchProvider: 'openai_web_search' };
            }
          } : null,
        });

        setExchangeOpportunities(result.allOpportunities);
        setLastExchangeDiagnostics(result.diagnostics);

        // Create a debug-only BotCycle record — NO signals, NO orders, NO bankroll changes
        const cycleRecord = {
          cycleNumber: cycleNum,
          botMode: 'paper',
          startedAt: now,
          finishedAt: new Date().toISOString(),
          status: 'completed',
          debugOnly: true,
          marketsScanned: result.diagnostics.totalMarketsLoaded ?? result.diagnostics.marketsScanned ?? 0,
          marketsPassedFilters: result.diagnostics.marketsSentToExchangeEngine ?? 0,
          signalsCreated: 0, // Never create signals in debug mode
          ordersCreated: 0, // Never create orders in debug mode
          ordersBlocked: 0,
          errors: 0,
          notes: `Debug scan: ${result.diagnostics.totalOpportunities || 0} opportunities found, ${result.diagnostics.positiveEVOpportunities || 0} positive-EV. NO orders placed (debug mode).`,
          runnersAssessed: result.diagnostics.totalOpportunities || 0,
          candidatesPassedLiquidity: 0,
          candidatesPassedOddsRange: 0,
          candidatesPassedEdge: result.diagnostics.positiveEVOpportunities || 0,
          candidatesPassedROI: result.diagnostics.positiveEVOpportunities || 0,
          candidatesPassedConfidence: result.diagnostics.positiveEVOpportunities || 0,
          bestCandidate: result.bestOpportunity ? {
            opportunityId: result.bestOpportunity.opportunityId,
            runnerName: result.bestOpportunity.runnerName,
            selectionId: result.bestOpportunity.selectionId,
            marketId: result.bestOpportunity.marketId,
            betfairMarketId: result.bestOpportunity.betfairMarketId,
            marketName: result.bestOpportunity.marketName,
            marketType: result.bestOpportunity.marketType,
            side: result.bestOpportunity.side,
            odds: result.bestOpportunity.odds,
            edge: result.bestOpportunity.edge,
            ev: result.bestOpportunity.ev,
            expectedROI: result.bestOpportunity.roi,
            confidence: result.bestOpportunity.confidence,
            stake: result.bestOpportunity.stake,
            liability: result.bestOpportunity.liability,
            maxProfit: result.bestOpportunity.maxProfit,
            maxLoss: result.bestOpportunity.maxLoss,
            modelProbability: result.bestOpportunity.modelProbability,
            finalProbabilityUsedInEV: result.bestOpportunity.finalProbabilityUsedInEV ?? result.bestOpportunity.modelProbability,
            marketOnlyProbability: result.bestOpportunity.marketOnlyProbability ?? null,
            openAIProbabilityAdjustment: result.bestOpportunity.openAIProbabilityAdjustment ?? 0,
            failedGate: result.bestOpportunity.failedGate || result.bestOpportunity.blockers?.[0] || null,
            mainBlocker: result.bestOpportunity.failedGate || result.bestOpportunity.blockers?.[0] || null,
            blockers: result.bestOpportunity.blockers,
            externalSearchUsed: result.bestOpportunity.externalSearchUsed || false,
            externalSearchStatus: result.bestOpportunity.externalSearchStatus || 'not_called',
            preSearchProbability: result.bestOpportunity.preSearchProbability ?? null,
            postSearchProbability: result.bestOpportunity.postSearchProbability ?? null,
            probabilityDelta: result.bestOpportunity.probabilityDelta ?? 0,
            decisionImpact: result.bestOpportunity.decisionImpact || 'no_effect',
            marketOnlyFallbackReason: result.bestOpportunity.marketOnlyFallbackReason || null,
          } : null,
          noBetReason: result.diagnostics.noBetReason || 'Debug scan — no orders placed',
          scanSummary: {
            marketsScanned: result.diagnostics.marketsScanned,
            totalMarketsLoaded: result.diagnostics.totalMarketsLoaded ?? 0,
            openPreRaceMarkets: result.diagnostics.openPreRaceMarkets ?? 0,
            marketsInsideTimeWindow: result.diagnostics.marketsInsideTimeWindow ?? 0,
            marketsSentToExchangeEngine: result.diagnostics.marketsSentToExchangeEngine ?? 0,
            eventsScanned: result.diagnostics.eventsScanned,
            eventsWithAI: result.diagnostics.eventsWithAI,
            cacheHits: result.diagnostics.cacheHits,
            totalOpportunities: result.diagnostics.totalOpportunities,
            backOpportunities: result.diagnostics.backOpportunities,
            layOpportunities: result.diagnostics.layOpportunities,
            positiveEVOpportunities: result.diagnostics.positiveEVOpportunities,
            rejectedOpportunities: result.diagnostics.rejectedOpportunities,
            winMarketsFound: result.diagnostics.winMarketsFound,
            placeMarketsFound: result.diagnostics.placeMarketsFound,
            h2hMarketsFound: result.diagnostics.h2hMarketsFound,
            unknownMarketsFound: result.diagnostics.unknownMarketsFound,
            aiCallsMade: result.diagnostics.aiCallsMade,
            aiCacheHits: result.diagnostics.aiCacheHits,
            aiDisabled: result.diagnostics.aiDisabled,
            aiStatusLog: result.diagnostics.aiStatusLog,
            marketDetectionLog: result.diagnostics.marketDetectionLog?.slice(0, 20),
            topOpportunities: result.diagnostics.topOpportunities,
            topRejected: result.diagnostics.topRejected,
            noBetReason: result.diagnostics.noBetReason,
            debugScanMode: true,
            marketFeedDiagnostics: result.diagnostics.marketFeedDiagnostics ?? null,
            timeWindowFunnel: result.diagnostics.timeWindowFunnel ?? null,
            loadedMarketsTable: result.diagnostics.loadedMarketsTable ?? null,
            connectionDiagnostics: result.diagnostics.connectionDiagnostics ?? null,
            externalSearchDiagnostics: result.diagnostics.externalSearchDiagnostics ?? null,
          },
          selectedMarketName: result.bestOpportunity?.marketName || null,
        };
        setBotCycles(prev => [{ ...cycleRecord, id: 'bc' + Date.now() + Math.random().toString(36).slice(2, 6) }, ...prev].slice(0, 100));
        base44.entities.BotCycle.create(cycleRecord).catch(() => {});

        setBotState(prev => ({ ...prev, cycleNumber: cycleNum, lastCycleTime: now }));
        addAuditLog('Debug Scan Complete', 'system', 'info', `Scanned ${cycleRecord.marketsScanned} markets, ${result.diagnostics.totalOpportunities || 0} opportunities, 0 orders (debug only).`);
        addToBotActivity('Debug scan completed', `${cycleRecord.marketsScanned} markets, ${result.diagnostics.totalOpportunities || 0} opportunities — no orders placed`);
      } catch (err) {
        addAuditLog('Debug Scan Error', 'system', 'error', `Exchange engine error: ${err.message}`);
      }
    } finally {
      cycleInProgressRef.current = false;
    }
  };

  // ── Refresh Betfair Data — calls backend to fetch REST catalogue + book data ──
  // This populates markets/runners even when the stream is disconnected.
  // Returns a result object for the UI to display.
  const refreshBetfairData = async () => {
    const s = stateRef.current;

    // Pre-flight checks
    if (!s.betfairSessionToken) {
      const msg = 'Betfair session missing. Open Setup and connect with session token.';
      addAuditLog('Refresh Failed', 'api', 'warning', msg);
      setBetfairConnection(prev => ({ ...prev, marketCatalogueError: msg }));
      return { error: msg, sessionTokenPresent: false };
    }

    addAuditLog('Betfair Catalogue Refresh', 'api', 'info', 'Fetching market catalogue + book data from Betfair REST API');
    try {
      const resp = await base44.functions.invoke('betfairMarkets', {
        sessionToken: s.betfairSessionToken,
        requestedMarketTypes: ['WIN', 'PLACE', 'MATCH_BET'],
      });

      if (resp.data?.error) throw new Error(resp.data.error);

      const catMarkets = resp.data?.markets || [];
      const catRunners = resp.data?.runners || [];
      const now = new Date().toISOString();
      const fetchedAt = resp.data?.fetchedAt || now;

      // Build catalogue name/meta maps for stream enrichment
      const nameMap = new Map();
      const metaMap = new Map();
      for (const r of catRunners) {
        const selId = String(r.betfairSelectionId || r.selectionId || '');
        if (selId) {
          nameMap.set(selId, r.runnerName || '');
          if (r.raceFormProfile) metaMap.set(selId, r.raceFormProfile);
        }
      }
      catalogueRef.current = { nameMap, metaMap, fetchedAt: Date.now() };

      // Merge catalogue data with existing (stream or cached) data
      const streamMarkets = s.markets.filter(m => m.source === 'stream' || m.source === 'merged');
      const streamRunners = s.runners.filter(r => r.source === 'stream' || r.source === 'merged');

      const merged = mergeBetfairMarkets({
        existingMarkets: s.markets,
        existingRunners: s.runners,
        catalogueMarkets: catMarkets,
        catalogueRunners: catRunners,
        streamMarkets,
        streamRunners,
      });

      // Count priced runners
      const pricedRunners = merged.runners.filter(r =>
        (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0)
      ).length;
      const marketsWithPriceData = merged.markets.filter(m => m.hasPriceData).length;

      setMarkets(merged.markets);
      setRunners(merged.runners);

      setBetfairConnection(prev => ({
        ...prev,
        lastMarketSyncTime: now,
        dataFresh: true,
        lastCatalogueRefreshAt: now,
        lastPriceFetchAt: now,
        catalogueMarketsCount: catMarkets.length,
        catalogueRunnersCount: catRunners.length,
        marketsWithPriceData,
        marketCatalogueError: null,
        priceFeedStale: pricedRunners === 0,
      }));

      setSyncState(prev => ({ ...prev, lastCatalogueSync: now }));

      const winCount = resp.data?.winMarketsReturned ?? catMarkets.filter(m => (m.marketTypeCode || m.marketType || '').toUpperCase() === 'WIN').length;
      const placeCount = resp.data?.placeMarketsReturned ?? catMarkets.filter(m => {
        const t = (m.marketTypeCode || m.marketType || '').toUpperCase();
        return t === 'PLACE' || t.includes('TO_BE_PLACED');
      }).length;
      const h2hCount = resp.data?.h2hMarketsReturned ?? catMarkets.filter(m => {
        const t = (m.marketTypeCode || m.marketType || '').toUpperCase();
        return t === 'MATCH_BET' || t.includes('HEAD') || t.includes('H2H') || t.includes('MATCH');
      }).length;

      addAuditLog('Betfair Catalogue Refreshed', 'api', 'info',
        `${catMarkets.length} markets, ${catRunners.length} runners, ${pricedRunners} priced. WIN: ${winCount}, PLACE: ${placeCount}, H2H: ${h2hCount}`);

      return {
        error: null,
        sessionTokenPresent: true,
        appKeyPresent: !!s.betfairConnection?.appKey,
        proxyUrlPresent: true, // backend would have errored if missing
        marketsReturned: catMarkets.length,
        runnersReturned: catRunners.length,
        pricedRunnersReturned: pricedRunners,
        winMarketsReturned: winCount,
        placeMarketsReturned: placeCount,
        h2hMarketsReturned: h2hCount,
        receivedMarketTypes: resp.data?.receivedMarketTypes || [],
        isDelayed: resp.data?.isDelayed || false,
        rawMarketCount: resp.data?.rawMarketCount || 0,
        rawBookCount: resp.data?.rawBookCount || 0,
        firstMarketName: catMarkets[0]?.marketName || null,
        firstMarketStartTime: catMarkets[0]?.startTime || catMarkets[0]?.marketStartTime || null,
        firstMarketId: catMarkets[0]?.betfairMarketId || null,
        marketsInMemory: merged.markets.length,
        marketsWithPriceData,
        errors: resp.data?.errors || [],
      };
    } catch (err) {
      setBetfairConnection(prev => ({ ...prev, marketCatalogueError: err.message }));
      addAuditLog('Betfair Catalogue Refresh Failed', 'api', 'error', err.message);
      return { error: err.message, sessionTokenPresent: true };
    }
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
  runBotCycleRef.current = async () => {
    if (cycleInProgressRef.current) return;
    cycleInProgressRef.current = true;
    try {
    const s = stateRef.current;
    if (s.emergencyStop) return;

    // Run candidate scoring diagnostics for transparency — always runs
    const diagnostics = buildScanDiagnostics(s.markets, s.runners, s.settings, s.featherlessSettings, s.paperOrders, s.bankrollStats, s.emergencyStop);
    setLastScanDiagnostics(diagnostics);

    const cycleNum = s.botState.cycleNumber + 1;
    const now = new Date().toISOString();
    const steps = BOT_STEPS.map(name => ({ name, status: 'waiting' }));

    let marketsScanned = 0, marketsPassed = 0, signalsCreated = 0, ordersCreated = 0, ordersBlocked = 0, errors = 0;
    const notes = [];
    let signalCreated = null, orderCreated = null, riskBlockedReason = null, rejectedOrder = null;
    let cycleNoBetReason = diagnostics?.noBetReason || null;
    let exchangeDiag = null;
    let exchangeBestOpp = null;
    let exchangeAllOpps = [];

    // ── Exchange Opportunity Engine ──
    // Scans ALL eligible markets, groups by event, calls AI per event for
    // probabilities, generates BACK + LAY opportunities across WIN/PLACE/H2H,
    // runs deterministic exchange EV maths, ranks by EV, picks best.
    // The engine ALWAYS runs — when Featherless AI is disabled, it uses
    // market-only probabilities (implied from Betfair prices).
    const aiEnabled = s.featherlessSettings?.enabled !== false;
    const debugScanModeActive = s.featherlessSettings?.debugScanMode === true;
    steps[0].status = 'passed';
    steps[1].status = 'passed';
    steps[2].status = 'passed';
    steps[3].status = aiEnabled ? 'passed' : 'passed'; // Engine always runs
    if (!aiEnabled) steps[3].reason = 'Featherless AI disabled — using market-only probabilities';

    // When debug scan mode is active, force diagnostic-only mode
    const forceDebugOnly = debugScanModeActive;

    if (true) { // Always run the exchange engine
      try {
        const debugScanMode = debugScanModeActive;
        const conn = s.betfairConnection || {};
        const connectionState = {
          apiConnected: s.apiConnected,
          streamConnected: conn.streamConnectionStatus === 'connected' || conn.streamConnectionStatus === 'polling',
          lastStreamUpdateAt: conn.lastMarketSyncTime || null,
          lastCatalogueRefreshAt: conn.lastMarketSyncTime || null,
          marketCatalogueError: null,
          streamError: conn.streamConnectionStatus === 'error' ? 'Stream connection error' : null,
          priceFeedStale: conn.dataFresh === false,
        };
        const result = await runExchangeCycle({
          markets: s.markets,
          runners: s.runners,
          settings: s.settings,
          featherlessSettings: s.featherlessSettings,
          bankrollStats: s.bankrollStats,
          paperOrders: s.paperOrders,
          emergencyStop: s.emergencyStop,
          connectionState,
          callAI: async (cluster, primaryMarket, marketRunners) => {
            let webResearch = null;
            if (s.featherlessSettings?.webResearchEnabled) {
              try {
                const researchResp = await base44.functions.invoke('raceWebResearch', { market: primaryMarket, runners: marketRunners });
                if (researchResp.data?.research) webResearch = researchResp.data.research;
              } catch (err) { notes.push(`Web research error: ${err.message}`); }
            }
            const resp = await base44.functions.invoke('featherlessAI', {
              market: primaryMarket, runners: marketRunners, settings: s.settings,
              strategySettings: s.featherlessSettings, bankrollStats: s.bankrollStats,
              raceFormProfiles: marketRunners.map(r => r.raceFormProfile).filter(Boolean),
              webResearch,
              allEventMarkets: [...cluster.winMarkets, ...cluster.placeMarkets, ...cluster.h2hMarkets],
            });
            if (resp.data?.error) throw new Error(resp.data.error);
            return resp.data?.aiResult || null;
          },
          callExternalSearch: s.featherlessSettings?.externalSearchEnabled ? async (cluster, primaryMarket, marketRunners) => {
            try {
              const resp = await base44.functions.invoke('openAIWebSearch', {
                market: primaryMarket,
                runners: marketRunners,
                settings: s.featherlessSettings,
              });
              if (resp.data?.error) throw new Error(resp.data.error);
              return resp.data?.externalSearchResult || null;
            } catch (err) {
              notes.push(`External search error: ${err.message}`);
              return {
                searchStatus: err.message?.toLowerCase().includes('timeout') ? 'timeout' : 'error',
                sourceCount: 0, sources: [], runnerResearch: [], raceLevelNotes: '',
                dataQuality: 0, errorMessage: err.message, searchQuery: '',
                searchedAt: new Date().toISOString(), searchProvider: 'openai_web_search',
              };
            }
          } : null,
        });

        marketsScanned = result.diagnostics.marketsScanned;
        marketsPassed = result.eventClusters.length;
        setExchangeOpportunities(result.allOpportunities);
        setLastExchangeDiagnostics(result.diagnostics);
        exchangeDiag = result.diagnostics;
        exchangeBestOpp = result.bestOpportunity;
        exchangeAllOpps = result.allOpportunities;

        if (result.bestOpportunity) {
          const opp = result.bestOpportunity;
          const runner = s.runners.find(r =>
            String(r.betfairSelectionId || r.selectionId) === opp.selectionId &&
            (r.marketId === opp.marketId || r.marketId === opp.betfairMarketId)
          );
          const market = s.markets.find(m => m.id === opp.marketId || m.betfairMarketId === opp.betfairMarketId);

          if (runner && market) {
            const strategyName = 'Featherless AI Value Decision Engine';
            const signal = opportunityToSignal(opp, s.settings);
            signal.runnerId = runner.id;
            signalCreated = signal;
            signalsCreated = 1;
            steps[4].status = 'passed';
            steps[4].reason = `${opp.marketType} ${opp.side} ${opp.runnerName} — EV $${opp.ev.toFixed(2)}, ROI ${(opp.roi * 100).toFixed(1)}%`;

            setStrategySignals(prev => [{ ...signal, id: 'ss' + Date.now() + Math.random().toString(36).slice(2, 6) }, ...prev].slice(0, 100));
            if (!forceDebugOnly) base44.entities.StrategySignal.create(signal).catch(() => {});

            const connectionState = { apiConnected: s.apiConnected, betfairSessionToken: s.betfairSessionToken, dataFresh: s.betfairConnection?.dataFresh ?? true };
            const strategy = s.strategyLibrary?.find(sl => sl.name === strategyName);
            const preCheck = runPreOrderChecks(
              { marketId: market.id, selectionId: runner.betfairSelectionId, runnerId: runner.id, side: signal.side, price: signal.odds, size: signal.stakeSuggestion, strategyName, persistenceType: signal.persistenceType, dataSource: signal.dataSource, eventId: opp.eventId },
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
              if (rejectedOrder) { setRejectedOrders(prev => [rejectedOrder, ...prev].slice(0, 100)); setSyncState(prev2 => ({ ...prev2, ordersRejectedToday: prev2.ordersRejectedToday + 1, lastRejectedReason: preCheck.failures[0].reason })); }
            } else {
              steps[5].status = 'passed';
              const risk = runRiskCheck(signal, s.settings, s.bankrollStats, s.paperOrders);
              if (!risk.passed) {
                steps[6].status = 'blocked';
                steps[6].reason = risk.reasons[0];
                ordersBlocked = 1;
                riskBlockedReason = risk.reasons[0];
                notes.push(`Risk blocked: ${risk.reasons[0]}`);
              } else {
                steps[6].status = 'passed';
                if (!s.botState.paused && s.botSettings.autoPaperTradingEnabled && !forceDebugOnly) {
                  const order = createPaperOrder(signal, market, runner, s.settings);
                  order.marketType = opp.marketType;
                  order.eventId = opp.eventId;
                  order.liability = opp.liability;
                  order.commissionRateUsed = opp.commissionRate;
                  // Force LAPSE in all bot-created orders
                  order.persistenceType = 'LAPSE';
                  // Pass through proof mode fields
                  if (opp.proofMode) {
                    order.proofMode = true;
                    order.dataSource = 'MARKET_ONLY_PROOF';
                  }
                  orderCreated = order;
                  ordersCreated = 1;
                  steps[7].status = 'passed';
                  steps[8].status = 'passed';
                  setPaperOrders(prev => [{ ...order, id: 'po' + Date.now() + Math.random().toString(36).slice(2, 6), created_date: now, placed_date: now }, ...prev].slice(0, 200));
                  if (!forceDebugOnly) base44.entities.PaperOrder.create(order).catch(() => {});
                  setSyncState(prev2 => ({ ...prev2, ordersCreatedToday: prev2.ordersCreatedToday + 1 }));
                } else {
                  steps[7].status = 'blocked';
                  steps[7].reason = 'Bot is paused or auto paper trading is disabled.';
                }
              }
            }
          }
        } else {
          steps[4].status = 'blocked';
          steps[4].reason = result.diagnostics.noBetReason || 'No positive-EV opportunities found across WIN/PLACE/H2H markets';
          notes.push(steps[4].reason);
          cycleNoBetReason = steps[4].reason;
        }
      } catch (err) {
        const errMsg = err.response?.data?.error || err.message;
        const isAuthError = err.response?.status === 401 || errMsg.includes('401') || errMsg.toLowerCase().includes('authentication');
        steps[4].status = 'failed';
        steps[4].reason = isAuthError ? 'Session expired — redirecting to login...' : `Exchange engine error: ${errMsg}`;
        notes.push(steps[4].reason);
        errors = 1;
        if (isAuthError) {
          stopBot();
          addAuditLog('Bot Stopped — Session Expired', 'system', 'critical', 'User session token expired. Redirecting to login for a fresh token.');
          setTimeout(() => { window.location.href = '/login'; }, 1500);
        }
      }
    }

    setSyncState(prev => ({ ...prev, marketsScannedToday: prev.marketsScannedToday + marketsScanned, runnersScannedToday: prev.runnersScannedToday + s.runners.length }));
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

    // ── Build cycle record using exchange engine as primary source ──
    // When the exchange engine ran, use its diagnostics exclusively.
    // Only fall back to old scanDiagnostics when AI is disabled.
    const useExchange = !!exchangeDiag;
    const bestOppForRecord = useExchange ? exchangeBestOpp : null;
    const oldBestCandidate = !useExchange ? (diagnostics?.bestCandidate || null) : null;

    const cycleRecord = {
      cycleNumber: cycleNum,
      botMode: 'paper',
      startedAt: now,
      finishedAt: new Date().toISOString(),
      status: errors > 0 ? 'failed' : ordersBlocked > 0 ? 'blocked' : 'completed',
      marketsScanned: useExchange ? (exchangeDiag.totalMarketsLoaded ?? exchangeDiag.marketsScanned ?? 0) : marketsScanned,
      marketsPassedFilters: useExchange ? (exchangeDiag.marketsSentToExchangeEngine ?? marketsPassed) : marketsPassed,
      signalsCreated,
      ordersCreated,
      ordersBlocked,
      errors,
      notes: notes.join('; ') || 'Cycle completed',
      // Use exchange diagnostics for runner/opportunity counts when available
      runnersAssessed: useExchange ? (exchangeDiag.totalOpportunities || 0) : (diagnostics?.scanSummary?.runnersAssessed || 0),
      candidatesPassedLiquidity: useExchange ? 0 : (diagnostics?.scanSummary?.candidatesPassedLiquidity || 0),
      candidatesPassedOddsRange: useExchange ? 0 : (diagnostics?.scanSummary?.candidatesPassedOddsRange || 0),
      candidatesPassedEdge: useExchange ? exchangeDiag.positiveEVOpportunities : (diagnostics?.scanSummary?.candidatesPassedEdge || 0),
      candidatesPassedROI: useExchange ? exchangeDiag.positiveEVOpportunities : (diagnostics?.scanSummary?.candidatesPassedROI || 0),
      candidatesPassedConfidence: useExchange ? exchangeDiag.positiveEVOpportunities : (diagnostics?.scanSummary?.candidatesPassedConfidence || 0),
      bestCandidate: useExchange
        ? (bestOppForRecord ? {
            opportunityId: bestOppForRecord.opportunityId,
            runnerName: bestOppForRecord.runnerName,
            selectionId: bestOppForRecord.selectionId,
            marketId: bestOppForRecord.marketId,
            betfairMarketId: bestOppForRecord.betfairMarketId,
            marketName: bestOppForRecord.marketName,
            marketType: bestOppForRecord.marketType,
            marketTypeCode: bestOppForRecord.marketTypeCode,
            detectedMarketType: bestOppForRecord.detectedMarketType,
            eventName: bestOppForRecord.eventName,
            marketStartTime: bestOppForRecord.marketStartTime,
            side: bestOppForRecord.side,
            odds: bestOppForRecord.odds,
            edge: bestOppForRecord.edge,
            ev: bestOppForRecord.ev,
            expectedROI: bestOppForRecord.roi,
            confidence: bestOppForRecord.confidence,
            dataQuality: bestOppForRecord.dataQuality,
            dataSource: bestOppForRecord.dataSource || 'BETFAIR_METADATA_PLUS_MARKET',
            liquidity: bestOppForRecord.availableSize,
            availableSize: bestOppForRecord.availableSize,
            spread: bestOppForRecord.spreadTicks,
            spreadTicks: bestOppForRecord.spreadTicks,
            bestBackPrice: bestOppForRecord.bestBackPrice,
            bestLayPrice: bestOppForRecord.bestLayPrice,
            bestBackSize: bestOppForRecord.bestBackSize,
            bestLaySize: bestOppForRecord.bestLaySize,
            stake: bestOppForRecord.stake,
            liability: bestOppForRecord.liability,
            maxProfit: bestOppForRecord.maxProfit,
            maxLoss: bestOppForRecord.maxLoss,
            commissionRate: bestOppForRecord.commissionRate,
            estimatedProbability: bestOppForRecord.modelProbability,
            modelProbability: bestOppForRecord.modelProbability,
            impliedProbability: bestOppForRecord.impliedProbability,
            breakevenProbability: bestOppForRecord.breakevenProbability,
            fairOdds: bestOppForRecord.fairOdds,
            opponentSelectionId: bestOppForRecord.opponentSelectionId,
            delayRiskScore: bestOppForRecord.delayRiskScore,
            fillProbability: bestOppForRecord.fillProbability,
            failedGate: bestOppForRecord.failedGate || bestOppForRecord.blockers?.[0] || null,
            mainBlocker: bestOppForRecord.failedGate || bestOppForRecord.blockers?.[0] || null,
            blockers: bestOppForRecord.blockers,
            passed: bestOppForRecord.decision === 'BET',
            decision: bestOppForRecord.decision,
            overallScore: bestOppForRecord.ev,
            externalSearchUsed: bestOppForRecord.externalSearchUsed || false,
            externalSearchStatus: bestOppForRecord.externalSearchStatus || 'not_called',
            externalSourceCount: bestOppForRecord.externalSourceCount || 0,
            externalDataQuality: bestOppForRecord.externalDataQuality || 0,
            preSearchProbability: bestOppForRecord.preSearchProbability ?? null,
            postSearchProbability: bestOppForRecord.postSearchProbability ?? null,
            probabilityDelta: bestOppForRecord.probabilityDelta ?? 0,
            preSearchConfidence: bestOppForRecord.preSearchConfidence ?? null,
            postSearchConfidence: bestOppForRecord.postSearchConfidence ?? null,
            confidenceDelta: bestOppForRecord.confidenceDelta ?? 0,
            externalSearchSummary: bestOppForRecord.externalSearchSummary || '',
            decisionImpact: bestOppForRecord.decisionImpact || 'no_effect',
            marketOnlyFallbackReason: bestOppForRecord.marketOnlyFallbackReason || null,
          } : null)
        : oldBestCandidate,
      noBetReason: ordersCreated > 0 ? null : (cycleNoBetReason || (useExchange ? exchangeDiag.noBetReason : diagnostics?.noBetReason) || null),
      scanSummary: useExchange ? {
        marketsScanned: exchangeDiag.marketsScanned,
        totalMarketsLoaded: exchangeDiag.totalMarketsLoaded ?? 0,
        openPreRaceMarkets: exchangeDiag.openPreRaceMarkets ?? 0,
        marketsInsideTimeWindow: exchangeDiag.marketsInsideTimeWindow ?? 0,
        eligibleMarketsAfterRunnerFilter: exchangeDiag.eligibleMarketsAfterRunnerFilter ?? 0,
        eligibleMarketsAfterPriceFilter: exchangeDiag.eligibleMarketsAfterPriceFilter ?? 0,
        marketsSentToExchangeEngine: exchangeDiag.marketsSentToExchangeEngine ?? 0,
        eventsScanned: exchangeDiag.eventsScanned,
        eventsWithAI: exchangeDiag.eventsWithAI,
        cacheHits: exchangeDiag.cacheHits,
        totalOpportunities: exchangeDiag.totalOpportunities,
        backOpportunities: exchangeDiag.backOpportunities,
        layOpportunities: exchangeDiag.layOpportunities,
        positiveEVOpportunities: exchangeDiag.positiveEVOpportunities,
        rejectedOpportunities: exchangeDiag.rejectedOpportunities,
        winMarketsFound: exchangeDiag.winMarketsFound,
        placeMarketsFound: exchangeDiag.placeMarketsFound,
        h2hMarketsFound: exchangeDiag.h2hMarketsFound,
        unknownMarketsFound: exchangeDiag.unknownMarketsFound,
        raceClustersCreated: exchangeDiag.raceClustersCreated,
        aiCallsMade: exchangeDiag.aiCallsMade,
        aiCacheHits: exchangeDiag.aiCacheHits,
        aiDisabled: exchangeDiag.aiDisabled,
        aiStatusLog: exchangeDiag.aiStatusLog,
        marketDetectionLog: exchangeDiag.marketDetectionLog?.slice(0, 20),
        topOpportunities: exchangeDiag.topOpportunities,
        topRejected: exchangeDiag.topRejected,
        noBetReason: exchangeDiag.noBetReason,
        debugScanMode: exchangeDiag.debugScanMode ?? false,
        marketFeedDiagnostics: exchangeDiag.marketFeedDiagnostics ?? null,
        timeWindowFunnel: exchangeDiag.timeWindowFunnel ?? null,
        loadedMarketsTable: exchangeDiag.loadedMarketsTable ?? null,
        connectionDiagnostics: exchangeDiag.connectionDiagnostics ?? null,
        externalSearchDiagnostics: exchangeDiag.externalSearchDiagnostics ?? null,
      } : (diagnostics?.scanSummary || null),
      assessedRunners: useExchange ? (exchangeDiag.topOpportunities || []) : (diagnostics?.assessedRunners || []),
      selectedMarketName: useExchange
        ? (bestOppForRecord ? bestOppForRecord.marketName : null)
        : (diagnostics?.selectedMarket
          ? (diagnostics.selectedMarket.venue
            ? `${diagnostics.selectedMarket.venue} - ${diagnostics.selectedMarket.marketName}`
            : diagnostics.selectedMarket.marketName)
          : null),
    };
    setBotCycles(prev => [{ ...cycleRecord, id: 'bc' + Date.now() + Math.random().toString(36).slice(2, 6) }, ...prev].slice(0, 100));
    base44.entities.BotCycle.create(cycleRecord).catch(() => {});

    // Update lastScanDiagnostics with the actual cycle reason so the dashboard
    // WhyNoBetPanel shows the real blocker, not just the candidate-scoring reason.
    if (cycleNoBetReason && cycleNoBetReason !== diagnostics?.noBetReason) {
      setLastScanDiagnostics(prev => prev ? { ...prev, noBetReason: cycleNoBetReason } : prev);
    }

    setSyncState(prev => ({ ...prev, signalsGeneratedToday: prev.signalsGeneratedToday + signalsCreated }));

    addToBotActivity('Market scanned', `${marketsScanned} markets scanned, ${marketsPassed} passed filters`);
    if (signalCreated) {
      const signalMarket = s.markets.find(m => m.id === signalCreated.marketId || m.betfairMarketId === signalCreated.betfairMarketId);
      addToBotActivity('Signal created', `${signalCreated.strategyName} on ${signalMarket?.marketName || signalCreated.betfairMarketId} — edge ${fmtPct(signalCreated.edgePercent)}, spread ${signalCreated.spreadTicks} ticks`);
    }
    if (orderCreated) {
      addToBotActivity('Paper order submitted', `${orderCreated.side} ${orderCreated.runnerName} @ ${orderCreated.requestedOdds} × $${orderCreated.requestedStake} (${orderCreated.persistenceType})`);
      addToBotActivity('Paper order matched', `${orderCreated.runnerName} — ${orderCreated.status} (sim quality: ${orderCreated.paperSimulationQuality})`);
    }
    if (riskBlockedReason) {
      addToBotActivity('Risk blocked', riskBlockedReason);
    }
    } finally {
      cycleInProgressRef.current = false;
    }
  };

  // ── Paper Proof Mode: Apply Defaults ──
  const applyPaperProofDefaults = async () => {
    // Merge proof defaults into all three settings entities
    const newSettings = { ...settings, ...PAPER_PROOF_APP_SETTINGS };
    const newBotSettings = { ...botSettings, ...PAPER_PROOF_BOT_SETTINGS };
    const newFeatherlessSettings = { ...featherlessSettings, ...PAPER_PROOF_FEATHERLESS_SETTINGS };

    // Safety: force live trading off
    newSettings.liveTradingEnabled = false;
    newBotSettings.liveTradingEnabled = false;
    newBotSettings.liveTradingLocked = true;
    newFeatherlessSettings.allowLiveHandoff = false;

    setSettings(newSettings);
    setBotSettings(newBotSettings);
    setFeatherlessSettings(newFeatherlessSettings);

    // Persist to DB
    const settingsPayload = { ...newSettings, mode: 'demo' };
    if (settingsRecordId.current) {
      base44.entities.AppSettings.update(settingsRecordId.current, settingsPayload).catch(() => {});
    } else {
      base44.entities.AppSettings.create(settingsPayload).then(rec => { if (rec) settingsRecordId.current = rec.id; }).catch(() => {});
    }
    const botPayload = { ...newBotSettings, botMode: 'paper_proof' };
    if (botSettingsRecordId.current) {
      base44.entities.BotSettings.update(botSettingsRecordId.current, botPayload).catch(() => {});
    } else {
      base44.entities.BotSettings.create(botPayload).then(rec => { if (rec) botSettingsRecordId.current = rec.id; }).catch(() => {});
    }
    if (featherlessSettingsRecordId.current) {
      base44.entities.FeatherlessSettings.update(featherlessSettingsRecordId.current, newFeatherlessSettings).catch(() => {});
    } else {
      base44.entities.FeatherlessSettings.create(newFeatherlessSettings).then(rec => { if (rec) featherlessSettingsRecordId.current = rec.id; }).catch(() => {});
    }

    addAuditLog('Paper Proof Mode Applied', 'mode', 'info',
      'Paper Proof Mode defaults applied. All filters relaxed. Live trading disabled and locked. Tiny paper stakes ($2). LAPSE only.');
    addToBotActivity('Paper Proof Mode activated', 'All settings set to proof defaults. Pipeline testing mode.');
  };

  // ── Paper Proof Mode: Run Proof Scan ──
  const runProofScan = async () => {
    if (cycleInProgressRef.current) return { error: 'A scan is already in progress' };
    cycleInProgressRef.current = true;
    try {
      const s = stateRef.current;
      if (s.emergencyStop) return { error: 'Emergency stop is active' };

      const proofMode = isPaperProofModeActive(s.settings, s.botSettings, s.featherlessSettings);
      if (!proofMode) {
        addAuditLog('Proof Scan Skipped', 'system', 'warning', 'Paper Proof Mode is not active. Apply proof defaults first.');
        return { error: 'Paper Proof Mode is not active. Apply proof defaults first.' };
      }

      // Require real market data — do not silently use mock data
      const marketsInMemory = s.markets.length;
      const runnersInMemory = s.runners.length;
      const runnersWithPrices = s.runners.filter(r =>
        (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0)
      ).length;

      if (marketsInMemory === 0 || runnersInMemory === 0 || runnersWithPrices === 0) {
        const msg = `Cannot run real proof scan — no Betfair markets/prices are loaded. Markets: ${marketsInMemory}, Runners: ${runnersInMemory}, Priced: ${runnersWithPrices}. Fetch Betfair Markets first.`;
        addAuditLog('Proof Scan Blocked', 'system', 'warning', msg);
        return { error: msg, marketsInMemory, runnersInMemory, runnersWithPrices };
      }

      addAuditLog('Proof Scan Started', 'system', 'info', 'Paper Proof scan initiated — relaxed filters, creating at most one paper order.');

      const conn = s.betfairConnection || {};
      const connectionState = {
        apiConnected: s.apiConnected,
        streamConnected: conn.streamConnectionStatus === 'connected' || conn.streamConnectionStatus === 'polling',
        lastStreamUpdateAt: conn.lastMarketSyncTime || null,
        lastCatalogueRefreshAt: conn.lastMarketSyncTime || null,
        marketCatalogueError: null,
        streamError: conn.streamConnectionStatus === 'error' ? 'Stream connection error' : null,
        priceFeedStale: conn.dataFresh === false,
      };

      const aiEnabled = s.featherlessSettings?.enabled !== false;
      const result = await runExchangeCycle({
        markets: s.markets,
        runners: s.runners,
        settings: s.settings,
        featherlessSettings: s.featherlessSettings,
        bankrollStats: s.bankrollStats,
        paperOrders: s.paperOrders,
        emergencyStop: s.emergencyStop,
        connectionState,
        callAI: aiEnabled ? async (cluster, primaryMarket, marketRunners) => {
          let webResearch = null;
          if (s.featherlessSettings?.webResearchEnabled) {
            try {
              const researchResp = await base44.functions.invoke('raceWebResearch', { market: primaryMarket, runners: marketRunners });
              if (researchResp.data?.research) webResearch = researchResp.data.research;
            } catch (err) { /* skip */ }
          }
          const resp = await base44.functions.invoke('featherlessAI', {
            market: primaryMarket, runners: marketRunners, settings: s.settings,
            strategySettings: s.featherlessSettings, bankrollStats: s.bankrollStats,
            raceFormProfiles: marketRunners.map(r => r.raceFormProfile).filter(Boolean),
            webResearch,
            allEventMarkets: [...cluster.winMarkets, ...cluster.placeMarkets, ...cluster.h2hMarkets],
          });
          if (resp.data?.error) throw new Error(resp.data.error);
          return resp.data?.aiResult || null;
        } : null,
        callExternalSearch: null, // Proof mode never uses external search
      });

      setExchangeOpportunities(result.allOpportunities);
      setLastExchangeDiagnostics(result.diagnostics);

      const positiveEV = result.diagnostics.positiveEVOpportunities || 0;
      const proofFallbackUsed = result.bestOpportunity?.proofMode === true;

      let paperOrderCreated = false;
      let orderStatus = null;
      let settlementStatus = null;

      if (result.bestOpportunity) {
        const opp = result.bestOpportunity;
        const runner = s.runners.find(r =>
          String(r.betfairSelectionId || r.selectionId) === opp.selectionId &&
          (r.marketId === opp.marketId || r.marketId === opp.betfairMarketId)
        );
        const market = s.markets.find(m => m.id === opp.marketId || m.betfairMarketId === opp.betfairMarketId);

        if (runner && market) {
          const signal = opportunityToSignal(opp, s.settings);
          signal.runnerId = runner.id;
          signal.proofMode = true;
          signal.dataSource = 'MARKET_ONLY_PROOF';

          setStrategySignals(prev => [{ ...signal, id: 'ss' + Date.now() + Math.random().toString(36).slice(2, 6) }, ...prev].slice(0, 100));
          base44.entities.StrategySignal.create(signal).catch(() => {});

          // Create paper order directly — bypass pre-order checks in proof mode
          // (the exchange engine already validated hard blockers)
          const order = createPaperOrder(signal, market, runner, s.settings);
          order.marketType = opp.marketType;
          order.eventId = opp.eventId;
          order.liability = opp.liability;
          order.commissionRateUsed = opp.commissionRate;
          order.proofMode = true;
          order.persistenceType = 'LAPSE'; // Force LAPSE
          order.dataSource = 'MARKET_ONLY_PROOF';

          const newOrder = { ...order, id: 'po' + Date.now() + Math.random().toString(36).slice(2, 6), created_date: new Date().toISOString(), placed_date: new Date().toISOString() };
          setPaperOrders(prev => [newOrder, ...prev].slice(0, 200));
          base44.entities.PaperOrder.create(order).catch(() => {});
          setSyncState(prev => ({ ...prev, ordersCreatedToday: prev.ordersCreatedToday + 1 }));

          paperOrderCreated = true;
          orderStatus = order.status;
          settlementStatus = order.status === 'matched' || order.status === 'partially_matched' ? 'awaiting_result' : 'not_applicable';

          addAuditLog('Proof Order Created', 'order', 'info',
            `${order.side} ${order.runnerName} @ ${order.requestedOdds} × $${order.requestedStake} (${order.persistenceType}) — proof fallback: ${proofFallbackUsed}`);
          addToBotActivity('Proof order created', `${order.side} ${order.runnerName} @ ${order.requestedOdds} × $${order.requestedStake}`);
        }
      }

      // Build cycle record
      const cycleNum = s.botState.cycleNumber + 1;
      const now = new Date().toISOString();
      const cycleRecord = {
        cycleNumber: cycleNum,
        botMode: 'paper_proof',
        startedAt: now,
        finishedAt: new Date().toISOString(),
        status: 'completed',
        paperProofMode: true,
        proofDefaultsApplied: true,
        proofFallbackUsed,
        proofReason: proofFallbackUsed ? result.bestOpportunity?.proofReason : null,
        proofStake: result.bestOpportunity?.stake || null,
        proofMaxLiability: s.settings.maxLayLiability,
        proofOrderCreated: paperOrderCreated,
        proofSettlementStatus: settlementStatus,
        marketsScanned: result.diagnostics.totalMarketsLoaded ?? result.diagnostics.marketsScanned ?? 0,
        marketsPassedFilters: result.diagnostics.marketsSentToExchangeEngine ?? 0,
        signalsCreated: paperOrderCreated ? 1 : 0,
        ordersCreated: paperOrderCreated ? 1 : 0,
        ordersBlocked: 0,
        errors: 0,
        notes: `Proof scan: ${result.diagnostics.totalOpportunities || 0} opportunities, ${positiveEV} positive-EV, fallback: ${proofFallbackUsed}, order: ${paperOrderCreated}`,
        runnersAssessed: result.diagnostics.totalOpportunities || 0,
        candidatesPassedEdge: positiveEV,
        candidatesPassedROI: positiveEV,
        candidatesPassedConfidence: positiveEV,
        bestCandidate: result.bestOpportunity ? {
          opportunityId: result.bestOpportunity.opportunityId,
          runnerName: result.bestOpportunity.runnerName,
          selectionId: result.bestOpportunity.selectionId,
          marketId: result.bestOpportunity.marketId,
          betfairMarketId: result.bestOpportunity.betfairMarketId,
          marketName: result.bestOpportunity.marketName,
          marketType: result.bestOpportunity.marketType,
          side: result.bestOpportunity.side,
          odds: result.bestOpportunity.odds,
          stake: result.bestOpportunity.stake,
          liability: result.bestOpportunity.liability,
          proofMode: result.bestOpportunity.proofMode || false,
          proofReason: result.bestOpportunity.proofReason || null,
        } : null,
        noBetReason: paperOrderCreated ? null : (result.diagnostics.noBetReason || 'No proof opportunity created'),
        scanSummary: {
          marketsScanned: result.diagnostics.marketsScanned,
          totalMarketsLoaded: result.diagnostics.totalMarketsLoaded ?? 0,
          openPreRaceMarkets: result.diagnostics.openPreRaceMarkets ?? 0,
          marketsInsideTimeWindow: result.diagnostics.marketsInsideTimeWindow ?? 0,
          marketsSentToExchangeEngine: result.diagnostics.marketsSentToExchangeEngine ?? 0,
          totalOpportunities: result.diagnostics.totalOpportunities,
          positiveEVOpportunities: positiveEV,
          proofFallbackUsed,
          paperOrderCreated,
          orderStatus,
          settlementStatus,
          paperProofMode: true,
        },
        selectedMarketName: result.bestOpportunity?.marketName || null,
      };
      setBotCycles(prev => [{ ...cycleRecord, id: 'bc' + Date.now() + Math.random().toString(36).slice(2, 6) }, ...prev].slice(0, 100));
      base44.entities.BotCycle.create(cycleRecord).catch(() => {});

      setBotState(prev => ({ ...prev, cycleNumber: cycleNum, lastCycleTime: now }));
      addAuditLog('Proof Scan Complete', 'system', 'info',
        `Markets: ${result.diagnostics.totalMarketsLoaded ?? 0}, Opportunities: ${result.diagnostics.totalOpportunities || 0}, Positive-EV: ${positiveEV}, Fallback: ${proofFallbackUsed}, Order: ${paperOrderCreated}`);

      return {
        marketsLoaded: result.diagnostics.totalMarketsLoaded ?? 0,
        marketsEligible: result.diagnostics.marketsSentToExchangeEngine ?? 0,
        opportunitiesGenerated: result.diagnostics.totalOpportunities || 0,
        positiveEVOpportunities: positiveEV,
        proofFallbackUsed,
        selectedMarket: result.bestOpportunity?.marketName || null,
        selectedRunner: result.bestOpportunity?.runnerName || null,
        side: result.bestOpportunity?.side || null,
        odds: result.bestOpportunity?.odds || null,
        stake: result.bestOpportunity?.stake || null,
        liability: result.bestOpportunity?.liability || null,
        paperOrderCreated,
        orderStatus,
        settlementStatus,
      };
    } catch (err) {
      addAuditLog('Proof Scan Error', 'system', 'error', `Proof scan error: ${err.message}`);
      return { error: err.message };
    } finally {
      cycleInProgressRef.current = false;
    }
  };

  // ── Paper Proof Mode: Run Settlement Check ──
  const runSettlementCheckNow = async () => {
    const s = stateRef.current;
    try {
      const result = await runSettlementCheck({
        paperOrders: s.paperOrders,
        markets: s.markets,
        runners: s.runners,
        settings: s.settings,
        updateOrder: async (orderId, settledOrder) => {
          setPaperOrders(prev => prev.map(o => o.id === orderId ? settledOrder : o));
          base44.entities.PaperOrder.update(orderId, settledOrder).catch(() => {});
          if (settledOrder.netProfit != null) {
            setBankrollStats(prev => ({
              ...prev,
              bankroll: prev.bankroll + settledOrder.netProfit,
              todayPL: prev.todayPL + settledOrder.netProfit,
              totalPL: prev.totalPL + settledOrder.netProfit,
              available: prev.available + settledOrder.netProfit,
              commissionPaid: prev.commissionPaid + (settledOrder.commission || 0),
              wins: settledOrder.result === 'won' ? prev.wins + 1 : prev.wins,
              losses: settledOrder.result === 'lost' ? prev.losses + 1 : prev.losses,
            }));
          }
        },
        invokeFunction: (name, payload) => base44.functions.invoke(name, payload),
        addAuditLog,
      });
      return result;
    } catch (err) {
      addAuditLog('Settlement Check Error', 'system', 'error', `Settlement check error: ${err.message}`);
      return { error: err.message };
    }
  };

  // ── Settlement Watcher — runs every 30s when there are awaiting_result orders ──
  useEffect(() => {
    const interval = setInterval(async () => {
      const s = stateRef.current;
      const hasAwaiting = s.paperOrders.some(o =>
        o.status === 'awaiting_result' ||
        (o.result === 'pending' && o.status !== 'settled' && o.status !== 'voided' && o.status !== 'lapsed' && o.status !== 'cancelled' && o.status !== 'rejected')
      );
      if (!hasAwaiting) return;
      if (cycleInProgressRef.current) return;
      try {
        await runSettlementCheckNow();
      } catch (_) {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Bot Cycle Interval ──
  useEffect(() => {
    if (!botState.running || emergencyStop) return;
    const intervalMs = (botSettings.scanIntervalSeconds || 10) * 1000;

    const initialDelay = setTimeout(() => { runBotCycleRef.current(); }, 500);
    const timer = setInterval(() => { runBotCycleRef.current(); }, intervalMs);

    return () => { clearTimeout(initialDelay); clearInterval(timer); };
  }, [botState.running, emergencyStop, botSettings.scanIntervalSeconds]);

  // ── Countdown Timer ──
  useEffect(() => {
    if (!botState.running || emergencyStop) return;
    setBotState(prev => ({ ...prev, nextScanCountdown: botSettings.scanIntervalSeconds || 10 }));
    const timer = setInterval(() => {
      setBotState(prev => ({ ...prev, nextScanCountdown: Math.max(0, prev.nextScanCountdown - 1) }));
    }, 1000);
    return () => clearInterval(timer);
  }, [botState.running, emergencyStop, botSettings.scanIntervalSeconds]);

  // ── Betfair Stream API — real-time market data via WebSocket ──
  // Connects through the Cloudflare Worker's TCP bridge to
  // stream-api.betfair.com:443 (raw TCP, bypasses Betfair's HTTP WAF
  // which 403-blocks all server-side/edge HTTP requests).
  // In live mode, ONLY stream data is used for all numbers.
  // Demo data is cleared immediately on connect; stream populates with real data.
  useEffect(() => {
    // Disconnect existing stream
    if (streamClientRef.current) {
      streamClientRef.current.disconnect();
      streamClientRef.current = null;
    }

    if (!apiConnected) {
      // Don't wipe markets — mark as stale/cached so UI still shows last known data
      setBetfairConnection(prev => ({ ...prev, dataFresh: false, streamConnectionStatus: 'disconnected', priceFeedStale: true }));
      setMarkets(prev => prev.map(m => ({ ...m, source: 'cached' })));
      setRunners(prev => prev.map(r => ({ ...r, source: 'cached' })));
      return;
    }

    // Connected — do NOT wipe catalogue data. Mark stream as connecting.
    // Catalogue data (from REST) stays visible; stream will merge on top when it connects.
    setBetfairConnection(prev => ({
      ...prev,
      dataFresh: true,
      loginStatus: 'connected',
      sessionTokenStatus: 'connected',
      streamApiEnabled: true,
      streamConnectionStatus: 'connecting',
    }));

    if (!betfairSessionToken) return;

    let cancelled = false;

    // Fetch market catalogue to get proper runner names + REST price data.
    // Uses merge helper so catalogue data populates markets even before stream connects.
    const fetchCatalogue = async () => {
      try {
        const resp = await base44.functions.invoke('betfairMarkets', {
          sessionToken: betfairSessionToken,
          requestedMarketTypes: ['WIN', 'PLACE', 'MATCH_BET'],
        });
        if (cancelled) return;
        if (resp.data?.error) throw new Error(resp.data.error);
        const catMarkets = resp.data?.markets || [];
        const catRunners = resp.data?.runners || [];
        const nameMap = new Map();
        const metaMap = new Map();
        for (const r of catRunners) {
          const selId = String(r.betfairSelectionId || r.selectionId || '');
          if (selId) {
            nameMap.set(selId, r.runnerName || '');
            if (r.raceFormProfile) metaMap.set(selId, r.raceFormProfile);
          }
        }
        catalogueRef.current = { nameMap, metaMap, fetchedAt: Date.now() };

        // Merge catalogue data with current state (stream data takes priority for prices)
        const s = stateRef.current;
        const streamMarkets = s.markets.filter(m => m.source === 'stream' || m.source === 'merged');
        const streamRunners = s.runners.filter(r => r.source === 'stream' || r.source === 'merged');
        const merged = mergeBetfairMarkets({
          existingMarkets: s.markets,
          existingRunners: s.runners,
          catalogueMarkets: catMarkets,
          catalogueRunners: catRunners,
          streamMarkets,
          streamRunners,
        });
        const pricedRunners = merged.runners.filter(r =>
          (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0)
        ).length;
        const marketsWithPriceData = merged.markets.filter(m => m.hasPriceData).length;

        setMarkets(merged.markets);
        setRunners(merged.runners);
        const now = new Date().toISOString();
        setBetfairConnection(prev => ({
          ...prev,
          lastCatalogueRefreshAt: now,
          lastPriceFetchAt: now,
          catalogueMarketsCount: catMarkets.length,
          catalogueRunnersCount: catRunners.length,
          marketsWithPriceData,
          marketCatalogueError: null,
          priceFeedStale: pricedRunners === 0,
        }));
      } catch (_) {}
    };
    fetchCatalogue();
    catalogueTimerRef.current = setInterval(fetchCatalogue, 5 * 60 * 1000);

    createBetfairStream(betfairSessionToken, {
      onMarketsUpdate: (updatedMarkets, updatedRunners) => {
        if (cancelled) return;
        // Tag stream data with source
        const taggedMarkets = updatedMarkets.map(m => ({ ...m, source: 'stream' }));
        const taggedRunners = updatedRunners.map(r => ({ ...r, source: 'stream' }));

        // Merge with existing (catalogue) data — stream prices take priority,
        // catalogue names/metadata are preserved where stream doesn't have them
        const s = stateRef.current;
        const merged = mergeBetfairMarkets({
          existingMarkets: s.markets,
          existingRunners: s.runners,
          streamMarkets: taggedMarkets,
          streamRunners: taggedRunners,
        });

        const marketsWithPriceData = merged.markets.filter(m => m.hasPriceData).length;

        setMarkets(merged.markets);
        setRunners(merged.runners);
        setBetfairConnection(prev => ({
          ...prev,
          lastMarketSyncTime: new Date().toISOString(),
          dataFresh: true,
          streamConnectionStatus: 'connected',
          loginStatus: 'connected',
          sessionTokenStatus: 'connected',
          marketsWithPriceData,
          priceFeedStale: marketsWithPriceData === 0,
        }));
      },
      onHeartbeat: () => {
        if (cancelled) return;
        setBetfairConnection(prev => ({ ...prev, lastMarketSyncTime: new Date().toISOString(), dataFresh: true }));
      },
      onStatusChange: (status) => {
        if (cancelled) return;
        if (status === 'session_expired') {
          setApiConnected(false);
          setBetfairSessionToken(null);
          addAuditLog('Betfair Session Expired', 'api', 'warning', 'Stream session expired. Please reconnect your Betfair account.');
        } else {
          setBetfairConnection(prev => ({ ...prev, streamConnectionStatus: status }));
        }
      },
      onError: (message) => {
        if (cancelled) return;
        // Worker diagnostics start with [worker] — log as info, not warning
        if (message.startsWith('[worker]')) {
          addAuditLog('Stream Diagnostics', 'api', 'info', message);
        } else {
          addAuditLog('Stream Error', 'api', 'warning', message);
        }
      },
      onMarketSettled: ({ marketId, winners, placedRunners, venue, marketName, placeTerms }) => {
        if (cancelled) return;
        const s = stateRef.current;

        // If no winners provided, we cannot settle — mark orders as awaiting_result
        const hasWinners = winners && winners.length > 0;

        for (const order of s.paperOrders) {
          if (order.result !== 'pending') continue;
          const orderMarketId = order.betfairMarketId || order.marketId;
          if (orderMarketId !== marketId) continue;

          // Unmatched orders lapse at market close
          if (order.status !== 'matched' && order.status !== 'partially_matched') {
            const lapsed = lapseUnmatchedOrder(order, `Market closed — order was not matched (${venue || ''} ${marketName || ''})`);
            setPaperOrders(prev => prev.map(o => o.id === order.id ? lapsed : o));
            base44.entities.PaperOrder.update(order.id, lapsed).catch(() => {});
            addAuditLog('Paper Order Lapsed', 'order', 'info', `${order.runnerName} — unmatched at market close (${venue || ''} ${marketName || ''})`);
            continue;
          }

          // If no winners, set to awaiting_result — do NOT guess
          if (!hasWinners) {
            const awaiting = {
              ...order,
              status: 'awaiting_result',
              settlementStatus: 'result_unknown',
              settledAt: new Date().toISOString(),
              netProfit: null,
              exitReason: 'Result unknown — no winner data from stream',
              resultSource: 'betfair_stream',
              resultConfidence: 'unknown',
            };
            setPaperOrders(prev => prev.map(o => o.id === order.id ? awaiting : o));
            base44.entities.PaperOrder.update(order.id, awaiting).catch(() => {});
            addAuditLog('Order Awaiting Result', 'order', 'warning', `${order.runnerName} — no winner data available (${venue || ''} ${marketName || ''})`);
            continue;
          }

          // Matched orders settle using real race results via settlement service
          const settled = settleOrderWithResult(order, { venue, marketName }, s.settings, {
            winners,
            placedRunners: placedRunners || [],
            placeTerms: placeTerms || null,
            resultSource: 'betfair_stream',
            marketType: order.marketType || null,
          });
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
          addAuditLog('Paper Order Settled', 'order', 'info', `${order.runnerName} ${settled.result.toUpperCase()} — Net $${settled.netProfit.toFixed(2)} (${venue || ''} ${marketName || ''})`);
        }
      },
    }).then(({ client }) => {
      if (cancelled) {
        client.disconnect();
        return;
      }
      streamClientRef.current = client;
      addAuditLog('Betfair Stream Connecting', 'api', 'info', 'WebSocket stream connecting to Betfair Stream API via TCP bridge');
    }).catch((err) => {
      if (cancelled) return;
      addAuditLog('Stream Connection Failed', 'api', 'error', `Failed to establish stream: ${err.message}`);
      setBetfairConnection(prev => ({ ...prev, streamConnectionStatus: 'error' }));
    });

    return () => {
      cancelled = true;
      if (catalogueTimerRef.current) {
        clearInterval(catalogueTimerRef.current);
        catalogueTimerRef.current = null;
      }
      if (streamClientRef.current) {
        streamClientRef.current.disconnect();
        streamClientRef.current = null;
      }
    };
  }, [apiConnected, betfairSessionToken]);

  // ── Derived mode state — single source of truth ──
  // appMode: 'paper' (no Betfair data) or 'connected_paper' (Betfair stream active, still paper trading)
  // demoMode: true when not connected to Betfair (using empty/local state only)
  // apiConnected: true only when Betfair session/API is connected
  const appMode = apiConnected ? 'connected_paper' : 'paper';
  const demoMode = !apiConnected;

  // ── Calibration from settled paper orders ──
  const calibration = useMemo(() => computeCalibration(paperOrders), [paperOrders]);

  const value = {
    emergencyStop, triggerEmergencyStop, clearEmergencyStop,
    apiConnected, setApiConnected, betfairAccount, setBetfairAccount, betfairSessionToken, setBetfairSessionToken,
    jurisdiction, setJurisdiction, notifications, setNotifications,
    betfairConnection, updateBetfairConnection, testBetfairConnection, disconnectBetfair,
    settings, updateSettings, appMode, demoMode,
    markets, runners, paperOrders, strategySignals, bankrollStats, riskStatus, heatmap,
    auditLogs, backtestRuns, plData, dataLoading,
    addPaperOrder, addRejectedOrder, addRiskEvent, addStrategySignal, addBacktestRun, addAuditLog,
    toggleWatchMarket, handleRunnerRemoval,
    rejectedOrders,
    // Refresh
    syncState, refreshMarketState, refreshBetfairData, refreshOrderState, recalculateSettledStats, recalculateMetrics, recalculateRiskState,
    // Bot
    botState, botSettings, updateBotSettings, botCycles, clearBotCycles, strategyStats, botActivity,
    startBot, pauseBot, stopBot, runManualScan, runDebugScanCycle, addToBotActivity,
    // Paper Proof Mode
    applyPaperProofDefaults, runProofScan, runSettlementCheckNow,
    // Strategy Library
    strategyLibrary,
    // Emergency controls
    cancelUnmatchedOrders, disableLiveTrading, disableStrategy, forcePaperOnly,
    resetAllPaperTrading, resetStrategyData, resetDailyStats, clearLogs,
    // Featherless AI
    featherlessSettings, setFeatherlessSettings, updateFeatherlessSettings, aiDecisions,
    lastScanDiagnostics, calibration,
    exchangeOpportunities, lastExchangeDiagnostics,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}