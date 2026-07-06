import React, { useState, useEffect } from 'react';
import { Bell, HelpCircle, Menu, FlaskConical, Zap } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function TopBar({ title, subtitle, onMenuClick }) {
  const { apiConnected, demoMode, jurisdiction, setJurisdiction, notifications, mode, emergencyStop, changeMode } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const modeLabel = emergencyStop ? 'EMERGENCY STOP' : mode === 'live' ? 'LIVE' : 'DEMO';

  return (
    <header className="sticky top-0 z-30 h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick} className="md:hidden p-1.5 rounded-md hover:bg-accent">
          <Menu className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base md:text-lg font-bold text-foreground leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {demoMode && (
          <Badge variant="outline" className="bg-chart-4/10 text-chart-4 border-chart-4/30 text-xs font-bold hidden sm:inline-flex">
            DEMO DATA
          </Badge>
        )}
        <Badge variant="outline" className={cn(
          'text-xs font-bold border',
          emergencyStop ? 'bg-destructive/10 text-destructive border-destructive/30'
          : mode === 'live' ? 'bg-chart-5/10 text-chart-5 border-chart-5/30'
          : 'bg-chart-3/10 text-chart-3 border-chart-3/30'
        )}>
          {modeLabel}
        </Badge>
        <div className="hidden lg:flex items-center gap-1.5">
          <div className={cn('h-2 w-2 rounded-full', apiConnected ? 'bg-chart-1' : 'bg-muted-foreground')} />
          <span className="text-xs font-medium text-muted-foreground">{apiConnected ? 'API Connected' : 'Demo Mode'}</span>
        </div>

        <button
          onClick={() => changeMode(mode === 'demo' ? 'live' : 'demo')}
          disabled={!apiConnected && mode === 'demo'}
          className={cn(
            'h-8 px-3 rounded-md text-xs font-bold border flex items-center gap-1.5 transition-colors shrink-0',
            mode === 'live'
              ? 'bg-chart-5/10 text-chart-5 border-chart-5/30'
              : 'bg-chart-3/10 text-chart-3 border-chart-3/30',
            !apiConnected && mode === 'demo' && 'opacity-50 cursor-not-allowed'
          )}
          title={mode === 'demo' && !apiConnected ? 'Connect Betfair API in Settings to enable Live mode' : `Switch to ${mode === 'demo' ? 'Live' : 'Demo'} mode`}
        >
          {mode === 'live' ? <><Zap className="h-3.5 w-3.5" /> LIVE</> : <><FlaskConical className="h-3.5 w-3.5" /> DEMO</>}
        </button>
        <Select value={jurisdiction} onValueChange={setJurisdiction}>
          <SelectTrigger className="h-8 w-[140px] md:w-[180px] text-xs hidden sm:flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AU">Betfair Exchange AU</SelectItem>
            <SelectItem value="UK">Betfair Exchange UK</SelectItem>
            <SelectItem value="ES">Betfair Exchange ES</SelectItem>
            <SelectItem value="IT">Betfair Exchange IT</SelectItem>
            <SelectItem value="RO">Betfair Exchange RO</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs font-mono text-muted-foreground tabular-nums hidden md:inline">
          {currentTime.toLocaleTimeString('en-AU', { hour12: false })}
        </span>

        <button className="relative p-1.5 rounded-md hover:bg-accent transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {notifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center">
              {notifications}
            </span>
          )}
        </button>

        <button className="p-1.5 rounded-md hover:bg-accent transition-colors hidden sm:block">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}