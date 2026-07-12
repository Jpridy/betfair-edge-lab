import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, SlidersHorizontal, BarChart3, Settings, Bug, X, Lock, Wifi, WifiOff, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';
import BankrollPanel from '@/components/navigation/BankrollPanel';
import { useApp } from '@/lib/AppContext';

const NAV = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Controls', path: '/controls', icon: SlidersHorizontal },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: Settings },
  { label: 'Debug', path: '/debug', icon: Bug },
];

function SidebarBadge({ icon: Icon, label, tone }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', toneClass)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export default function Sidebar({ mobileOpen, onClose }) {
  const location = useLocation();
  const { apiConnected, botState, settings } = useApp();
  const botRunning = botState.running && !botState.paused;

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-background/80 md:hidden" onClick={onClose} />}
      <aside className={cn('fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <BrandLogo size={24} />
          <button aria-label="Close menu" onClick={onClose} className="min-h-11 min-w-11 text-muted-foreground md:hidden">
            <X className="mx-auto h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 p-2.5">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={onClose} className={cn('flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors', active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground')}>
                <Icon className={cn('h-4 w-4', active && 'text-primary')} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <BankrollPanel />
        <div className="border-t border-sidebar-border py-1.5">
          <SidebarBadge icon={apiConnected ? Wifi : WifiOff} label={apiConnected ? 'Betfair Connected' : 'Betfair Disconnected'} tone={apiConnected ? 'success' : 'danger'} />
          <SidebarBadge icon={Bot} label={botRunning ? 'Bot Running' : botState.paused ? 'Bot Paused' : 'Bot Stopped'} tone={botRunning ? 'success' : 'warning'} />
          <SidebarBadge icon={Lock} label="Paper-Only Locked" tone="warning" />
        </div>
        <div className="border-t border-sidebar-border px-3 py-2 text-[10px] text-muted-foreground">v1.0 · Paper trading only</div>
      </aside>
    </>
  );
}