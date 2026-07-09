import React from 'react';
import DashboardHero from '@/components/dashboard/DashboardHero';
import DashboardStatCards from '@/components/dashboard/DashboardStatCards';
import StrategyStatusSummary from '@/components/dashboard/StrategyStatusSummary';
import DashboardActivityFeed from '@/components/dashboard/DashboardActivityFeed';
import BestWorstStrategy from '@/components/dashboard/BestWorstStrategy';
import FormDataCoverage from '@/components/dashboard/FormDataCoverage';
import WhyNoBetPanel from '@/components/bot/WhyNoBetPanel';
import { useApp } from '@/lib/AppContext';
import { Link } from 'react-router-dom';
import { Bot, Radar, BarChart3, TrendingUp, ArrowRight, Shield } from 'lucide-react';

const QUICK_ACCENTS = {
  purple: 'bg-primary/10 text-primary',
  blue: 'bg-info/10 text-info',
  green: 'bg-success/10 text-success',
  yellow: 'bg-warning/10 text-warning',
  red: 'bg-danger/10 text-danger'
};

function QuickAction({ to, icon: Icon, label, sub, accent }) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-all">
      
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
    </Link>);

}

export default function DashboardHome() {
  const { emergencyStop, botState, lastScanDiagnostics } = useApp();

  const isRunning = botState.running && !botState.paused && !emergencyStop;
  const isPaused = botState.paused && !emergencyStop;

  let nextAction = null;
  if (emergencyStop) {
    nextAction = { text: 'Emergency stop is active. Clear it from Settings → Risk to resume.', link: '/settings', linkText: 'Go to Settings' };
  } else if (!botState.running) {
    nextAction = { text: 'The bot is stopped. Start it to begin scanning and trading.', link: '/', linkText: 'Start Bot' };
  } else if (isPaused) {
    nextAction = { text: 'The bot is paused. It is still scanning but not placing new paper orders.', link: '/', linkText: 'Resume Bot' };
  } else if (isRunning) {
    nextAction = { text: 'The bot is running. Watch the activity feed below for real-time updates.', link: '/', linkText: 'Bot Control' };
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome banner */}
      






      

      {/* Hero */}
      <DashboardHero />

      {/* Next action */}
      {nextAction &&
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <ArrowRight className="h-4 w-4 text-info shrink-0" />
            <span className="text-xs text-foreground">{nextAction.text}</span>
          </div>
          {nextAction.link &&
        <Link to={nextAction.link} className="text-xs font-bold text-info hover:underline shrink-0 flex items-center gap-1">
               {nextAction.linkText} <ArrowRight className="h-3 w-3" />
            </Link>
        }
        </div>
      }

      {/* Why No Bet? — shown when last scan produced no paper order */}
      {lastScanDiagnostics?.noBetReason && <WhyNoBetPanel diagnostics={lastScanDiagnostics} />}

      {/* Stat Cards */}
      <DashboardStatCards />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <QuickAction to="/" icon={Bot} label="Control Centre" sub="Start/stop paper bot" accent="purple" />
        <QuickAction to="/scanner" icon={Radar} label="Markets" sub="Browse markets" accent="blue" />
        <QuickAction to="/paper-trading" icon={BarChart3} label="Paper Orders" sub="Place test orders" accent="green" />
        <QuickAction to="/performance-analytics" icon={TrendingUp} label="Analytics" sub="Paper performance" accent="green" />
        <QuickAction to="/settings" icon={Shield} label="Settings" sub="Connect & configure" accent="yellow" />
      </div>

      {/* Form Data Coverage */}
      <FormDataCoverage />

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

      {/* Paper Trading Workflow */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground mb-3">Paper Trading Workflow</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-info/20 text-info font-bold flex items-center justify-center text-[10px]">1</span>
            <Link to="/settings" className="text-info hover:underline">Connect Betfair market data</Link>
            <span className="text-muted-foreground">— link your Betfair account in Settings to stream live prices</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-info/20 text-info font-bold flex items-center justify-center text-[10px]">2</span>
            <Link to="/settings" className="text-info hover:underline">Check paper bankroll and risk limits</Link>
            <span className="text-muted-foreground">— review your paper bankroll, daily loss limit, and exposure rules</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-info/20 text-info font-bold flex items-center justify-center text-[10px]">3</span>
            <Link to="/" className="text-info hover:underline">Start the paper bot</Link>
            <span className="text-muted-foreground">— the bot scans markets, runs AI analysis, and places paper orders automatically</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-info/20 text-info font-bold flex items-center justify-center text-[10px]">4</span>
            <Link to="/paper-trading" className="text-info hover:underline">Review paper orders and analytics</Link>
            <span className="text-muted-foreground">— track settled P/L, win rate, CLV, and strategy performance</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
          This is a paper-only research tool. No real bets are placed. All orders are simulated.
        </div>
      </div>
    </div>);

}