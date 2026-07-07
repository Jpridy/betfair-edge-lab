import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Radar, Eye, FlaskConical, FileText, History, ListOrdered, Shield, Settings, ScrollText, AlertOctagon, X, Bot, BookOpen, BarChart3 } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Home Dashboard', path: '/', icon: Home },
  { label: 'Bot Control Centre', path: '/bot-control', icon: Bot },
  { label: 'Market Scanner', path: '/scanner', icon: Radar },
  { label: 'Strategy Library', path: '/strategy-library', icon: BookOpen },
  { label: 'Strategy Research Hub', path: '/strategy', icon: FlaskConical },
  { label: 'Runner View', path: '/runner', icon: Eye },
  { label: 'Paper Bot Orders', path: '/paper-trading', icon: FileText },
  { label: 'Backtesting', path: '/backtesting', icon: History },
  { label: 'Performance Analytics', path: '/performance-analytics', icon: BarChart3 },
  { label: 'Orders', path: '/orders', icon: ListOrdered },
  { label: 'Risk Manager', path: '/risk', icon: Shield },
  { label: 'Settings', path: '/settings', icon: Settings },
  { label: 'Logs / Audit', path: '/logs', icon: ScrollText },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const location = useLocation();
  const { emergencyStop, triggerEmergencyStop, bankrollStats, mode } = useApp();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-sidebar-border">
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground whitespace-nowrap">
            BETFAIR <span className="text-primary">EDGE LAB</span>
          </span>
          <button onClick={onClose} className="md:hidden text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors mb-0.5',
                  isActive
                    ? 'bg-sidebar-accent text-primary'
                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-3">
          <div className="bg-sidebar-accent/50 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {mode === 'live' ? 'Live Mode' : 'Demo Mode'}
              </span>
              {emergencyStop && <span className="text-[10px] font-bold text-destructive animate-pulse">STOPPED</span>}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Bankroll</span>
              <span className="font-mono font-semibold text-sidebar-foreground">${(bankrollStats.bankroll || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Today's P/L</span>
              <span className={`font-mono font-semibold ${(bankrollStats.todayPL || 0) >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{(bankrollStats.todayPL || 0) >= 0 ? '+' : '-'}${Math.abs(bankrollStats.todayPL || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total P/L</span>
              <span className={`font-mono font-semibold ${(bankrollStats.totalPL || 0) >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{(bankrollStats.totalPL || 0) >= 0 ? '+' : '-'}${Math.abs(bankrollStats.totalPL || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Exposure</span>
              <span className="font-mono font-semibold text-sidebar-foreground">${((bankrollStats.openPaperExposure || 0) + (bankrollStats.openLiveExposure || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Available</span>
              <span className="font-mono font-semibold text-sidebar-foreground">${(bankrollStats.available || 0).toFixed(2)}</span>
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