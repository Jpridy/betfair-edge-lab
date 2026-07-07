import React from 'react';
import { Menu } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function TopBar({ title, subtitle, onMenuClick }) {
  const { apiConnected, jurisdiction, setJurisdiction, emergencyStop } = useApp();

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
          : 'bg-chart-3/10 text-chart-3 border-chart-3/30'
        )}>
          {emergencyStop ? 'EMERGENCY STOP' : 'PAPER TRADING'}
        </Badge>

        <div className="hidden lg:flex items-center gap-1.5">
          <div className={cn('h-2 w-2 rounded-full', apiConnected ? 'bg-chart-1' : 'bg-muted-foreground')} />
          <span className="text-xs font-medium text-muted-foreground">{apiConnected ? 'API Connected' : 'Disconnected'}</span>
        </div>

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