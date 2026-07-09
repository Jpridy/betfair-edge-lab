import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Bot, Wifi, WifiOff, Shield, ShieldAlert, ShieldX, AlertOctagon, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatusStrip() {
  const { botState, emergencyStop, apiConnected, betfairConnection, botCycles, markets, runners } = useApp();

  const botRunning = botState.running && !botState.paused && !emergencyStop;
  const botPaused = botState.paused && !emergencyStop;
  const lastCycle = botCycles[0];

  const riskBlocked = emergencyStop;
  const riskWarning = !emergencyStop && lastCycle?.status === 'blocked';
  const riskOK = !emergencyStop && lastCycle?.status === 'completed' && !riskWarning;
  const riskNotTested = !emergencyStop && !lastCycle;

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
      color: emergencyStop ? 'text-danger' : botRunning ? 'text-success' : 'text-muted-foreground',
      dot: emergencyStop ? 'bg-danger' : botRunning ? 'bg-success animate-pulse-dot' : 'bg-muted-foreground',
    },
    {
      label: 'Data',
      value: dataDisconnected ? 'Disconnected' : dataStale ? 'No Markets' : dataConnected ? (hasPriceData ? 'Live Prices' : 'Markets Loaded') : 'Disconnected',
      icon: dataConnected ? Wifi : WifiOff,
      color: dataConnected && hasPriceData ? 'text-success' : dataConnected ? 'text-info' : dataStale ? 'text-warning' : 'text-muted-foreground',
      dot: dataConnected && hasPriceData ? 'bg-success' : dataConnected ? 'bg-info' : dataStale ? 'bg-warning' : 'bg-muted-foreground',
    },
    {
      label: 'Risk',
      value: riskBlocked ? 'Blocked' : riskWarning ? 'Warning' : riskNotTested ? 'Not Tested' : riskOK ? 'OK' : 'Unknown',
      icon: riskBlocked ? ShieldX : riskWarning ? ShieldAlert : riskNotTested ? HelpCircle : Shield,
      color: riskBlocked ? 'text-danger' : riskWarning ? 'text-warning' : riskNotTested ? 'text-muted-foreground' : riskOK ? 'text-success' : 'text-muted-foreground',
      dot: riskBlocked ? 'bg-danger' : riskWarning ? 'bg-warning' : riskNotTested ? 'bg-muted-foreground' : riskOK ? 'bg-success' : 'bg-muted-foreground',
    },
    {
      label: 'Emergency',
      value: emergencyStop ? 'ACTIVE' : 'Ready',
      icon: AlertOctagon,
      color: emergencyStop ? 'text-danger animate-pulse-dot' : 'text-success',
      dot: emergencyStop ? 'bg-danger animate-pulse-dot' : 'bg-success',
    },
  ];

  return (
    <div className="glass border-b border-border-subtle px-4 md:px-6 lg:px-8 py-1.5">
      <div className="max-w-7xl mx-auto flex items-center gap-5 md:gap-8 overflow-x-auto">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-2 shrink-0">
              <div className={cn('h-1.5 w-1.5 rounded-full', item.dot)} />
              {Icon && <Icon className={cn('h-3.5 w-3.5', item.color)} />}
              <div className="flex flex-col leading-none">
                <span className="text-[9px] font-body font-medium text-muted-foreground uppercase tracking-label">{item.label}</span>
                <span className={cn('text-[11px] font-body font-semibold mt-0.5', item.color)}>{item.value}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}