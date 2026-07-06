import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { CheckCircle2, Circle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function OnboardingChecklist() {
  const { mode, demoMode, apiConnected, settings, botState, paperOrders } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  const steps = [
    {
      label: 'Choose Demo Mode',
      detail: 'Demo mode for paper trading with simulated data',
      done: mode === 'demo',
      link: '/bot-control',
    },
    {
      label: 'Confirm demo data or connect Betfair API',
      detail: demoMode ? 'Using demo data — ready to go' : (apiConnected ? 'Betfair API connected' : 'Connect your Betfair API in Settings'),
      done: demoMode || apiConnected,
      link: '/settings',
    },
    {
      label: 'Set your bankroll',
      detail: `Current bankroll: $${settings.bankroll.toLocaleString()}`,
      done: settings.bankroll >= 100,
      link: '/settings',
    },
    {
      label: 'Set risk limits',
      detail: `Daily loss limit: $${settings.dailyLossLimit} · Max stake: $${settings.maxStake}`,
      done: settings.dailyLossLimit > 0 && settings.maxStake > 0,
      link: '/risk',
    },
    {
      label: 'Select strategies',
      detail: 'Enable at least one trading strategy',
      done: settings.strategyValueBetEnabled || settings.strategyScalpingEnabled || settings.strategyFavOutsiderEnabled || settings.strategyCrossMarketEnabled,
      link: '/strategy',
    },
    {
      label: 'Start the Paper Bot',
      detail: botState.running ? 'Bot is running!' : 'Press Start on the Bot Control Centre',
      done: botState.running || botState.cycleNumber > 0,
      link: '/bot-control',
    },
    {
      label: 'Review paper results',
      detail: 'Check your paper orders and P/L',
      done: paperOrders.some(o => o.result === 'won' || o.result === 'lost'),
      link: '/paper-trading',
    },
  ];

  const completed = steps.filter(s => s.done).length;
  const allDone = completed === steps.length;

  if (allDone || collapsed) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-chart-1" />
          <span className="text-xs font-medium text-muted-foreground">
            {allDone ? 'Setup complete — your bot is ready to trade.' : `Setup progress: ${completed} of ${steps.length} steps done`}
          </span>
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="text-xs text-chart-3 hover:underline flex items-center gap-1">
          {collapsed ? 'Show' : 'Hide'} <ChevronDown className={cn('h-3 w-3 transition-transform', !collapsed && 'rotate-180')} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">First-Time Setup Checklist</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Complete these steps to start paper trading. {completed} of {steps.length} done.</p>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">
        <div className="w-full h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-chart-1 rounded-full transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
        </div>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className={cn('flex items-center gap-3 p-2 rounded-md', step.done ? 'bg-chart-1/5' : 'bg-background/50')}>
              {step.done ? <CheckCircle2 className="h-4 w-4 text-chart-1 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className={cn('text-xs font-medium', step.done ? 'text-muted-foreground line-through' : 'text-foreground')}>{step.label}</div>
                <div className="text-[10px] text-muted-foreground">{step.detail}</div>
              </div>
              {!step.done && step.link && (
                <Link to={step.link} className="text-[10px] text-chart-3 hover:underline font-medium shrink-0">Go →</Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}