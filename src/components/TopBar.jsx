import React from 'react';
import { Menu, FlaskConical, Zap } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function TopBar({ title, subtitle, onMenuClick }) {
  const { apiConnected, jurisdiction, setJurisdiction, mode, emergencyStop, changeMode } = useApp();

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

      <div className="flex items-center gap-2 md:gap-3">
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
      </div>
    </header>
  );
}