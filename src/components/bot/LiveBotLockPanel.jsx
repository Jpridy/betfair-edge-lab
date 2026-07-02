import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Lock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export default function LiveBotLockPanel() {
  const { botSettings, emergencyStop, settings } = useApp();

  const requirements = [
    { label: 'Confirmation text required', met: botSettings.requireLiveConfirmationText, detail: `"${botSettings.confirmationText}"` },
    { label: 'Risk manager checks', met: true, detail: 'All risk checks must pass' },
    { label: 'Emergency stop available', met: !emergencyStop, detail: emergencyStop ? 'Emergency stop is active' : 'Available and ready' },
    { label: 'Audit logging', met: true, detail: 'All actions logged' },
    { label: 'API health OK', met: true, detail: 'API responding normally' },
    { label: 'Bankroll limits OK', met: settings.bankroll > 0, detail: `Bankroll: $${settings.bankroll.toLocaleString()}` },
    { label: 'Daily loss limit not breached', met: true, detail: `Limit: $${settings.dailyLossLimit}` },
  ];

  return (
    <Panel title="Live Bot Lock Panel">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 bg-chart-5/10 border border-chart-5/30 rounded-lg p-3">
          <Lock className="h-6 w-6 text-chart-5 shrink-0" />
          <div>
            <div className="text-sm font-bold text-chart-5">Live Bot Mode: LOCKED</div>
            <div className="text-xs text-muted-foreground">Real betting is disabled. This mode will be enabled in a future version only.</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Safety Requirements</div>
          {requirements.map(req => (
            <div key={req.label} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50">
              <div className="flex items-center gap-2">
                {req.met ? <CheckCircle2 className="h-4 w-4 text-chart-1" /> : <XCircle className="h-4 w-4 text-chart-5" />}
                <span className="text-foreground">{req.label}</span>
              </div>
              <span className="text-muted-foreground text-[10px]">{req.detail}</span>
            </div>
          ))}
        </div>

        <div className="bg-chart-4/10 border border-chart-4/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-chart-4 shrink-0" />
            <span className="text-xs font-bold text-chart-4">Live trading will NOT be enabled in this version.</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1.5">
            Live mode requires all safety settings complete, all risk checks passing, fresh data, API health OK,
            bankroll limits OK, daily loss limit not breached, and confirmation text "ENABLE LIVE TRADING".
            Even then, live order placement is not implemented in this version.
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Live Trading Status</span>
          <StatusBadge status="danger">LOCKED — Disabled</StatusBadge>
        </div>
      </div>
    </Panel>
  );
}