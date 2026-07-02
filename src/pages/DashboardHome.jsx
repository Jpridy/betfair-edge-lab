import React from 'react';
import { Metric, Section, InfoBox } from '@/components/ui/Streamlit';
import { SideBadge, PLValue, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Link } from 'react-router-dom';
import {
  Activity, TrendingUp, TrendingDown, Wallet, Target, Zap, Bot, Clock,
  ArrowRight, ShieldCheck, BarChart3, Radar,
} from 'lucide-react';

export default function DashboardHome() {
  const {
    bankrollStats, markets, paperOrders, strategySignals, mode,
    emergencyStop, demoMode, botState, botActivity, botSettings,
    botCycles, beginnerMode, apiConnected,
  } = useApp();

  const isRunning = botState.running && !botState.paused && !emergencyStop;
  const isPaused = botState.paused && !emergencyStop;
  const lastCycle = botCycles[0];
  const watchedMarkets = markets.filter(m => m.watched);
  const activeStrategies = botSettings.selectedStrategies;
  const settledOrders = paperOrders.filter(o => o.result === 'won' || o.result === 'lost');
  const winRate = settledOrders.length > 0
    ? ((settledOrders.filter(o => o.result === 'won').length / settledOrders.length) * 100).toFixed(1)
    : '0.0';

  // Next action banner
  let nextAction = null;
  if (emergencyStop) {
    nextAction = { text: 'Emergency stop is active. Clear it from the red banner at the top to resume.', link: null };
  } else if (!botState.running && mode !== 'paper') {
    nextAction = { text: 'Switch to Paper Bot mode and start the bot from the Bot Control Centre.', link: '/bot-control', linkText: 'Go to Bot Control' };
  } else if (!botState.running) {
    nextAction = { text: 'The bot is stopped. Start it to begin scanning and paper trading.', link: '/bot-control', linkText: 'Start Paper Bot' };
  } else if (isPaused) {
    nextAction = { text: 'The bot is paused. It is still scanning but not placing new paper orders.', link: '/bot-control', linkText: 'Resume Bot' };
  } else if (isRunning) {
    nextAction = { text: 'The bot is running. Watch the activity feed below for real-time updates.', link: null };
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Welcome banner */}
      {beginnerMode && (
        <InfoBox type="info">
          <div className="flex items-start gap-2">
            <span className="font-semibold">Welcome to Betfair Edge Lab.</span>
            <span className="text-muted-foreground">
              This dashboard shows your bot's status, paper trading P/L, and recent activity.
              All trades are <span className="text-chart-1 font-medium">simulated paper trades</span> — no real money is at risk.
            </span>
          </div>
        </InfoBox>
      )}

      {/* Next action */}
      {nextAction && (
        <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-chart-3 shrink-0" />
            <span className="text-xs text-foreground">{nextAction.text}</span>
          </div>
          {nextAction.link && (
            <Link to={nextAction.link} className="text-xs font-bold text-chart-3 hover:underline shrink-0 flex items-center gap-1">
              {nextAction.linkText} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      {/* ─── Key Metrics ─── */}
      <Section title="Key Metrics">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            label="Bot Status"
            value={emergencyStop ? 'Emergency' : isRunning ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
            delta={botState.cycleNumber > 0 ? `Cycle #${botState.cycleNumber}` : 'Not started'}
            deltaPositive={isRunning ? true : null}
            icon={Bot}
          />
          <Metric
            label="Bankroll"
            value={`$${bankrollStats.bankroll.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            delta={`Available: $${bankrollStats.available.toFixed(0)}`}
            icon={Wallet}
          />
          <Metric
            label="Today's P/L"
            value={`${bankrollStats.todayPL >= 0 ? '+' : ''}$${bankrollStats.todayPL.toFixed(2)}`}
            delta={`${bankrollStats.roi}% ROI today`}
            deltaPositive={bankrollStats.todayPL >= 0}
            icon={bankrollStats.todayPL >= 0 ? TrendingUp : TrendingDown}
          />
          <Metric
            label="Open Exposure"
            value={`$${bankrollStats.openExposure.toFixed(0)}`}
            delta={`${((bankrollStats.openExposure / bankrollStats.bankroll) * 100).toFixed(1)}% of bank`}
            deltaPositive={null}
            icon={ShieldCheck}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            label="Signals Today"
            value={botState.signalsToday}
            delta={`${strategySignals.length} active signals`}
            icon={Zap}
          />
          <Metric
            label="Orders Today"
            value={botState.ordersToday}
            delta={botState.ordersBlockedToday > 0 ? `${botState.ordersBlockedToday} blocked` : 'No blocks'}
            deltaPositive={botState.ordersBlockedToday > 0 ? false : null}
            icon={Activity}
          />
          <Metric
            label="Win Rate"
            value={`${winRate}%`}
            delta={`${settledOrders.length} settled orders`}
            deltaPositive={parseFloat(winRate) >= 50}
            icon={Target}
          />
          <Metric
            label="Last Cycle"
            value={botState.lastCycleTime
              ? new Date(botState.lastCycleTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
              : '—'}
            delta={lastCycle ? `${lastCycle.marketsScanned} scanned, ${lastCycle.marketsPassedFilters} passed` : 'No cycles yet'}
            icon={Clock}
          />
        </div>
      </Section>

      {/* ─── Quick Actions ─── */}
      <Section title="Quick Actions">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction to="/bot-control" icon={Bot} label="Bot Control" sub="Start/stop the bot" />
          <QuickAction to="/scanner" icon={Radar} label="Market Scanner" sub="Browse live markets" />
          <QuickAction to="/paper-trading" icon={BarChart3} label="Paper Trading" sub="View simulated orders" />
          <QuickAction to="/performance-analytics" icon={TrendingUp} label="Analytics" sub="Performance charts" />
        </div>
      </Section>

      {/* ─── Recent Activity ─── */}
      <Section title="Recent Signals" action={
        <Link to="/strategy" className="text-xs text-chart-3 hover:underline">View all</Link>
      }>
        {strategySignals.length === 0 ? (
          <EmptyState text="No signals yet. Start the bot to generate signals." />
        ) : (
          <div className="space-y-1">
            {strategySignals.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className="h-3 w-3 text-chart-3 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{s.strategyName}</span>
                    <span className="text-muted-foreground ml-2 truncate">{s.reason}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2 font-mono text-chart-1">
                  +{s.edgePercent?.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Recent Orders ─── */}
      <Section title="Recent Paper Orders" action={
        <Link to="/paper-trading" className="text-xs text-chart-3 hover:underline">View all</Link>
      }>
        {paperOrders.length === 0 ? (
          <EmptyState text="No paper orders yet. Start the bot to place simulated trades." />
        ) : (
          <div className="space-y-1">
            {paperOrders.slice(0, 5).map(o => (
              <div key={o.id} className="flex items-center justify-between text-xs py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <SideBadge side={o.side} />
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{o.runnerName}</span>
                    <span className="text-muted-foreground ml-2 truncate">{o.strategyName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-muted-foreground font-mono">@ {o.matchedOdds?.toFixed(2)}</span>
                  {o.result === 'pending'
                    ? <StatusBadge status="info">Pending</StatusBadge>
                    : <PLValue value={o.netProfit} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Bot Activity Feed ─── */}
      <Section title="Bot Activity Feed" action={
        <Link to="/bot-control" className="text-xs text-chart-3 hover:underline flex items-center gap-1">
          <Bot className="h-3 w-3" /> Bot Control
        </Link>
      }>
        {botActivity.length === 0 ? (
          <EmptyState text="No activity yet. Start the bot to see real-time updates." />
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {botActivity.slice(0, 12).map(a => (
              <div key={a.id} className="flex items-start gap-2.5 text-xs py-1.5 border-b border-border last:border-0">
                <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-chart-2 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{a.action}</span>
                  <span className="text-muted-foreground ml-2">{a.details}</span>
                </div>
                <span className="text-muted-foreground text-[10px] font-mono shrink-0">
                  {new Date(a.timestamp).toLocaleTimeString('en-AU', { hour12: false })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Markets Watched ─── */}
      <Section title="Markets Being Watched" action={
        <Link to="/scanner" className="text-xs text-chart-3 hover:underline">Scanner</Link>
      }>
        {watchedMarkets.length === 0 ? (
          <EmptyState text="No markets being watched. Use the Market Scanner to add markets." />
        ) : (
          <div className="space-y-1">
            {watchedMarkets.slice(0, 5).map(m => (
              <div key={m.id} className="flex items-center justify-between text-xs py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{m.venue} — {m.marketName.split(' ').slice(-1)[0]}</span>
                  <span className="text-muted-foreground ml-2">{m.numberOfRunners} runners · ${(m.totalMatched / 1000).toFixed(1)}k matched</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="font-mono text-muted-foreground">
                    {new Date(m.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {m.inPlay
                    ? <StatusBadge status="danger">In-Play</StatusBadge>
                    : <StatusBadge status="ok">Open</StatusBadge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, sub }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-start p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-accent transition-colors"
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 mb-3">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="text-sm font-bold text-foreground">{label}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </Link>
  );
}

function EmptyState({ text }) {
  return <div className="py-8 text-center text-xs text-muted-foreground">{text}</div>;
}