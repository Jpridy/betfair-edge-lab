import React from 'react';
import { Menu } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TopBar({ title, subtitle, onMenuClick }) {
  const { apiConnected, jurisdiction, setJurisdiction, emergencyStop } = useApp();

  return (
    <header className="sticky top-0 z-30 h-14 glass-strong border-b border-border-subtle flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick} className="md:hidden p-1.5 rounded-md hover:bg-hover text-muted-foreground transition-colors">
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base md:text-lg font-heading font-semibold text-foreground leading-tight tracking-tight-brand truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <span className={cn(
          'inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-body font-semibold border tracking-label transition-colors',
          emergencyStop
            ? 'bg-danger/10 text-danger border-danger/25'
            : 'bg-success/10 text-success border-success/25'
        )}>
          {emergencyStop ? 'EMERGENCY STOP' : 'PAPER MODE'}
        </span>

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50">
          <div className={cn('h-1.5 w-1.5 rounded-full', apiConnected ? 'bg-success animate-pulse-dot' : 'bg-muted-foreground')} />
          <span className="text-[11px] font-body font-medium text-muted-foreground">{apiConnected ? 'API Connected' : 'Disconnected'}</span>
        </div>

        <Select value={jurisdiction} onValueChange={setJurisdiction}>
          <SelectTrigger className="h-8 w-[120px] md:w-[160px] text-xs border-border-subtle hidden sm:flex">
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