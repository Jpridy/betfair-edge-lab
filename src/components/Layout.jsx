import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { AlertOctagon, LayoutDashboard, SlidersHorizontal, BarChart3, Settings, Bug } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', subtitle: 'System status, latest decision, and bankroll' },
  '/controls': { title: 'Controls', subtitle: 'Bot operations, candidates, and cycle timeline' },
  '/analytics': { title: 'Analytics', subtitle: 'Performance, calibration, and order history' },
  '/settings': { title: 'Settings', subtitle: 'Thresholds, risk limits, AI, and system config' },
  '/debug': { title: 'Debug', subtitle: 'Diagnostics, raw data, and export tools' },
};

const MOBILE_NAV = [
  { label: 'Home', path: '/', icon: LayoutDashboard },
  { label: 'Controls', path: '/controls', icon: SlidersHorizontal },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: Settings },
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
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}