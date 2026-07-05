import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AlertOctagon } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import StatusStrip from '@/components/StatusStrip';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', subtitle: 'Real-time P/L, strategy health, and system activity across all paper trading' },
  '/bot-control': { title: 'Bot Control Centre', subtitle: 'Start, stop, and monitor automated market scanning and signal generation' },
  '/scanner': { title: 'Market Scanner', subtitle: 'Browse live Australian racing markets with liquidity and eligibility filters' },
  '/strategy-library': { title: 'Strategy Library', subtitle: 'Compare all strategies by status, performance, and live approval readiness' },
  '/runner': { title: 'Runner View', subtitle: 'Back/lay prices, edge, CLV estimate, and strategy suitability per runner' },
  '/strategy': { title: 'Strategy Research Hub', subtitle: 'Strategy modules and signal generation' },
  '/paper-trading': { title: 'Paper Trading', subtitle: 'Safe testing centre — place, track, and settle simulated orders before going live' },
  '/backtesting': { title: 'Backtesting', subtitle: 'Replay historical races to validate strategy performance before paper trading' },
  '/performance-analytics': { title: 'Performance Analytics', subtitle: 'Equity curves, drawdown, CLV trends, and profit breakdowns by strategy and market' },
  '/orders': { title: 'Orders', subtitle: 'Complete paper and live order history with full audit trail and filtering' },
  '/risk': { title: 'Risk Manager', subtitle: 'Global risk state, loss limits, exposure, and emergency controls for all trading' },
  '/settings': { title: 'Settings', subtitle: 'Betfair API, commission, bankroll, risk limits, and strategy configuration' },
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
          <div className="bg-destructive/20 border-b border-destructive/50 px-4 md:px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive font-bold text-xs md:text-sm">
              <AlertOctagon className="h-4 w-4 animate-pulse shrink-0" />
              <span>EMERGENCY STOP ACTIVE — All trading halted. Live mode disabled. Open paper orders cancelled.</span>
            </div>
            <Button size="sm" variant="outline" onClick={clearEmergencyStop} className="h-7 text-xs border-destructive/50 text-destructive hover:bg-destructive/10 shrink-0 ml-3">
              Clear
            </Button>
          </div>
        )}
        <StatusStrip />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}