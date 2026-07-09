import React, { useMemo } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Wifi, WifiOff, Database, ShieldCheck, Globe } from 'lucide-react';
import { calculateRiskMetrics } from '@/lib/riskCalculations';

export default function RiskOverview() {
  const { bankrollStats, settings, emergencyStop, apiConnected, appMode, paperOrders } = useApp();

  const riskMetrics = useMemo(() => calculateRiskMetrics(paperOrders, settings), [paperOrders, settings]);
  const weeklyPL = riskMetrics.weeklyPL;
  const weeklyLossLimit = settings.weeklyLossLimit || settings.dailyLossLimit * 5;
  const dailyLossUsed = bankrollStats.todayPL < 0 ? Math.abs(bankrollStats.todayPL) : 0;
  const weeklyLossUsed = weeklyPL < 0 ? Math.abs(weeklyPL) : 0;
  const exposurePercent = (riskMetrics.openExposure / (bankrollStats.bankroll || 1)) * 100;
  const drawdownPercent = Math.abs(bankrollStats.maxDrawdown) / (bankrollStats.bankroll || 1) * 100;

  const globalState = emergencyStop
    ? { label: 'EMERGENCY STOP', status: 'danger', desc: 'All paper trading halted' }
    : exposurePercent > 10
    ? { label: 'HIGH EXPOSURE', status: 'warning', desc: 'Open exposure exceeds 10%' }
    : dailyLossUsed > settings.dailyLossLimit * 0.8
    ? { label: 'APPROACHING LOSS LIMIT', status: 'warning', desc: 'Daily loss near limit' }
    : drawdownPercent > 8
    ? { label: 'HIGH DRAWDOWN', status: 'warning', desc: 'Drawdown approaching limit' }
    : { label: 'ALL CLEAR', status: 'ok', desc: 'All risk checks passing' };

  return (
    <div className="space-y-4">
      {/* Global Risk State */}
      <div className={`rounded-lg border-2 p-4 ${
        globalState.status === 'danger' ? 'border-danger bg-danger/10' :
        globalState.status === 'warning' ? 'border-warning bg-warning/10' :
        'border-success bg-success/5'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className={`h-6 w-6 ${
              globalState.status === 'danger' ? 'text-danger' :
              globalState.status === 'warning' ? 'text-warning' : 'text-success'
            }`} />
            <div>
              <div className={`text-sm font-bold ${
                globalState.status === 'danger' ? 'text-danger' :
                globalState.status === 'warning' ? 'text-warning' : 'text-success'
              }`}>{globalState.label}</div>
              <div className="text-xs text-muted-foreground">{globalState.desc}</div>
            </div>
          </div>
          <StatusBadge status={globalState.status}>{globalState.label}</StatusBadge>
        </div>
      </div>

      {/* Connection Status */}
      <Panel title="System Connections">
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            {apiConnected ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-warning" />}
            <div>
              <div className="text-xs text-muted-foreground">Betfair Data</div>
              <div className={`text-sm font-bold ${apiConnected ? 'text-success' : 'text-warning'}`}>
                {apiConnected ? 'Connected' : appMode === 'paper' ? 'Paper (No Data)' : 'Disconnected'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Database className={`h-5 w-5 ${apiConnected ? 'text-success' : 'text-warning'}`} />
            <div>
              <div className="text-xs text-muted-foreground">Data Feed</div>
              <div className={`text-sm font-bold ${apiConnected ? 'text-success' : 'text-warning'}`}>
                {apiConnected ? 'Data connection OK' : 'Stale (Demo)'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-info" />
            <div>
              <div className="text-xs text-muted-foreground">Jurisdiction</div>
              <div className="text-sm font-bold text-foreground">Australia (AU)</div>
            </div>
          </div>
        </div>
      </Panel>

      {/* P/L Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="Daily P/L Status">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Today's P/L</span>
              <span className={`font-mono font-bold ${bankrollStats.todayPL >= 0 ? 'text-success' : 'text-danger'}`}>
                {bankrollStats.todayPL >= 0 ? '+' : ''}${bankrollStats.todayPL.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Daily Loss Limit</span>
              <span className="font-mono font-bold text-danger">-${settings.dailyLossLimit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loss Used</span>
              <span className="font-mono font-bold">{dailyLossUsed > 0 ? `${((dailyLossUsed / settings.dailyLossLimit) * 100).toFixed(1)}%` : '0%'}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${dailyLossUsed / settings.dailyLossLimit > 0.8 ? 'bg-danger' : 'bg-warning'}`}
                style={{ width: `${Math.min((dailyLossUsed / settings.dailyLossLimit) * 100, 100)}%` }} />
            </div>
            <div className="pt-2 border-t border-border">
              <StatusBadge status={dailyLossUsed > settings.dailyLossLimit * 0.8 ? 'warning' : 'ok'}>
                {dailyLossUsed > settings.dailyLossLimit * 0.8 ? 'Approaching Limit' : 'Within Limits'}
              </StatusBadge>
            </div>
          </div>
        </Panel>

        <Panel title="Weekly P/L Status">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weekly P/L (est.)</span>
              <span className={`font-mono font-bold ${weeklyPL >= 0 ? 'text-success' : 'text-danger'}`}>
                {weeklyPL >= 0 ? '+' : ''}${weeklyPL.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weekly Loss Limit</span>
              <span className="font-mono font-bold text-danger">-${weeklyLossLimit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loss Used</span>
              <span className="font-mono font-bold">{weeklyLossUsed > 0 ? `${((weeklyLossUsed / weeklyLossLimit) * 100).toFixed(1)}%` : '0%'}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${weeklyLossUsed / weeklyLossLimit > 0.8 ? 'bg-danger' : 'bg-warning'}`}
                style={{ width: `${Math.min((weeklyLossUsed / weeklyLossLimit) * 100, 100)}%` }} />
            </div>
            <div className="pt-2 border-t border-border">
              <StatusBadge status={weeklyLossUsed > weeklyLossLimit * 0.8 ? 'warning' : 'ok'}>
                {weeklyLossUsed > weeklyLossLimit * 0.8 ? 'Approaching Limit' : 'Within Limits'}
              </StatusBadge>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}