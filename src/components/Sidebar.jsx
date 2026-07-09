import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, Settings, ScrollText, FileText, Wrench, ChevronDown, ChevronRight, AlertOctagon, X, Radar, Layers, Footprints, FlaskConical, History, BarChart3, ShieldAlert, BookOpen, Network, Zap } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';

const mainNav = [
  { label: 'Bot Control Centre', path: '/', icon: Bot },
  { label: 'Settings Hub', path: '/settings', icon: Settings },
  { label: 'Orders & Settlement', path: '/orders', icon: ScrollText },
  { label: 'Decision Logs', path: '/paper-trading', icon: FileText },
  { label: 'Setup Wizard', path: '/setup-wizard', icon: Zap },
];

const debugNav = [
  { label: 'Markets', path: '/scanner', icon: Radar },
  { label: 'Exchange Ops', path: '/exchange-opportunities', icon: Layers },
  { label: 'Runners', path: '/runner', icon: Footprints },
  { label: 'Strategy Lab', path: '/strategy', icon: FlaskConical },
  { label: 'Strategy Library', path: '/strategy-library', icon: BookOpen },
  { label: 'Backtesting', path: '/backtesting', icon: History },
  { label: 'Risk Manager', path: '/risk', icon: ShieldAlert },
  { label: 'Wiring Audit', path: '/wiring-audit', icon: Network },
  { label: 'Logs & Audit', path: '/logs', icon: FileText },
  { label: 'Analytics', path: '/performance-analytics', icon: BarChart3 },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const location = useLocation();
  const { emergencyStop, triggerEmergencyStop, bankrollStats, apiConnected, botState } = useApp();
  const [showDebug, setShowDebug] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border">
          <BrandLogo size={30} />
          <button onClick={onClose} className="md:hidden text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {mainNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors mb-0.5',
                  isActive(item.path)
                    ? 'bg-sidebar-accent text-primary'
                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setShowDebug(!showDebug)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors mt-2"
          >
            {showDebug ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <Wrench className="h-4 w-4 shrink-0" />
            <span>Advanced Debug</span>
          </button>

          {showDebug && (
            <div className="ml-3 border-l border-sidebar-border pl-2 mt-1 space-y-0">
              {debugNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors',
                      isActive(item.path)
                        ? 'bg-sidebar-accent/70 text-primary'
                        : 'text-muted-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/30'
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

        <div className="border-t border-sidebar-border p-3 space-y-3">
          <div className="bg-sidebar-accent/50 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paper Trading</span>
              <span className={cn('text-[10px] font-bold', apiConnected ? 'text-chart-1' : 'text-muted-foreground')}>
                {apiConnected ? 'CONNECTED' : 'PAPER ONLY'}
              </span>
            </div>
            {emergencyStop && (
              <div className="text-[10px] font-bold text-destructive animate-pulse">EMERGENCY STOP ACTIVE</div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Bankroll</span>
              <span className="font-mono font-semibold text-sidebar-foreground">${(bankrollStats.bankroll || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Today's P/L</span>
              <span className={`font-mono font-semibold ${(bankrollStats.todayPL || 0) >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{(bankrollStats.todayPL || 0) >= 0 ? '+' : '-'}${Math.abs(bankrollStats.todayPL || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Exposure</span>
              <span className="font-mono font-semibold text-sidebar-foreground">${((bankrollStats.openPaperExposure || 0) + (bankrollStats.openLiveExposure || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Bot</span>
              <span className={cn('font-mono font-semibold', botState.running && !botState.paused ? 'text-chart-1' : 'text-muted-foreground')}>
                {botState.running ? (botState.paused ? 'PAUSED' : 'RUNNING') : 'STOPPED'}
              </span>
            </div>
          </div>

          <Button
            onClick={triggerEmergencyStop}
            disabled={emergencyStop}
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-3 text-sm gap-2 border-2 border-destructive/50"
          >
            <AlertOctagon className="h-5 w-5" />
            EMERGENCY STOP
          </Button>
        </div>
      </aside>
    </>
  );
}