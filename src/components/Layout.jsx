import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AlertOctagon } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import StatusStrip from '@/components/StatusStrip';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';

const PAGE_TITLES = {
  '/': { title: 'Home Dashboard', subtitle: 'Bot control room overview' },
  '/bot-control': { title: 'Bot Control Centre', subtitle: 'Automated bot control and monitoring' },
  '/scanner': { title: 'Market Scanner', subtitle: 'Horse racing market scanner with filters' },
  '/strategy-library': { title: 'Strategy Library', subtitle: 'Catalogue of all trading strategies' },
  '/runner': { title: 'Runner View', subtitle: 'Detailed runner analysis and price ladder' },
  '/strategy': { title: 'Strategy Research Hub', subtitle: 'Strategy modules and signal generation' },
  '/paper-trading': { title: 'Paper Bot Orders', subtitle: 'Simulated order lifecycle and tracking' },
  '/backtesting': { title: 'Backtesting', subtitle: 'Historical data replay and simulation' },
  '/performance-analytics': { title: 'Performance Analytics', subtitle: 'Advanced metrics, equity curves, and distributions' },
  '/orders': { title: 'Orders', subtitle: 'Paper order history and management' },
  '/risk': { title: 'Risk Manager', subtitle: 'Risk checks and safety controls' },
  '/settings': { title: 'Settings', subtitle: 'App configuration and parameters' },
  '/logs': { title: 'Logs / Audit', subtitle: 'Audit trail and system events' },
};

export default function Layout() {
  const { emergencyStop, clearEmergencyStop } = useApp();
  const location = useLocation();
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Betfair Edge Lab', subtitle: '' };
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