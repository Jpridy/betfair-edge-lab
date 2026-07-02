import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Bot, Activity, Zap, TrendingUp, Clock } from 'lucide-react';

export default function BotStatusCard() {
  const { botState, mode, emergencyStop, botSettings, markets, demoMode } = useApp();

  const modeLabel = emergencyStop ? 'EMERGENCY STOP' : mode === 'paper' ? 'Paper Bot' : mode === 'research' ? 'Research' : 'Live Bot Locked';
  const runningLabel = emergencyStop ? 'Stopped' : botState.running ? (botState.paused ? 'Paused' : 'Running') : 'Stopped';
  const watchedMarkets = markets.filter(m => m.watched).length;

  const stats = [
    { label: 'Bot Mode', value: modeLabel, icon: Bot, color: emergencyStop ? 'text-chart-5' : 'text-chart-4' },
    { label: 'Bot Running', value: runningLabel, icon: Activity, color: botState.running && !botState.paused ? 'text-chart-1' : 'text-muted-foreground' },
    { label: 'Active Strategy', value: botSettings.selectedStrategies[0] || '—', icon: Bot, color: 'text-foreground' },
    { label: 'Markets Watched', value: watchedMarkets, icon: Activity, color: 'text-foreground' },
    { label: 'Signals Today', value: botState.signalsToday, icon: Zap, color: 'text-chart-3' },
    { label: 'Paper Orders Today', value: botState.ordersToday, icon: Activity, color: 'text-chart-2' },
    { label: 'Net Paper P/L Today', value: `$${botState.botPLToday.toFixed(2)}`, icon: TrendingUp, color: botState.botPLToday >= 0 ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Last Bot Cycle', value: botState.lastCycleTime ? new Date(botState.lastCycleTime).toLocaleTimeString('en-AU', { hour12: false }) : '—', icon: Clock, color: 'text-foreground' },
    { label: 'Next Scan', value: botState.running && !emergencyStop ? `${botState.nextScanCountdown}s` : '—', icon: Clock, color: 'text-chart-4' },
  ];

  return (
    <Panel title="Bot Status">
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-background/50 rounded-lg p-3 border border-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
                <Icon className={`h-3.5 w-3.5 ${s.color}`} />
              </div>
              <div className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</div>
            </div>
          );
        })}
      </div>
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        <StatusBadge status={emergencyStop ? 'danger' : 'ok'}>
          {emergencyStop ? 'Emergency Stop Active' : 'Emergency Stop Ready'}
        </StatusBadge>
        <StatusBadge status={demoMode ? 'info' : 'ok'}>
          {demoMode ? 'Demo Mode' : 'Live API'}
        </StatusBadge>
        <StatusBadge status="ok">API Health: OK</StatusBadge>
        <StatusBadge status={botSettings.autoPaperTradingEnabled ? 'ok' : 'neutral'}>
          Auto Paper Trading: {botSettings.autoPaperTradingEnabled ? 'ON' : 'OFF'}
        </StatusBadge>
        <StatusBadge status="danger">Live Trading: LOCKED</StatusBadge>
      </div>
    </Panel>
  );
}