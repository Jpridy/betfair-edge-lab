import React from 'react';
import DashboardHero from '@/components/dashboard/DashboardHero';
import DashboardMetrics from '@/components/dashboard/DashboardMetrics';
import DashboardActivity from '@/components/dashboard/DashboardActivity';
import { StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Link } from 'react-router-dom';
import {
  Bot, Radar, BarChart3, TrendingUp, ArrowRight, Info,
} from 'lucide-react';

export default function DashboardHome() {
  const {
    markets, paperOrders, mode, emergencyStop, botState,
    beginnerMode,
  } = useApp();

  const isRunning = botState.running && !botState.paused && !emergencyStop;
  const isPaused = botState.paused && !emergencyStop;
  const watchedMarkets = markets.filter(m => m.watched);

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
    <div className="space-y-6 animate-fade-in">
      {/* Welcome banner */}
      {beginnerMode && (
        <div className="flex items-start gap-2.5 rounded-xl border border-chart-3/20 bg-chart-3/5 px-4 py-3">
          <Info className="h-4 w-4 text-chart-3 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Welcome to Betfair Edge Lab.</span>{' '}
            This dashboard shows your bot's status, paper trading P/L, and recent activity.
            All trades are <span className="text-chart-1 font-medium">simulated paper trades</span> — no real money is at risk.
          </div>
        </div>
      )}

      {/* Hero */}
      <DashboardHero />

      {/* Next action */}
      {nextAction && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
          <div className="flex items-center gap-2.5">
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

      {/* Metrics */}
      <DashboardMetrics />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction to="/bot-control" icon={Bot} label="Bot Control" sub="Start/stop the bot" accent="purple" />
        <QuickAction to="/scanner" icon={Radar} label="Market Scanner" sub="Browse live markets" accent="blue" />
        <QuickAction to="/paper-trading" icon={BarChart3} label="Paper Trading" sub="View simulated orders" accent="green" />
        <QuickAction to="/performance-analytics" icon={TrendingUp} label="Analytics" sub="Performance charts" accent="yellow" />
      </div>

      {/* Activity */}
      <DashboardActivity />

      {/* Watched Markets */}
      {watchedMarkets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Markets Being Watched</h3>
            <Link to="/scanner" className="text-xs font-medium text-chart-3 hover:text-chart-3/80 flex items-center gap-1">
              Scanner <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {watchedMarkets.slice(0, 6).map(m => (
              <Link key={m.id} to="/scanner" className="block rounded-xl border border-border bg-card p-3.5 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-foreground">{m.venue}</span>
                  {m.inPlay
                    ? <StatusBadge status="danger">In-Play</StatusBadge>
                    : <StatusBadge status="ok">Open</StatusBadge>}
                </div>
                <div className="text-[11px] text-muted-foreground">{m.marketName}</div>
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span className="text-muted-foreground">{m.numberOfRunners} runners</span>
                  <span className="font-mono text-muted-foreground">${(m.totalMatched / 1000).toFixed(1)}k matched</span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/70 mt-1">
                  {new Date(m.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const QUICK_ACCENTS = {
  purple: 'bg-chart-2/10 text-chart-2',
  blue: 'bg-chart-3/10 text-chart-3',
  green: 'bg-chart-1/10 text-chart-1',
  yellow: 'bg-chart-4/10 text-chart-4',
};

function QuickAction({ to, icon: Icon, label, sub, accent }) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-all"
    >
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${QUICK_ACCENTS[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground">{label}</div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
      </div>
    </Link>
  );
}