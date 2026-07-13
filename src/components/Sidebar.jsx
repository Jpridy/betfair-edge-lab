import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, SlidersHorizontal, BarChart3, Settings, Bug, X, Lock, Wifi, WifiOff, Bot, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';
import BankrollPanel from '@/components/navigation/BankrollPanel';
import { useApp } from '@/lib/AppContext';

const NAV = [
  { label: 'Dashboard', helper: 'Start here', path: '/', icon: LayoutDashboard },
  { label: 'Paper Bot', helper: 'Start / stop / inspect', path: '/controls', icon: SlidersHorizontal },
  { label: 'Results', helper: 'P/L and calibration', path: '/analytics', icon: BarChart3 },
  { label: 'Setup', helper: 'Risk and model settings', path: '/settings', icon: Settings },
  { label: 'Debug', helper: 'Export and diagnose', path: '/debug', icon: Bug },
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
  const { apiConnected, botState } = useApp();
  const botRunning = botState.running && !botState.paused;

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-background/80 md:hidden" onClick={onClose} />}
      <aside className={cn('fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2">
            <BrandLogo size={28} />
            <div>
              <div className="text-sm font-heading font-semibold text-sidebar-foreground">Edge Lab</div>
              <div className="text-[10px] text-muted-foreground">Paper trading workstation</div>
            </div>
          </div>
          <button aria-label="Close menu" onClick={onClose} className="min-h-11 min-w-11 text-muted-foreground md:hidden">
            <X className="mx-auto h-5 w-5" />
          </button>
        </div>
        <div className="p-2.5">
          <div className="mb-2 rounded-lg border border-success/20 bg-success/8 px-3 py-2 text-[11px] text-success">
            <div className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="h-3.5 w-3.5" />Paper only</div>
            <div className="mt-0.5 text-muted-foreground">No real Betfair orders can be sent.</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-2.5">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={onClose} className={cn('flex min-h-12 items-center gap-3 rounded-lg px-3 transition-colors', active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground')}>
                <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{item.helper}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <BankrollPanel />
        <div className="border-t border-sidebar-border py-1.5">
          <SidebarBadge icon={apiConnected ? Wifi : WifiOff} label={apiConnected ? 'Betfair Connected' : 'Betfair Disconnected'} tone={apiConnected ? 'success' : 'danger'} />
          <SidebarBadge icon={Bot} label={botRunning ? 'Paper Bot Running' : botState.paused ? 'Paper Bot Paused' : 'Paper Bot Stopped'} tone={botRunning ? 'success' : 'warning'} />
          <SidebarBadge icon={Lock} label="Live Trading Locked" tone="warning" />
        </div>
        <div className="border-t border-sidebar-border px-3 py-2 text-[10px] text-muted-foreground">v1.0 · use Dashboard first</div>
      </aside>
    </>
  );
}
