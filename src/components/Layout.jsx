import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AlertOctagon } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', subtitle: 'System status, latest decision, opportunities, and next markets' },
  '/controls': { title: 'Controls', subtitle: 'Connections, bot actions, paper orders, and operational risk' },
  '/analytics': { title: 'Analytics', subtitle: 'Performance, order history, and decision review' },
  '/settings': { title: 'Settings', subtitle: 'Thresholds, risk limits, AI, and system configuration' },
  '/debug': { title: 'Debug', subtitle: 'Technical diagnostics, logs, raw data, and test tools' },
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
      <div className="md:ml-56 flex flex-col min-h-screen">
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
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}