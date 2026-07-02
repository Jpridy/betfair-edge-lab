import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEMO_MARKETS, DEMO_RUNNERS, DEMO_PAPER_ORDERS, DEMO_STRATEGY_SIGNALS, DEMO_BANKROLL_STATS, DEMO_RISK_STATUS, DEMO_HEATMAP, DEMO_AUDIT_LOGS, DEMO_BACKTEST_RUNS, DEMO_PL_DATA } from '@/lib/demoData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [mode, setMode] = useState('paper'); // research, paper, live_locked
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
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
  const [riskStatus, setRiskStatus] = useState(DEMO_RISK_STATUS);
  const [heatmap, setHeatmap] = useState(DEMO_HEATMAP);
  const [auditLogs, setAuditLogs] = useState(DEMO_AUDIT_LOGS);
  const [backtestRuns, setBacktestRuns] = useState(DEMO_BACKTEST_RUNS);
  const [plData] = useState(DEMO_PL_DATA);

  const addAuditLog = (action, category, severity, details) => {
    const log = {
      id: 'al' + Date.now(),
      action,
      category,
      severity,
      user: 'admin',
      details,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs(prev => [log, ...prev]);
  };

  const triggerEmergencyStop = () => {
    setEmergencyStop(true);
    setMode('research');
    setPaperOrders(prev => prev.map(o =>
      o.status === 'submitted' || o.status === 'matched' || o.status === 'partially_matched'
        ? { ...o, status: 'cancelled' }
        : o
    ));
    addAuditLog('Emergency Stop Activated', 'emergency', 'critical', 'Emergency stop triggered. Live mode disabled, paper orders cancelled.');
    setNotifications(prev => prev + 1);
  };

  const clearEmergencyStop = () => {
    setEmergencyStop(false);
    addAuditLog('Emergency Stop Cleared', 'emergency', 'info', 'Emergency stop cleared. App returned to research mode.');
  };

  const changeMode = (newMode) => {
    if (newMode === 'live_locked') return;
    if (emergencyStop) return;
    setMode(newMode);
    addAuditLog('Mode Changed', 'mode', 'info', `Switched to ${newMode === 'research' ? 'Research' : newMode === 'paper' ? 'Paper Trading' : 'Live'} mode`);
  };

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    addAuditLog('Settings Updated', 'settings', 'info', 'App settings updated');
  };

  const addPaperOrder = (order) => {
    const newOrder = {
      ...order,
      id: 'po' + Date.now(),
      created_date: new Date().toISOString(),
    };
    setPaperOrders(prev => [newOrder, ...prev]);
    addAuditLog('Paper Order Placed', 'order', 'info', `${order.side} ${order.runnerName} @ ${order.requestedOdds} x $${order.requestedStake}`);
  };

  const addRiskEvent = (eventType, severity, blocked, reason, marketId, runnerId, orderId) => {
    addAuditLog(`Risk Check: ${eventType}`, 'risk', blocked ? 'warning' : 'info', `${reason}${blocked ? ' (BLOCKED)' : ''}`);
  };

  const addStrategySignal = (signal) => {
    const newSignal = { ...signal, id: 'ss' + Date.now() };
    setStrategySignals(prev => [newSignal, ...prev]);
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

  const value = {
    mode, changeMode, emergencyStop, triggerEmergencyStop, clearEmergencyStop,
    demoMode, setDemoMode, apiConnected, setApiConnected,
    jurisdiction, setJurisdiction, notifications, setNotifications,
    settings, updateSettings,
    markets, runners, paperOrders, strategySignals, bankrollStats, riskStatus, heatmap,
    auditLogs, backtestRuns, plData,
    addPaperOrder, addRiskEvent, addStrategySignal, addBacktestRun, addAuditLog,
    toggleWatchMarket,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}