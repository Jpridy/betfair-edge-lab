import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Bot, Wifi, WifiOff, Shield, ShieldAlert, ShieldX, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatusStrip() {
  const { botState, mode, emergencyStop, apiConnected, demoMode, botCycles } = useApp();

  const botRunning = botState.running && !botState.paused && !emergencyStop;
  const botPaused = botState.paused && !emergencyStop;
  const lastCycle = botCycles[0];
  const riskBlocked = emergencyStop;
  const riskWarning = !emergencyStop && lastCycle?.status === 'blocked';

  const items = [
    {
      label: 'Bot',
      value: emergencyStop ? 'Stopped' : botRunning ? 'Running' : botPaused ? 'Paused' : 'Stopped',
      icon: Bot,
      color: emergencyStop ? 'text-chart-5' : botRunning ? 'text-chart-1' : 'text-muted-foreground',
      dot: emergencyStop ? 'bg-chart-5' : botRunning ? 'bg-chart-1 animate-pulse' : 'bg-muted-foreground',
    },
    {
      label: 'Mode',
      value: emergencyStop ? 'Emergency' : mode === 'paper' ? 'Paper Bot' : mode === 'research' ? 'Research' : 'Live Locked',
      icon: null,
      color: emergencyStop ? 'text-chart-5' : mode === 'paper' ? 'text-chart-4' : 'text-muted-foreground',
      dot: emergencyStop ? 'bg-chart-5' : mode === 'paper' ? 'bg-chart-4' : 'bg-muted-foreground',
    },
    {
      label: 'Data',
      value: apiConnected ? 'API Connected' : 'Demo Data',
      icon: apiConnected ? Wifi : WifiOff,
      color: apiConnected ? 'text-chart-1' : 'text-chart-4',
      dot: apiConnected ? 'bg-chart-1' : 'bg-chart-4',
    },
    {
      label: 'Risk',
      value: riskBlocked ? 'Blocked' : riskWarning ? 'Warning' : 'OK',
      icon: riskBlocked ? ShieldX : riskWarning ? ShieldAlert : Shield,
      color: riskBlocked ? 'text-chart-5' : riskWarning ? 'text-chart-4' : 'text-chart-1',
      dot: riskBlocked ? 'bg-chart-5' : riskWarning ? 'bg-chart-4' : 'bg-chart-1',
    },
    {
      label: 'Emergency',
      value: emergencyStop ? 'ACTIVE' : 'Ready',
      icon: AlertOctagon,
      color: emergencyStop ? 'text-chart-5 animate-pulse' : 'text-chart-1',
      dot: emergencyStop ? 'bg-chart-5 animate-pulse' : 'bg-chart-1',
    },
  ];

  return (
    <div className="bg-card/50 border-b border-border px-4 md:px-6 py-2">
      <div className="flex items-center gap-4 md:gap-6 overflow-x-auto">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-2 shrink-0">
              <div className={cn('h-2 w-2 rounded-full', item.dot)} />
              {Icon && <Icon className={cn('h-3.5 w-3.5', item.color)} />}
              <div className="flex flex-col">
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider leading-none">{item.label}</span>
                <span className={cn('text-xs font-bold leading-tight', item.color)}>{item.value}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}