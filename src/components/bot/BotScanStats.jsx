import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/Trading';
import { Radar, Zap, FileText, Ban, Clock, Activity } from 'lucide-react';

export default function BotScanStats() {
  const { botState, botCycles, strategySignals, paperOrders, auditLogs } = useApp();

  const todayCycles = botCycles.filter(c => {
    const d = new Date(c.startedAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const marketsScannedToday = todayCycles.reduce((sum, c) => sum + (c.marketsScanned || 0), 0);
  const signalsToday = botState.signalsToday || todayCycles.reduce((sum, c) => sum + (c.signalsCreated || 0), 0);
  const ordersToday = botState.ordersToday || todayCycles.reduce((sum, c) => sum + (c.ordersCreated || 0), 0);
  const rejectedToday = botState.ordersBlockedToday || todayCycles.reduce((sum, c) => sum + (c.ordersBlocked || 0), 0);

  const lastCycle = botCycles[0];
  const lastScanTime = botState.lastCycleTime || lastCycle?.startedAt;

  const rejectionReasons = auditLogs
    .filter(l => l.category === 'risk' && l.severity === 'warning')
    .slice(0, 5)
    .map(l => l.details);

  const stats = [
    { label: 'Markets Scanned Today', value: marketsScannedToday, icon: Radar, color: 'text-info' },
    { label: 'Signals Generated Today', value: signalsToday, icon: Zap, color: 'text-warning' },
    { label: 'Orders Created Today', value: ordersToday, icon: FileText, color: 'text-success' },
    { label: 'Rejected Signals Today', value: rejectedToday, icon: Ban, color: 'text-danger' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
                <Icon className={`h-3.5 w-3.5 ${s.color}`} />
              </div>
              <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="Scan Timing">
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Last Scan</span>
              <span className="font-mono text-xs">{lastScanTime ? new Date(lastScanTime).toLocaleTimeString('en-AU', { hour12: false }) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Next Scan</span>
              <span className="font-mono text-xs">
                {botState.running && !botState.paused
                  ? `${botState.nextScanCountdown}s`
                  : 'Bot stopped'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Cycles</span>
              <span className="font-mono text-xs">{botState.cycleNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bot P/L Today</span>
              <span className={`font-mono text-xs font-bold ${botState.botPLToday >= 0 ? 'text-success' : 'text-danger'}`}>
                {botState.botPLToday >= 0 ? '+' : ''}${botState.botPLToday.toFixed(2)}
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="Rejection Reasons (Recent)">
          <div className="p-4">
            {rejectionReasons.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">No recent rejections.</div>
            ) : (
              <div className="space-y-2">
                {rejectionReasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Ban className="h-3 w-3 text-danger shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}