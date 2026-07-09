import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AlertOctagon } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import StatusStrip from '@/components/StatusStrip';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';

const PAGE_TITLES = {
  '/': { title: 'Control Centre', subtitle: 'Bot status, system health, decisions, opportunities, risk, and settlement' },
  '/dashboard': { title: 'Dashboard Summary (Legacy)', subtitle: 'Older dashboard view — use Control Centre for daily operations' },
  '/setup-wizard': { title: 'Setup Wizard', subtitle: 'Test all connections and configuration before running the bot' },
  '/scanner': { title: 'Markets', subtitle: 'Loaded Betfair markets, price data, and market type detection' },
  '/exchange-opportunities': { title: 'Exchange Opportunities', subtitle: 'WIN, PLACE & H2H value scanner — BACK and LAY with EV, ROI, and blockers' },
  '/orders': { title: 'Orders & Settlement', subtitle: 'Paper order lifecycle, settlement status, and full audit trail' },
  '/paper-trading': { title: 'Decision Logs', subtitle: 'Bot cycle decision history with reasoning and diagnostic detail' },
  '/risk': { title: 'Risk Manager', subtitle: 'Bankroll, exposure, liability, loss limits, and safety controls' },
  '/settings': { title: 'Settings Hub', subtitle: 'Bot mode, market filters, opportunity rules, risk, AI, Betfair, and settlement' },
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