import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Zap, Activity, ShieldCheck, Target } from 'lucide-react';

const ACCENTS = {
  blue: { bar: 'bg-chart-3', icon: 'bg-chart-3/10 text-chart-3' },
  purple: { bar: 'bg-chart-2', icon: 'bg-chart-2/10 text-chart-2' },
  yellow: { bar: 'bg-chart-4', icon: 'bg-chart-4/10 text-chart-4' },
  green: { bar: 'bg-chart-1', icon: 'bg-chart-1/10 text-chart-1' },
};

export default function DashboardMetrics() {
  const { bankrollStats, strategySignals, botState, paperOrders } = useApp();

  const settledOrders = paperOrders.filter(o => o.result === 'won' || o.result === 'lost');
  const winRate = settledOrders.length > 0
    ? ((settledOrders.filter(o => o.result === 'won').length / settledOrders.length) * 100).toFixed(1)
    : '0.0';
  const exposurePercent = ((bankrollStats.openExposure / bankrollStats.bankroll) * 100).toFixed(1);

  const metrics = [
    { label: 'Signals Today', value: botState.signalsToday, sub: `${strategySignals.length} active`, icon: Zap, accent: 'blue' },
    { label: 'Orders Today', value: botState.ordersToday, sub: botState.ordersBlockedToday > 0 ? `${botState.ordersBlockedToday} blocked` : 'No blocks', icon: Activity, accent: 'purple' },
    { label: 'Open Exposure', value: `$${bankrollStats.openExposure.toFixed(0)}`, sub: `${exposurePercent}% of bank`, icon: ShieldCheck, accent: 'yellow' },
    { label: 'Win Rate', value: `${winRate}%`, sub: `${settledOrders.length} settled`, icon: Target, accent: 'green' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((m, i) => {
        const a = ACCENTS[m.accent];
        const Icon = m.icon;
        return (
          <div key={i} className="relative overflow-hidden rounded-xl border border-border bg-card p-4 group hover:border-primary/30 transition-colors">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${a.bar}`} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{m.label}</span>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${a.icon}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">{m.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{m.sub}</div>
          </div>
        );
      })}
    </div>
  );
}