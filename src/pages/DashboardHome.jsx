import React from 'react';
import DashboardHero from '@/components/dashboard/DashboardHero';
import DashboardStatCards from '@/components/dashboard/DashboardStatCards';
import StrategyStatusSummary from '@/components/dashboard/StrategyStatusSummary';
import DashboardActivityFeed from '@/components/dashboard/DashboardActivityFeed';
import BestWorstStrategy from '@/components/dashboard/BestWorstStrategy';
import { useApp } from '@/lib/AppContext';
import { Link } from 'react-router-dom';
import { Bot, Radar, BarChart3, TrendingUp, ArrowRight, Info, Shield, BookOpen, FlaskConical } from 'lucide-react';

const QUICK_ACCENTS = {
  purple: 'bg-chart-2/10 text-chart-2',
  blue: 'bg-chart-3/10 text-chart-3',
  green: 'bg-chart-1/10 text-chart-1',
  yellow: 'bg-chart-4/10 text-chart-4',
  red: 'bg-chart-5/10 text-chart-5',
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

export default function DashboardHome() {
  const { mode, emergencyStop, botState } = useApp();

  const isRunning = botState.running && !botState.paused && !emergencyStop;
  const isPaused = botState.paused && !emergencyStop;

  let nextAction = null;
  if (emergencyStop) {
    nextAction = { text: 'Emergency stop is active. Clear it from the Risk Manager to resume.', link: '/risk', linkText: 'Go to Risk Manager' };
  } else if (!botState.running) {
    nextAction = { text: 'The bot is stopped. Start it to begin scanning and trading.', link: '/bot-control', linkText: 'Start Bot' };
  } else if (isPaused) {
    nextAction = { text: 'The bot is paused. It is still scanning but not placing new paper orders.', link: '/bot-control', linkText: 'Resume Bot' };
  } else if (isRunning) {
    nextAction = { text: 'The bot is running. Watch the activity feed below for real-time updates.', link: '/bot-control', linkText: 'Bot Control' };
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-chart-3/20 bg-chart-3/5 px-4 py-3">
          <Info className="h-4 w-4 text-chart-3 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Betfair Edge Lab — Strategy Validation System.</span>{' '}
            All trades are <span className="text-chart-1 font-medium">simulated paper trades</span>. No strategy goes live until it passes 200+ settled trades, positive CLV, profit factor &gt; 1.20, and admin review.
            Start at the <Link to="/scanner" className="text-chart-3 hover:underline">Market Scanner</Link>, then flow through Runner View → Paper Order → Orders → Analytics.
          </div>
      </div>

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

      {/* Stat Cards */}
      <DashboardStatCards />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <QuickAction to="/bot-control" icon={Bot} label="Bot Control" sub="Start/stop bot" accent="purple" />
        <QuickAction to="/scanner" icon={Radar} label="Scanner" sub="Browse markets" accent="blue" />
        <QuickAction to="/paper-trading" icon={BarChart3} label="Paper Trading" sub="Test orders" accent="green" />
        <QuickAction to="/strategy-library" icon={BookOpen} label="Strategies" sub="View library" accent="yellow" />
        <QuickAction to="/performance-analytics" icon={TrendingUp} label="Analytics" sub="Performance" accent="green" />
        <QuickAction to="/risk" icon={Shield} label="Risk Manager" sub="Safety rules" accent="red" />
      </div>

      {/* Best / Worst Strategy */}
      <BestWorstStrategy />

      {/* Strategy Status + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <StrategyStatusSummary />
        </div>
        <div className="lg:col-span-2">
          <DashboardActivityFeed />
        </div>
      </div>

      {/* Workflow guide */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground mb-3">Trading Research Workflow</h3>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Link to="/scanner" className="px-2.5 py-1 rounded-md bg-chart-3/10 text-chart-3 border border-chart-3/30 hover:opacity-80">Market Scanner</Link>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Link to="/runner" className="px-2.5 py-1 rounded-md bg-chart-3/10 text-chart-3 border border-chart-3/30 hover:opacity-80">Runner View</Link>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border">Strategy Signal</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Link to="/paper-trading" className="px-2.5 py-1 rounded-md bg-chart-1/10 text-chart-1 border border-chart-1/30 hover:opacity-80">Paper Order</Link>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Link to="/orders" className="px-2.5 py-1 rounded-md bg-chart-1/10 text-chart-1 border border-chart-1/30 hover:opacity-80">Orders</Link>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Link to="/performance-analytics" className="px-2.5 py-1 rounded-md bg-chart-2/10 text-chart-2 border border-chart-2/30 hover:opacity-80">Analytics</Link>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Link to="/strategy-library" className="px-2.5 py-1 rounded-md bg-chart-4/10 text-chart-4 border border-chart-4/30 hover:opacity-80">Strategy Detail</Link>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Link to="/risk" className="px-2.5 py-1 rounded-md bg-chart-5/10 text-chart-5 border border-chart-5/30 hover:opacity-80">Risk Manager</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] mt-2">
          <Link to="/strategy-library" className="px-2.5 py-1 rounded-md bg-chart-4/10 text-chart-4 border border-chart-4/30 hover:opacity-80">Strategy Library</Link>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Link to="/backtesting" className="px-2.5 py-1 rounded-md bg-chart-2/10 text-chart-2 border border-chart-2/30 hover:opacity-80">Backtesting</Link>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Link to="/paper-trading" className="px-2.5 py-1 rounded-md bg-chart-1/10 text-chart-1 border border-chart-1/30 hover:opacity-80">Paper Trading</Link>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="px-2.5 py-1 rounded-md bg-chart-1/10 text-chart-1 border border-chart-1/30">Live Approval Review</span>
        </div>
      </div>
    </div>
  );
}