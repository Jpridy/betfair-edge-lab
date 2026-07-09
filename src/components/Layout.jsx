import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AlertOctagon } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import StatusStrip from '@/components/StatusStrip';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';

const PAGE_TITLES = {
  '/': { title: 'Bot Control Centre', subtitle: 'Single-screen control room — bot status, system health, decisions, opportunities, risk, and settlement' },
  '/dashboard': { title: 'Dashboard Summary', subtitle: 'Real-time P/L, strategy health, and system activity across all paper trading' },
  '/setup-wizard': { title: 'Setup Wizard', subtitle: 'Test all connections and configuration before running the bot' },
  '/scanner': { title: 'Market Scanner', subtitle: 'Browse live Australian racing markets with liquidity and eligibility filters' },
  '/strategy-library': { title: 'Strategy Library', subtitle: 'Compare all strategies by status, performance, and live approval readiness' },
  '/runner': { title: 'Runner View', subtitle: 'Back/lay prices, edge, CLV estimate, and strategy suitability per runner' },
  '/strategy': { title: 'Strategy Research Hub', subtitle: 'Strategy modules and signal generation' },
  '/paper-trading': { title: 'Decision Logs', subtitle: 'Bot cycle decision history with full reasoning and diagnostic detail' },
  '/backtesting': { title: 'Synthetic Backtest', subtitle: 'Replay simulated historical races to validate strategy performance before paper trading' },
  '/performance-analytics': { title: 'Performance Analytics', subtitle: 'Equity curves, drawdown, CLV trends, and profit breakdowns by strategy and market' },
  '/orders': { title: 'Orders & Settlement', subtitle: 'Complete paper order history with full audit trail and filtering' },
  '/risk': { title: 'Risk Manager', subtitle: 'Global risk state, loss limits, exposure, and emergency controls for all trading' },
  '/settings': { title: 'Settings Hub', subtitle: 'Bot mode, market filters, opportunity rules, risk management, AI, Betfair, and settlement configuration' },
  '/logs': { title: 'Logs / Audit', subtitle: 'Complete audit trail of every strategy, bot, order, and risk action' },
};

export default function Layout() {
  const { emergencyStop, clearEmergencyStop } = useApp();
  const location = useLocation();
  const pageInfo = PAGE_TITLES[location.pathname]
    || (location.pathname.startsWith('/strategy/') ? { title: 'Strategy Detail', subtitle: 'Full strategy audit and validation' } : null)
    || { title: 'Betfair Edge Lab', subtitle: '' };
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="md:ml-64 flex flex-col min-h-screen">
        <TopBar title={pageInfo.title} subtitle={pageInfo.subtitle} onMenuClick={() => setMobileOpen(true)} />
        {emergencyStop && (
          <div className="bg-danger/15 border-b border-danger/30 px-4 md:px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-danger font-body font-semibold text-xs md:text-sm">
              <AlertOctagon className="h-4 w-4 animate-pulse-dot shrink-0" />
              <span>EMERGENCY STOP ACTIVE — All trading halted. Open paper orders cancelled.</span>
            </div>
            <Button size="sm" variant="outline" onClick={clearEmergencyStop} className="h-7 text-xs border-danger/40 text-danger hover:bg-danger/10 shrink-0 ml-3">
              Clear
            </Button>
          </div>
        )}
        <StatusStrip />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}