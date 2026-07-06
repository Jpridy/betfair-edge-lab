import React from 'react';
import { Link } from 'react-router-dom';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { AlertOctagon, Shield, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import GlobalStopRules from '@/components/risk/GlobalStopRules';
import RiskOverview from '@/components/risk/RiskOverview';

const RISK_RULES = [
  { key: 'maxStake', label: 'Maximum Stake Per Bet', getValue: (s) => `$${s.maxStake}`, check: true },
  { key: 'maxStakePercent', label: 'Maximum Stake % of Bankroll', getValue: (s) => `${s.maxStakePercent}%`, check: true },
  { key: 'maxMarketExposure', label: 'Maximum Market Exposure', getValue: (s) => `$${s.maxMarketExposure}`, check: true },
  { key: 'dailyLossLimit', label: 'Maximum Daily Loss', getValue: (s) => `$${s.dailyLossLimit}`, check: true },
  { key: 'maxOpenOrders', label: 'Maximum Open Orders', getValue: (s) => `${s.maxOpenOrders}`, check: true },
  { key: 'maxTradesPerMarket', label: 'Maximum Trades Per Market', getValue: (s) => `${s.maxTradesPerMarket}`, check: true },
  { key: 'maxTradesPerDay', label: 'Maximum Trades Per Day', getValue: (s) => `${s.maxTradesPerDay}`, check: true },
  { key: 'minSecondsBeforeStart', label: 'Minimum Seconds Before Race Start', getValue: (s) => `${s.defaultTimeWindowEndSeconds}s`, check: true },
  { key: 'allowInPlay', label: 'Block In-Play (unless enabled)', getValue: (s) => s.allowInPlay ? 'Allowed' : 'Blocked', check: true },
  { key: 'staleData', label: 'Block Stale Data', getValue: () => 'Active', check: true },
  { key: 'suspendedMarkets', label: 'Block Suspended Markets', getValue: () => 'Active', check: true },
  { key: 'lowLiquidity', label: 'Block Low Liquidity', getValue: (s) => `Min £${s.minimumLiquidity}`, check: true },
  { key: 'apiHealth', label: 'Block on Degraded API Health', getValue: () => 'Active', check: true },
  { key: 'maxLosingStreak', label: 'Stop After Max Losing Streak', getValue: () => '5 streaks', check: true },
  { key: 'dailyLossStop', label: 'Stop After Daily Loss Limit', getValue: (s) => `$${s.dailyLossLimit}`, check: true },
];

export default function RiskManager() {
  const { settings, emergencyStop, triggerEmergencyStop, clearEmergencyStop, bankrollStats, riskStatus, mode, paperOrders, addAuditLog, updateSettings } = useApp();

  const paperExposure = paperOrders.filter(o => o.result === 'pending' && o.paper_mode).reduce((sum, o) => sum + (o.matchedStake || 0), 0);
  const liveExposure = paperOrders.filter(o => o.result === 'pending' && o.liveMode).reduce((sum, o) => sum + (o.matchedStake || 0), 0);
  const unmatchedPaper = paperOrders.filter(o => o.status === 'unmatched' || o.status === 'partially_matched').length;

  const handleCancelUnmatched = () => {
    addAuditLog('Cancel All Unmatched Orders', 'emergency', 'critical', `Risk Manager: cancelled ${unmatchedPaper} unmatched/partially matched orders`);
  };
  const handleDisableLive = () => {
    updateSettings({ liveTradingEnabled: false, emergencyStopActive: true });
    addAuditLog('Disable Live Trading', 'emergency', 'critical', 'Risk Manager: live trading disabled from Risk Manager panel');
  };
  const handleForcePaperOnly = () => {
    updateSettings({ forcedPaperOnlyMode: true, liveTradingEnabled: false, mode: 'demo' });
    addAuditLog('Force Paper-Only Mode', 'emergency', 'critical', 'Risk Manager: forced paper-only mode activated');
  };

  return (
    <div className="space-y-5">
      {/* Emergency Stop Banner */}
      <div className={`rounded-lg border-2 p-6 ${emergencyStop ? 'bg-chart-5/10 border-chart-5' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${emergencyStop ? 'bg-chart-5/20' : 'bg-muted'}`}>
              <AlertOctagon className={`h-8 w-8 ${emergencyStop ? 'text-chart-5 animate-pulse' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Emergency Stop</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {emergencyStop
                  ? 'ACTIVE — All trading halted, live mode disabled, paper orders cancelled.'
                  : 'Disables live mode, stops all trading activity, cancels open paper orders, and writes to audit log.'}
              </p>
            </div>
          </div>
          <Button
            onClick={emergencyStop ? clearEmergencyStop : triggerEmergencyStop}
            className={`px-8 py-6 text-base font-bold ${emergencyStop ? 'bg-muted text-foreground hover:bg-muted/80' : 'bg-chart-5 hover:bg-chart-5/90 text-white'}`}
          >
            {emergencyStop ? 'CLEAR EMERGENCY STOP' : 'ACTIVATE EMERGENCY STOP'}
          </Button>
        </div>
      </div>

      {/* Emergency Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button variant="outline" onClick={handleCancelUnmatched} disabled={unmatchedPaper === 0} className="h-auto py-4 flex flex-col items-start gap-1 border-chart-4/50">
          <div className="flex items-center gap-2 text-chart-4"><AlertTriangle className="h-4 w-4" /><span className="text-sm font-bold">Cancel Unmatched</span></div>
          <span className="text-xs text-muted-foreground">{unmatchedPaper} unmatched/partial orders</span>
        </Button>
        <Button variant="outline" onClick={handleDisableLive} disabled={!settings.liveTradingEnabled} className="h-auto py-4 flex flex-col items-start gap-1 border-chart-5/50">
          <div className="flex items-center gap-2 text-chart-5"><Shield className="h-4 w-4" /><span className="text-sm font-bold">Disable Live Trading</span></div>
          <span className="text-xs text-muted-foreground">{settings.liveTradingEnabled ? 'Live trading is ON' : 'Already disabled'}</span>
        </Button>
        <Button variant="outline" onClick={handleForcePaperOnly} disabled={settings.forcedPaperOnlyMode} className="h-auto py-4 flex flex-col items-start gap-1 border-chart-4/50">
          <div className="flex items-center gap-2 text-chart-4"><AlertOctagon className="h-4 w-4" /><span className="text-sm font-bold">Force Paper-Only</span></div>
          <span className="text-xs text-muted-foreground">{settings.forcedPaperOnlyMode ? 'Paper-only active' : 'Lock to paper mode'}</span>
        </Button>
      </div>

      {/* Paper vs Live Exposure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel title="Paper Trading Exposure">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Open Paper Exposure</span>
              <span className="font-mono font-bold text-chart-4">${(paperExposure || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unmatched Paper Orders</span>
              <span className="font-mono font-bold">{unmatchedPaper}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paper Bankroll</span>
              <span className="font-mono font-bold">${settings.paperBankroll?.toLocaleString() || '10,000'}</span>
            </div>
            <div className="pt-2 border-t border-border">
              <StatusBadge status="info">Paper Mode — No Real Funds</StatusBadge>
            </div>
          </div>
        </Panel>
        <Panel title="Live Trading Exposure">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Open Live Exposure</span>
              <span className="font-mono font-bold text-chart-5">${(liveExposure || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Live Trading Status</span>
              <span className="font-mono font-bold">{settings.liveTradingEnabled ? <StatusBadge status="danger">ENABLED</StatusBadge> : <StatusBadge status="ok">DISABLED</StatusBadge>}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Live Bankroll</span>
              <span className="font-mono font-bold">${settings.bankroll?.toLocaleString() || '10,000'}</span>
            </div>
            <div className="pt-2 border-t border-border">
              {settings.forcedPaperOnlyMode
                ? <StatusBadge status="warning">Forced Paper-Only Mode</StatusBadge>
                : settings.liveTradingEnabled
                  ? <StatusBadge status="danger">Live Funds At Risk</StatusBadge>
                  : <StatusBadge status="ok">No Live Exposure</StatusBadge>}
            </div>
          </div>
        </Panel>
      </div>

      {/* Risk Overview: Global state, connections, daily/weekly P/L */}
      <RiskOverview />

      {/* Live Risk Status */}
      <Panel title="Live Risk Checks — Evaluated Before Every Order">
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(riskStatus).map(([key, check]) => (
            <div key={key} className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-chart-1 shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">{check.label}</div>
                <div className="text-sm font-bold font-mono">{check.value}{typeof check.value === 'number' && check.value < 100 ? '%' : ''}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Global Stop Rules */}
      <GlobalStopRules />

      {/* Risk Rules */}
      <Panel title="Risk Rules — Checked Before Every Order">
        <div className="p-4 space-y-2">
          {RISK_RULES.map(rule => (
            <div key={rule.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                {rule.check ? <CheckCircle2 className="h-4 w-4 text-chart-1" /> : <XCircle className="h-4 w-4 text-chart-5" />}
                <span className="text-sm">{rule.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">{rule.getValue(settings)}</span>
                <StatusBadge status={rule.check ? 'ok' : 'danger'}>{rule.check ? 'OK' : 'FAIL'}</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Current Exposure */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Panel title="Current Exposure">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bankroll</span>
              <span className="font-mono font-bold">${(bankrollStats.bankroll || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Open Exposure</span>
              <span className="font-mono font-bold text-chart-4">${(bankrollStats.openExposure || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available</span>
              <span className="font-mono font-bold text-chart-1">${(bankrollStats.available || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">Exposure %</span>
              <span className="font-mono font-bold">{(((bankrollStats.openExposure || 0) / (bankrollStats.bankroll || 1)) * 100).toFixed(1)}%</span>
            </div>
            <div className="pt-2 border-t border-border flex justify-between items-center">
              <span className="text-muted-foreground">Max Open Orders</span>
              <span className="font-mono font-bold">{settings.maxOpenOrders}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Drawdown Status">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Drawdown</span>
              <span className="font-mono font-bold text-chart-5">${(bankrollStats.maxDrawdown || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Drawdown Limit</span>
              <span className="font-mono font-bold">${((settings.bankroll || 0) * 0.1).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Longest Losing Streak</span>
              <span className="font-mono font-bold">{bankrollStats.longestLosingStreak}</span>
            </div>
            <div className="pt-2 border-t border-border">
              <StatusBadge status="ok">Within Limits</StatusBadge>
            </div>
          </div>
        </Panel>

        <Panel title="Strategy Drawdown Limits">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Strategy Drawdown</span>
              <span className="font-mono font-bold text-chart-5">${((settings.bankroll || 0) * 0.1).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Losing Streak</span>
              <span className="font-mono font-bold">5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min Paper Trades</span>
              <span className="font-mono font-bold">200</span>
            </div>
            <div className="pt-2 border-t border-border">
              <Link to="/strategy-library" className="text-xs text-chart-3 hover:underline flex items-center gap-1">
                View Strategy Status <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}