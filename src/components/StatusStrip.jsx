import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Bot, Wifi, WifiOff, Shield, ShieldAlert, ShieldX, AlertOctagon, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatusStrip() {
  const { botState, emergencyStop, apiConnected, betfairConnection, botCycles, markets, runners } = useApp();

  const botRunning = botState.running && !botState.paused && !emergencyStop;
  const botPaused = botState.paused && !emergencyStop;
  const lastCycle = botCycles[0];

  // Truthful risk status — only show OK if a cycle actually ran and wasn't blocked
  const riskBlocked = emergencyStop;
  const riskWarning = !emergencyStop && lastCycle?.status === 'blocked';
  const riskOK = !emergencyStop && lastCycle?.status === 'completed' && !riskWarning;
  const riskNotTested = !emergencyStop && !lastCycle;

  // Truthful data status — only show connected if we actually have markets
  const hasMarketData = markets.length > 0;
  const hasPriceData = runners.some(r => r.bestBackPrice || r.bestLayPrice || r.lastPriceTraded);
  const dataConnected = apiConnected && hasMarketData;
  const dataStale = apiConnected && !hasMarketData;
  const dataDisconnected = !apiConnected;

  const items = [
    {
      label: 'Bot',
      value: emergencyStop ? 'Stopped' : botRunning ? 'Running' : botPaused ? 'Paused' : 'Stopped',
      icon: Bot,
      color: emergencyStop ? 'text-chart-5' : botRunning ? 'text-chart-1' : 'text-muted-foreground',
      dot: emergencyStop ? 'bg-chart-5' : botRunning ? 'bg-chart-1 animate-pulse' : 'bg-muted-foreground',
    },
    {
      label: 'Data',
      value: dataDisconnected ? 'Disconnected' : dataStale ? 'No Markets' : dataConnected ? (hasPriceData ? 'Live Prices' : 'Markets Loaded') : 'Disconnected',
      icon: dataConnected ? Wifi : WifiOff,
      color: dataConnected && hasPriceData ? 'text-chart-1' : dataConnected ? 'text-chart-3' : dataStale ? 'text-chart-4' : 'text-muted-foreground',
      dot: dataConnected && hasPriceData ? 'bg-chart-1' : dataConnected ? 'bg-chart-3' : dataStale ? 'bg-chart-4' : 'bg-muted-foreground',
    },
    {
      label: 'Risk',
      value: riskBlocked ? 'Blocked' : riskWarning ? 'Warning' : riskNotTested ? 'Not Tested' : riskOK ? 'OK' : 'Unknown',
      icon: riskBlocked ? ShieldX : riskWarning ? ShieldAlert : riskNotTested ? HelpCircle : Shield,
      color: riskBlocked ? 'text-chart-5' : riskWarning ? 'text-chart-4' : riskNotTested ? 'text-muted-foreground' : riskOK ? 'text-chart-1' : 'text-muted-foreground',
      dot: riskBlocked ? 'bg-chart-5' : riskWarning ? 'bg-chart-4' : riskNotTested ? 'bg-muted-foreground' : riskOK ? 'bg-chart-1' : 'bg-muted-foreground',
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
    <div className="bg-card/50 border-b border-border px-4 md:px-6 lg:px-8 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-4 md:gap-8 overflow-x-auto">
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