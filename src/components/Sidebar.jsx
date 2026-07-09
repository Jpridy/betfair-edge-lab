import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, Settings, ScrollText, FileText, Wrench, ChevronDown, ChevronRight, AlertOctagon, X, Radar, Layers, Footprints, FlaskConical, History, BarChart3, ShieldAlert, BookOpen, Network, Zap, LayoutDashboard } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';

const mainNav = [
  { label: 'Control Centre', path: '/', icon: Bot },
  { label: 'Markets', path: '/scanner', icon: Radar },
  { label: 'Exchange Opportunities', path: '/exchange-opportunities', icon: Layers },
  { label: 'Orders & Settlement', path: '/orders', icon: ScrollText },
  { label: 'Decision Logs', path: '/paper-trading', icon: FileText },
  { label: 'Risk Manager', path: '/risk', icon: ShieldAlert },
  { label: 'Settings', path: '/settings', icon: Settings },
  { label: 'Setup', path: '/setup-wizard', icon: Zap },
];

const debugNav = [
  { label: 'Wiring Audit', path: '/wiring-audit', icon: Network },
  { label: 'Logs & Audit', path: '/logs', icon: FileText },
  { label: 'Runners', path: '/runner', icon: Footprints },
  { label: 'Analytics', path: '/performance-analytics', icon: BarChart3 },
  { label: 'Strategy Lab', path: '/strategy', icon: FlaskConical },
  { label: 'Strategy Library', path: '/strategy-library', icon: BookOpen },
  { label: 'Backtesting', path: '/backtesting', icon: History },
  { label: 'Old Dashboard', path: '/dashboard', icon: LayoutDashboard },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const location = useLocation();
  const { emergencyStop, triggerEmergencyStop, clearEmergencyStop, bankrollStats, apiConnected, botState } = useApp();
  const [showDebug, setShowDebug] = useState(false);

  const isActive = (path) => location.pathname === path;
  const botRunning = botState.running && !botState.paused && !emergencyStop;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border">
          <BrandLogo size={28} />
          <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          <div className="text-[9px] font-body font-semibold text-muted-foreground/60 uppercase tracking-label px-3 mb-1.5">Workspace</div>
          {mainNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-body font-medium transition-all mb-0.5',
                  isActive(item.path)
                    ? 'bg-primary/12 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60 border border-transparent'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive(item.path) ? 'text-primary' : '')} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setShowDebug(!showDebug)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-body font-medium text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all mt-3 border border-transparent"
          >
            {showDebug ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            <Wrench className="h-4 w-4 shrink-0" />
            <span>Advanced Debug</span>
          </button>

          {showDebug && (
            <div className="ml-3 border-l border-sidebar-border pl-2 mt-1 space-y-0 animate-slide-down">
              {debugNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-body font-medium transition-all',
                      isActive(item.path)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer — Bankroll summary + Emergency Stop */}
        <div className="border-t border-sidebar-border p-3 space-y-2.5">
          <div className="bg-sidebar-accent/50 rounded-lg p-3 space-y-1.5 border border-border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-body font-semibold uppercase tracking-label text-muted-foreground">Paper Trading</span>
              <div className="flex items-center gap-1">
                <div className={cn('h-1.5 w-1.5 rounded-full', apiConnected ? 'bg-success' : 'bg-muted-foreground')} />
                <span className={cn('text-[9px] font-body font-semibold', apiConnected ? 'text-success' : 'text-muted-foreground')}>
                  {apiConnected ? 'LIVE DATA' : 'PAPER ONLY'}
                </span>
              </div>
            </div>
            {emergencyStop && (
              <div className="text-[9px] font-body font-bold text-danger animate-pulse-dot">EMERGENCY STOP ACTIVE</div>
            )}
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Bankroll</span>
              <span className="font-mono tabular-nums font-semibold text-sidebar-foreground">${(bankrollStats.bankroll || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Today's P/L</span>
              <span className={cn('font-mono tabular-nums font-semibold', (bankrollStats.todayPL || 0) >= 0 ? 'text-success' : 'text-danger')}>
                {(bankrollStats.todayPL || 0) >= 0 ? '+' : '-'}${Math.abs(bankrollStats.todayPL || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Exposure</span>
              <span className="font-mono tabular-nums font-semibold text-sidebar-foreground">${((bankrollStats.openPaperExposure || 0) + (bankrollStats.openLiveExposure || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Bot</span>
              <span className={cn('font-mono tabular-nums font-semibold', botRunning ? 'text-success' : 'text-muted-foreground')}>
                {botState.running ? (botState.paused ? 'PAUSED' : 'RUNNING') : 'STOPPED'}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Mode</span>
              <span className="font-mono tabular-nums font-semibold text-info">PAPER ONLY</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Emergency</span>
              <span className={cn('font-mono tabular-nums font-semibold', emergencyStop ? 'text-danger' : 'text-success')}>
                {emergencyStop ? 'STOPPED' : 'READY'}
              </span>
            </div>
          </div>

          {botRunning ? (
            <Button
              onClick={triggerEmergencyStop}
              variant="destructive"
              className="w-full font-body font-semibold py-2.5 text-sm gap-2 border border-danger/40 hover:glow-red"
            >
              <AlertOctagon className="h-4 w-4" />
              EMERGENCY STOP
            </Button>
          ) : emergencyStop ? (
            <Button
              onClick={clearEmergencyStop}
              variant="outline"
              className="w-full font-body font-semibold py-2 text-xs gap-2 border-danger/40 text-danger hover:bg-danger/10"
            >
              <AlertOctagon className="h-3.5 w-3.5" />
              CLEAR EMERGENCY STOP
            </Button>
          ) : null}
        </div>
      </aside>
    </>
  );
}