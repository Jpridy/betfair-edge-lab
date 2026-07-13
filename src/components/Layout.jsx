import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { AlertOctagon, LayoutDashboard, SlidersHorizontal, BarChart3, Settings, Bug } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', subtitle: 'Start here — status, next action, and paper bankroll' },
  '/controls': { title: 'Paper Bot', subtitle: 'Start, stop, scan, settle, and inspect the current race' },
  '/analytics': { title: 'Results', subtitle: 'Paper P/L, calibration, orders, and research' },
  '/settings': { title: 'Setup', subtitle: 'Safe paper settings, risk limits, and model thresholds' },
  '/debug': { title: 'Debug', subtitle: 'Diagnostics, raw state, accounting checks, and export tools' },
};

const MOBILE_NAV = [
  { label: 'Home', path: '/', icon: LayoutDashboard },
  { label: 'Bot', path: '/controls', icon: SlidersHorizontal },
  { label: 'Results', path: '/analytics', icon: BarChart3 },
  { label: 'Setup', path: '/settings', icon: Settings },
  { label: 'Debug', path: '/debug', icon: Bug },
];

function MobileBottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-background md:hidden" aria-label="Mobile navigation">
      {MOBILE_NAV.map(item => {
        const Icon = item.icon;
        const active = location.pathname === item.path;
        return (
          <Link key={item.path} to={item.path} className={cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5', active ? 'text-primary' : 'text-muted-foreground')}>
            <Icon className="h-4 w-4" />
            <span className="text-[9px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  const { emergencyStop, clearEmergencyStop } = useApp();
  const location = useLocation();
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Betfair Edge Lab', subtitle: '' };
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-h-screen flex-col md:ml-60">
        <TopBar title={pageInfo.title} subtitle={pageInfo.subtitle} onMenuClick={() => setMobileOpen(true)} />
        {emergencyStop && (
          <div className="flex items-center justify-between border-b border-danger/30 bg-danger/15 px-4 py-2 md:px-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-danger md:text-sm">
              <AlertOctagon className="h-4 w-4 shrink-0 animate-pulse-dot" />
              <span>EMERGENCY STOP ACTIVE — paper scanning is halted.</span>
            </div>
            <Button size="sm" variant="outline" onClick={clearEmergencyStop} className="ml-3 h-7 shrink-0 border-danger/40 text-xs text-danger hover:bg-danger/10">
              Clear Stop
            </Button>
          </div>
        )}
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <div className="mx-auto max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
