import React from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useApp } from '@/lib/AppContext';

export default function DashboardHero() {
  const { bankrollStats, botState, emergencyStop, plData } = useApp();
  const isRunning = botState.running && !botState.paused && !emergencyStop;
  const isPaused = botState.paused && !emergencyStop;
  const todayPL = bankrollStats.todayPL;
  const positive = todayPL >= 0;

  const chartColor = positive ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-5))';

  const statusText = emergencyStop ? 'Emergency Stop' : isRunning ? 'Bot Running' : isPaused ? 'Bot Paused' : 'Bot Stopped';
  const dotColor = emergencyStop ? 'bg-chart-5' : isRunning ? 'bg-chart-1' : isPaused ? 'bg-chart-4' : 'bg-muted-foreground';

  const stats = [
    { label: "Today's P/L", value: `${positive ? '+' : ''}$${Math.abs(todayPL).toFixed(2)}`, color: positive ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Available', value: `$${bankrollStats.available.toFixed(0)}`, color: 'text-foreground' },
    { label: 'ROI', value: `${bankrollStats.roi >= 0 ? '+' : ''}${bankrollStats.roi}%`, color: bankrollStats.roi >= 0 ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Win Rate', value: `${bankrollStats.strikeRate}%`, color: 'text-foreground' },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8">
      {/* Decorative glows */}
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-chart-3/5 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Status + Bankroll + Inline Stats */}
        <div className="space-y-4 flex-1 min-w-0">
          {/* Status pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`relative flex h-2.5 w-2.5 ${isRunning ? 'animate-pulse-glow' : ''}`}>
              <span className={`absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`} />
            </span>
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{statusText}</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-xs font-medium text-muted-foreground">Paper Trading</span>
            {botState.cycleNumber > 0 && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="text-xs font-mono text-muted-foreground">Cycle #{botState.cycleNumber}</span>
              </>
            )}
          </div>

          {/* Bankroll */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1">Total Bankroll</div>
            <div className="text-4xl md:text-5xl font-bold font-mono text-foreground tracking-tight">
              ${bankrollStats.bankroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Inline stats */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {stats.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <div className="h-8 w-px bg-border hidden sm:block" />}
                <div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</div>
                  <div className={`text-base md:text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right: Sparkline */}
        <div className="w-full lg:w-56 h-20 lg:h-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={plData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="heroPLGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="pl" stroke={chartColor} strokeWidth={2} fill="url(#heroPLGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}