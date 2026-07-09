import React, { useState, useMemo } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertOctagon, Shield, CheckCircle2, XCircle, AlertTriangle, FlaskConical } from 'lucide-react';
import GlobalStopRules from '@/components/risk/GlobalStopRules';
import RiskOverview from '@/components/risk/RiskOverview';
import { Switch } from '@/components/ui/switch';
import { calculateRiskMetrics } from '@/lib/riskCalculations';

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
  const { settings, emergencyStop, triggerEmergencyStop, clearEmergencyStop, bankrollStats, riskStatus, paperOrders, addAuditLog, updateSettings, cancelUnmatchedOrders } = useApp();
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const riskMetrics = useMemo(() => calculateRiskMetrics(paperOrders, settings), [paperOrders, settings]);
  const paperExposure = riskMetrics.paperExposure;
  const liveExposure = riskMetrics.liveExposure;
  const unmatchedPaper = riskMetrics.unmatchedOrderCount;

  const handleCancelUnmatched = () => {
    cancelUnmatchedOrders();
  };
  const handleDisableLive = () => {
    updateSettings({ liveTradingEnabled: false, emergencyStopActive: true });
    addAuditLog('Disable Live Trading', 'emergency', 'critical', 'Risk Manager: live trading disabled from Risk Manager panel');
  };
  const handleForcePaperOnly = () => {
    updateSettings({ forcedPaperOnlyMode: true, liveTradingEnabled: false });
    addAuditLog('Force Paper-Only Mode', 'emergency', 'critical', 'Risk Manager: forced paper-only mode activated');
  };

  const CONFIRM_PHRASE = 'DISABLE RISK LIMITS';

  const toggleRiskLimits = (checked) => {
    if (checked) {
      setShowConfirm(true);
      setConfirmText('');
      return;
    }
    // Disabling the bypass is always allowed
    updateSettings({ riskLimitsDisabled: false });
    setShowConfirm(false);
    addAuditLog('Risk Limits Enabled', 'risk', 'info', 'Risk limits re-enabled — all checks active');
  };

  const confirmDisableRiskLimits = () => {
    if (confirmText.trim().toUpperCase() !== CONFIRM_PHRASE) return;
    updateSettings({ riskLimitsDisabled: true });
    setShowConfirm(false);
    setConfirmText('');
    addAuditLog('Risk Limits Disabled', 'risk', 'warning', 'ALL risk limits bypassed for testing — orders will not be blocked by risk checks. Confirmed via typed phrase.');
  };

  return (
    <div className="space-y-5">
      {/* Admin/Advanced — Disable All Risk Limits (hidden from normal workflow) */}
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 mb-2">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Admin / Advanced Tools</div>
      <div className={`rounded-lg border-2 p-5 ${settings.riskLimitsDisabled ? 'bg-warning/10 border-warning' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${settings.riskLimitsDisabled ? 'bg-warning/20' : 'bg-muted'}`}>
              <FlaskConical className={`h-6 w-6 ${settings.riskLimitsDisabled ? 'text-warning' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h2 className="text-base font-bold">Testing Mode — Disable All Risk Limits</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {settings.riskLimitsDisabled
                  ? 'ACTIVE — All risk checks bypassed. Orders will not be blocked by stake, odds, loss, exposure, or count limits.'
                  : 'Bypasses every risk limit (stake, odds, loss, exposure, order counts, drawdown, liquidity, duplicate) for unrestricted testing.'}
              </p>
            </div>
          </div>
          <Switch checked={settings.riskLimitsDisabled || false} onCheckedChange={toggleRiskLimits} />
        </div>
        {showConfirm && !settings.riskLimitsDisabled && (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-4 space-y-3">
            <div className="text-xs font-bold text-warning flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Type Confirmation Required
            </div>
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">DISABLE RISK LIMITS</span> to bypass all risk checks. This is for testing only.
            </p>
            <div className="flex gap-2">
              <Input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="Type the confirmation phrase..."
                className="flex-1"
                onKeyDown={e => { if (e.key === 'Enter') confirmDisableRiskLimits(); }}
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={confirmDisableRiskLimits}
                disabled={confirmText.trim().toUpperCase() !== CONFIRM_PHRASE}
              >
                Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowConfirm(false); setConfirmText(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Emergency Stop Banner */}
      <div className={`rounded-lg border-2 p-6 ${emergencyStop ? 'bg-danger/10 border-danger' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${emergencyStop ? 'bg-danger/20' : 'bg-muted'}`}>
              <AlertOctagon className={`h-8 w-8 ${emergencyStop ? 'text-danger animate-pulse-dot' : 'text-muted-foreground'}`} />
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
            className={`px-8 py-6 text-base font-bold ${emergencyStop ? 'bg-muted text-foreground hover:bg-muted/80' : 'bg-danger hover:bg-danger/90 text-white'}`}
          >
            {emergencyStop ? 'CLEAR EMERGENCY STOP' : 'ACTIVATE EMERGENCY STOP'}
          </Button>
        </div>
      </div>

      {/* Emergency Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button variant="outline" onClick={handleCancelUnmatched} disabled={unmatchedPaper === 0} className="h-auto py-4 flex flex-col items-start gap-1 border-warning/50">
          <div className="flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" /><span className="text-sm font-bold">Cancel Unmatched</span></div>
          <span className="text-xs text-muted-foreground">{unmatchedPaper} unmatched/partial orders</span>
        </Button>
        <Button variant="outline" onClick={handleDisableLive} disabled={!settings.liveTradingEnabled} className="h-auto py-4 flex flex-col items-start gap-1 border-danger/50">
          <div className="flex items-center gap-2 text-danger"><Shield className="h-4 w-4" /><span className="text-sm font-bold">Disable Live Trading</span></div>
          <span className="text-xs text-muted-foreground">{settings.liveTradingEnabled ? 'Live trading is ON' : 'Already disabled'}</span>
        </Button>
        <Button variant="outline" onClick={handleForcePaperOnly} disabled={settings.forcedPaperOnlyMode} className="h-auto py-4 flex flex-col items-start gap-1 border-warning/50">
          <div className="flex items-center gap-2 text-warning"><AlertOctagon className="h-4 w-4" /><span className="text-sm font-bold">Force Paper-Only</span></div>
          <span className="text-xs text-muted-foreground">{settings.forcedPaperOnlyMode ? 'Paper-only active' : 'Lock to paper mode'}</span>
        </Button>
      </div>

      {/* Paper vs Live Exposure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel title="Paper Exposure">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Open Paper Exposure</span>
              <span className="font-mono font-bold text-warning">${(paperExposure || 0).toFixed(2)}</span>
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
        <Panel title="Simulated Funds At Risk">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Simulated Exposure</span>
              <span className="font-mono font-bold text-danger">${(liveExposure || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Future Live Review</span>
              <span className="font-mono font-bold"><StatusBadge status="neutral">Disabled — Paper Only</StatusBadge></span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paper Bankroll</span>
              <span className="font-mono font-bold">${settings.paperBankroll?.toLocaleString() || '10,000'}</span>
            </div>
            <div className="pt-2 border-t border-border">
              {settings.forcedPaperOnlyMode
                ? <StatusBadge status="warning">Paper-Only Mode</StatusBadge>
                : <StatusBadge status="ok">No Real Funds At Risk</StatusBadge>}
            </div>
          </div>
        </Panel>
      </div>

      {/* Risk Overview: Global state, connections, daily/weekly P/L */}
      <RiskOverview />

      {/* Live Risk Status */}
      <Panel title="Risk Checks — Evaluated Before Every Paper Order">
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(riskStatus).map(([key, check]) => (
            <div key={key} className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
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
          {RISK_RULES.map(rule => {
            const disabled = settings.riskLimitsDisabled;
            const active = rule.check && !disabled;
            // Calculate actual status per rule
            let status = 'ok';
            let statusLabel = 'OK';
            if (disabled) {
              status = 'neutral'; statusLabel = 'BYPASS';
            } else if (rule.key === 'dailyLossLimit' || rule.key === 'dailyLossStop') {
              const lossUsed = bankrollStats.todayPL < 0 ? Math.abs(bankrollStats.todayPL) : 0;
              const pct = lossUsed / settings.dailyLossLimit;
              if (pct >= 1) { status = 'danger'; statusLabel = 'BREACHED'; }
              else if (pct >= 0.8) { status = 'warning'; statusLabel = 'WARNING'; }
            } else if (rule.key === 'maxOpenOrders') {
              const openCount = paperOrders.filter(o => ['pending', 'executable', 'unmatched', 'partially_matched', 'matched'].includes(o.status) && o.result === 'pending').length;
              if (openCount >= settings.maxOpenOrders) { status = 'danger'; statusLabel = 'BREACHED'; }
              else if (openCount >= settings.maxOpenOrders * 0.8) { status = 'warning'; statusLabel = 'WARNING'; }
            } else if (rule.key === 'maxMarketExposure') {
              const exposure = (riskMetrics.paperExposure || 0) + (riskMetrics.liveExposure || 0);
              if (exposure >= settings.maxMarketExposure) { status = 'danger'; statusLabel = 'BREACHED'; }
              else if (exposure >= settings.maxMarketExposure * 0.8) { status = 'warning'; statusLabel = 'WARNING'; }
            }
            return (
              <div key={rule.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  {disabled ? <XCircle className="h-4 w-4 text-muted-foreground" /> :
                   status === 'danger' ? <XCircle className="h-4 w-4 text-danger" /> :
                   status === 'warning' ? <AlertTriangle className="h-4 w-4 text-warning" /> :
                   <CheckCircle2 className="h-4 w-4 text-success" />}
                  <span className={`text-sm ${disabled ? 'text-muted-foreground' : ''}`}>{rule.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">{rule.getValue(settings)}</span>
                  <StatusBadge status={status}>{statusLabel}</StatusBadge>
                </div>
              </div>
            );
          })}
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
              <span className="font-mono font-bold text-warning">${((bankrollStats.openPaperExposure || 0) + (bankrollStats.openLiveExposure || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available</span>
              <span className="font-mono font-bold text-success">${(bankrollStats.available || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">Exposure %</span>
              <span className="font-mono font-bold">{((((bankrollStats.openPaperExposure || 0) + (bankrollStats.openLiveExposure || 0)) / (bankrollStats.bankroll || 1)) * 100).toFixed(1)}%</span>
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
              <span className="font-mono font-bold text-danger">${(bankrollStats.maxDrawdown || 0).toFixed(2)}</span>
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
              <StatusBadge status={Math.abs(bankrollStats.maxDrawdown || 0) > (settings.bankroll || 10000) * 0.08 ? 'warning' : Math.abs(bankrollStats.maxDrawdown || 0) > (settings.bankroll || 10000) * 0.1 ? 'danger' : 'ok'}>
                {Math.abs(bankrollStats.maxDrawdown || 0) > (settings.bankroll || 10000) * 0.1 ? 'BREACHED' : Math.abs(bankrollStats.maxDrawdown || 0) > (settings.bankroll || 10000) * 0.08 ? 'WARNING' : 'Within Limits'}
              </StatusBadge>
            </div>
          </div>
        </Panel>

        <Panel title="Strategy Drawdown Limits">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Strategy Drawdown</span>
              <span className="font-mono font-bold text-danger">${((settings.bankroll || 0) * 0.1).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Losing Streak</span>
              <span className="font-mono font-bold">5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min Paper Trades</span>
              <span className="font-mono font-bold">200</span>
            </div>
            <div className="pt-2 border-t border-border text-xs text-muted-foreground">
              See Strategy Library in Advanced Debug for per-strategy drawdown limits.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}