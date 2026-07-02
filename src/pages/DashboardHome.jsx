import React from 'react';
import { Panel, StatusBadge, SideBadge, PLValue } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Link } from 'react-router-dom';
import { Activity, TrendingUp, TrendingDown, Wallet, Target, Zap, Bot, Clock, AlertTriangle, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import OnboardingChecklist from '@/components/OnboardingChecklist';

export default function DashboardHome() {
  const { bankrollStats, markets, paperOrders, strategySignals, mode, emergencyStop, demoMode, botState, botActivity, botSettings, botCycles, beginnerMode } = useApp();

  const isRunning = botState.running && !botState.paused && !emergencyStop;
  const isPaused = botState.paused && !emergencyStop;
  const lastCycle = botCycles[0];
  const lastBlockedCycle = botCycles.find(c => c.ordersBlocked > 0);
  const watchedMarkets = markets.filter(m => m.watched);
  const activeStrategies = botSettings.selectedStrategies;

  const cards = [
    {
      label: 'Bot Status',
      value: emergencyStop ? 'Emergency Stop' : isRunning ? 'Running' : isPaused ? 'Paused' : 'Stopped',
      sub: botState.cycleNumber > 0 ? `Cycle #${botState.cycleNumber}` : 'Not started',
      icon: Bot,
      color: emergencyStop ? 'text-chart-5' : isRunning ? 'text-chart-1' : 'text-muted-foreground',
      bg: emergencyStop ? 'bg-chart-5/10' : isRunning ? 'bg-chart-1/10' : '',
    },
    {
      label: 'Paper P/L Today',
      value: `${bankrollStats.todayPL >= 0 ? '+' : ''}$${bankrollStats.todayPL.toFixed(2)}`,
      sub: `${bankrollStats.roi}% ROI today`,
      icon: bankrollStats.todayPL >= 0 ? TrendingUp : TrendingDown,
      color: bankrollStats.todayPL >= 0 ? 'text-chart-1' : 'text-chart-5',
      bg: bankrollStats.todayPL >= 0 ? 'bg-chart-1/10' : 'bg-chart-5/10',
    },
    {
      label: 'Bankroll',
      value: `$${bankrollStats.bankroll.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      sub: `Available: $${bankrollStats.available.toFixed(0)}`,
      icon: Wallet,
      color: 'text-foreground',
      bg: '',
    },
    {
      label: 'Open Exposure',
      value: `$${bankrollStats.openExposure.toFixed(0)}`,
      sub: `${((bankrollStats.openExposure / bankrollStats.bankroll) * 100).toFixed(1)}% of bank`,
      icon: ShieldCheck,
      color: 'text-chart-4',
      bg: 'bg-chart-4/10',
    },
    {
      label: 'Signals Today',
      value: botState.signalsToday,
      sub: `${strategySignals.length} active signals`,
      icon: Zap,
      color: 'text-chart-3',
      bg: 'bg-chart-3/10',
    },
    {
      label: 'Paper Orders Today',
      value: botState.ordersToday,
      sub: botState.ordersBlockedToday > 0 ? `${botState.ordersBlockedToday} blocked by risk` : 'No blocks today',
      icon: Activity,
      color: 'text-chart-2',
      bg: 'bg-chart-2/10',
    },
    {
      label: 'Active Strategy',
      value: activeStrategies[0] || 'None',
      sub: `${activeStrategies.length} strategies enabled`,
      icon: Target,
      color: 'text-foreground',
      bg: '',
    },
    {
      label: 'Last Bot Cycle',
      value: botState.lastCycleTime ? new Date(botState.lastCycleTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—',
      sub: lastCycle ? `${lastCycle.marketsScanned} scanned, ${lastCycle.marketsPassedFilters} passed` : 'No cycles yet',
      icon: Clock,
      color: 'text-foreground',
      bg: '',
    },
  ];

  let nextAction = null;
  if (emergencyStop) {
    nextAction = { text: 'Emergency stop is active. Clear it from the red banner at the top to resume.', link: null };
  } else if (!botState.running && mode !== 'paper') {
    nextAction = { text: 'Switch to Paper Bot mode and start the bot from the Bot Control Centre.', link: '/bot-control', linkText: 'Go to Bot Control →' };
  } else if (!botState.running) {
    nextAction = { text: 'The bot is stopped. Start it from the Bot Control Centre to begin scanning and paper trading.', link: '/bot-control', linkText: 'Start Paper Bot →' };
  } else if (isPaused) {
    nextAction = { text: 'The bot is paused. It is still scanning but not placing new paper orders.', link: '/bot-control', linkText: 'Resume Bot →' };
  } else if (isRunning) {
    nextAction = { text: 'The bot is running. Watch the activity feed below for real-time updates.', link: null };
  }

  return (
    <div className="space-y-5">
      {beginnerMode && <OnboardingChecklist />}

      {beginnerMode && (
        <div className="bg-chart-3/10 border border-chart-3/20 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-chart-3 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">Welcome to Betfair Edge Lab.</span> This dashboard shows your bot's status, paper trading P/L, and recent activity.
            All trades are <span className="text-chart-1 font-medium">simulated paper trades</span> — no real money is at risk. Live trading is <span className="text-chart-5 font-medium">locked</span>.
          </p>
        </div>
      )}

      {/* 8 Large Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`bg-card border border-border rounded-lg p-4 ${c.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className={`text-xl md:text-2xl font-bold font-mono ${c.color}`}>{c.value}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{c.sub}</div>
            </div>
          );
        })}
      </div>

      {/* What to do next */}
      {nextAction && (
        <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-chart-3 shrink-0" />
            <span className="text-xs text-foreground">{nextAction.text}</span>
          </div>
          {nextAction.link && (
            <Link to={nextAction.link} className="text-xs font-bold text-chart-3 hover:underline shrink-0">
              {nextAction.linkText}
            </Link>
          )}
        </div>
      )}

      {/* Last block reason */}
      {lastBlockedCycle && (
        <div className="bg-chart-5/10 border border-chart-5/20 rounded-lg p-4 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-chart-5 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-chart-5">Last Trade Blocked</div>
            <div className="text-xs text-muted-foreground mt-0.5">{lastBlockedCycle.notes}</div>
          </div>
        </div>
      )}

      {/* Recent Signals + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Recent Signals" action={<Link to="/strategy" className="text-xs text-chart-3 hover:underline">View all →</Link>}>
          {strategySignals.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No signals yet. Start the bot to generate signals.</div>
          ) : (
            <div className="p-3 space-y-1.5">
              {strategySignals.slice(0, 6).map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Zap className="h-3 w-3 text-chart-3 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{s.strategyName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{s.reason}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="font-mono text-chart-1">+{s.edgePercent?.toFixed(2)}%</div>
                    <div className="text-[10px] text-muted-foreground">edge</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent Paper Orders" action={<Link to="/paper-trading" className="text-xs text-chart-3 hover:underline">View all →</Link>}>
          {paperOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No paper orders yet. Start the bot to place simulated trades.</div>
          ) : (
            <div className="p-3 space-y-1.5">
              {paperOrders.slice(0, 6).map(o => (
                <div key={o.id} className="flex items-center justify-between text-xs py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <SideBadge side={o.side} />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{o.runnerName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{o.strategyName} · {o.marketName}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    {o.result === 'pending' ? (
                      <StatusBadge status="info">Pending</StatusBadge>
                    ) : (
                      <PLValue value={o.netProfit} />
                    )}
                    <div className="text-[10px] text-muted-foreground">@ {o.matchedOdds?.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Bot Activity + Markets Watching */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Bot Activity Feed" action={<Link to="/bot-control" className="text-xs text-chart-3 hover:underline flex items-center gap-1"><Bot className="h-3 w-3" /> Bot Control →</Link>}>
          <div className="p-3 space-y-1 max-h-72 overflow-y-auto">
            {botActivity.length === 0 && <div className="text-xs text-muted-foreground text-center py-8">No activity yet. Start the bot to see real-time updates.</div>}
            {botActivity.slice(0, 15).map(a => (
              <div key={a.id} className="flex items-start gap-2.5 text-xs py-1.5 border-b border-border/50 last:border-0">
                <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-chart-2 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{a.action}</div>
                  <div className="text-muted-foreground truncate">{a.details}</div>
                </div>
                <div className="text-muted-foreground text-[10px] font-mono shrink-0">{new Date(a.timestamp).toLocaleTimeString('en-AU', { hour12: false })}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Markets Being Watched" action={<Link to="/scanner" className="text-xs text-chart-3 hover:underline">Scanner →</Link>}>
          <div className="p-3 space-y-1.5">
            {watchedMarkets.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">No markets being watched. Use the Market Scanner to add markets.</div>
            ) : (
              watchedMarkets.slice(0, 6).map(m => (
                <div key={m.id} className="flex items-center justify-between text-xs py-2 border-b border-border/50 last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{m.venue} — {m.marketName.split(' ').slice(-1)[0]}</div>
                    <div className="text-[10px] text-muted-foreground">{m.numberOfRunners} runners · ${(m.totalMatched / 1000).toFixed(1)}k matched</div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="font-mono text-muted-foreground">{new Date(m.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</div>
                    {m.inPlay ? <StatusBadge status="danger">In-Play</StatusBadge> : <StatusBadge status="ok">Open</StatusBadge>}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}