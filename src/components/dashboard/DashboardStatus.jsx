import React from 'react';
import { Bot, Database, Radio, ShieldCheck } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';

export default function DashboardStatus() {
  const { apiConnected, betfairConnection, botState, botCycles, markets, runners } = useApp();
  const validated = betfairConnection?.apiValidationStatus === 'api_connected' || markets.length > 0;
  const priced = runners.some(r => r.bestBackPrice > 0 || r.bestLayPrice > 0);
  const running = botState.running && !botState.paused;
  const cards = [
    { label: 'Connection', value: validated ? 'Connected' : apiConnected ? 'Validating' : 'Disconnected', icon: Database, ok: validated },
    { label: 'Bot', value: running ? 'Running' : botState.paused ? 'Paused' : 'Stopped', icon: Bot, ok: running },
    { label: 'Market Data', value: priced ? 'Prices Available' : markets.length ? 'Markets Loaded' : 'No Markets', icon: Radio, ok: priced },
    { label: 'Latest Cycle', value: botCycles[0] ? `#${botCycles[0].cycleNumber} ${botCycles[0].status}` : 'Not Run', icon: ShieldCheck, ok: botCycles[0]?.status === 'completed' },
  ];
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{cards.map(({ label, value, icon: Icon, ok }) => (
    <div key={label} className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{label}</span><Icon className={cn('h-4 w-4', ok ? 'text-success' : 'text-muted-foreground')} /></div>
      <div className="mt-2 text-base font-semibold text-foreground">{value}</div>
    </div>
  ))}</div>;
}