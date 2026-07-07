import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Bot, Activity, Zap, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BotStatusCard() {
  const { botState, emergencyStop, botSettings, markets, apiConnected, botCycles } = useApp();

  const isRunning = botState.running && !botState.paused && !emergencyStop;
  const isPaused = botState.paused && !emergencyStop;
  const lastCycle = botCycles[0];
  const lastBlockedCycle = botCycles.find(c => c.ordersBlocked > 0);
  const watchedMarkets = markets.filter(m => m.watched).length;

  const statusLabel = emergencyStop ? 'Emergency Stop' : isRunning ? 'Running' : isPaused ? 'Paused' : 'Stopped';
  const statusColor = emergencyStop ? 'text-chart-5' : isRunning ? 'text-chart-1' : isPaused ? 'text-chart-4' : 'text-muted-foreground';
  const statusBg = emergencyStop ? 'bg-chart-5/10' : isRunning ? 'bg-chart-1/10' : isPaused ? 'bg-chart-4/10' : 'bg-muted/20';

  const stats = [
    { label: 'Scan Interval', value: `${botSettings.scanIntervalSeconds}s`, icon: Clock },
    { label: 'Next Scan', value: isRunning ? `${botState.nextScanCountdown}s` : '—', icon: Clock },
    { label: 'Markets Scanned', value: lastCycle?.marketsScanned ?? 0, icon: Activity },
    { label: 'Markets Passed', value: lastCycle?.marketsPassedFilters ?? 0, icon: Activity },
    { label: 'Signals Found', value: lastCycle?.signalsCreated ?? 0, icon: Zap },
    { label: 'Orders Created', value: lastCycle?.ordersCreated ?? 0, icon: Bot },
    { label: 'Trades Blocked', value: lastCycle?.ordersBlocked ?? 0, icon: AlertTriangle },
    { label: 'Markets Watched', value: watchedMarkets, icon: Activity },
  ];

  return (
    <Panel title="Bot Status">
      <div className="p-4">
        <div className={cn('rounded-lg p-4 mb-4 flex items-center gap-4', statusBg)}>
          <div className={cn('w-14 h-14 rounded-full flex items-center justify-center', statusBg)}>
            <Bot className={cn('h-7 w-7', statusColor, isRunning && 'animate-pulse')} />
          </div>
          <div>
            <div className={cn('text-2xl font-bold', statusColor)}>{statusLabel}</div>
            <div className="text-xs text-muted-foreground">
              {emergencyStop ? 'All activity halted'
              : isRunning ? `Paper trading · scanning every ${botSettings.scanIntervalSeconds}s`
              : isPaused ? 'Scanning continues, no new orders'
              : 'Press Start to begin'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-background/50 rounded-lg p-3 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="text-sm font-bold font-mono text-foreground">{s.value}</div>
              </div>
            );
          })}
        </div>

        {lastBlockedCycle && (
          <div className="bg-chart-5/10 border border-chart-5/20 rounded-lg p-3 flex items-start gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-chart-5 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-chart-5">Last Block Reason</div>
              <div className="text-xs text-muted-foreground mt-0.5">{lastBlockedCycle.notes}</div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <StatusBadge status={emergencyStop ? 'danger' : 'ok'}>
            {emergencyStop ? 'Emergency Stop Active' : 'Emergency Stop Ready'}
          </StatusBadge>
          <StatusBadge status={apiConnected ? 'ok' : 'info'}>
            {apiConnected ? 'Live API Connected' : 'API Disconnected'}
          </StatusBadge>
          <StatusBadge status="ok">API Health: OK</StatusBadge>
          <StatusBadge status={botSettings.autoPaperTradingEnabled ? 'ok' : 'neutral'}>
            Auto Paper Trading: {botSettings.autoPaperTradingEnabled ? 'ON' : 'OFF'}
          </StatusBadge>
        </div>
      </div>
    </Panel>
  );
}