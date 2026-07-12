import React from 'react';
import { Menu, AlertOctagon, Radio, Bot, MapPin } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import useAuthoritativeTradingState from '@/hooks/useAuthoritativeTradingState';
import { cn } from '@/lib/utils';
import { fmtAge } from '@/lib/format';
import { LiveStatusBadge } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';

export default function TopBar({ title, subtitle, onMenuClick }) {
  const { botState, triggerEmergencyStop, emergencyStop } = useApp();
  const auth = useAuthoritativeTradingState();
  const botRunning = botState.running && !botState.paused;

  const raceMonitoring = auth.currentRace;
  const raceName = raceMonitoring?.selectedRaceMarketDetails?.[0]?.marketName
    || raceMonitoring?.selectedRaceKey
    || 'No race selected';

  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button aria-label="Open navigation" onClick={onMenuClick} className="min-h-11 min-w-11 rounded-md text-muted-foreground hover:bg-hover md:hidden">
          <Menu className="mx-auto h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-lg font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[160px] truncate font-medium text-foreground">{raceName}</span>
        </div>
        <div className="hidden sm:block">
          <LiveStatusBadge status={auth.priceFeedStatus} age={auth.priceAgeSeconds != null ? `${auth.priceAgeSeconds}s` : undefined} source={auth.dataSource} />
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <Radio className="h-3.5 w-3.5 shrink-0" />
          <span>{fmtAge(auth.lastActualPriceUpdateAt)}</span>
        </div>
        <div className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-body font-semibold tracking-label', botRunning ? 'bg-success/10 text-success border-success/25' : 'bg-muted text-muted-foreground border-border')}>
          <Bot className="h-3 w-3 shrink-0" />
          <span className="hidden sm:inline">{botRunning ? 'Running' : botState.paused ? 'Paused' : 'Stopped'}</span>
        </div>
        {!emergencyStop && (
          <Button size="sm" variant="destructive" onClick={triggerEmergencyStop} className="h-8 px-2.5 text-xs gap-1.5">
            <AlertOctagon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Emergency Stop</span>
          </Button>
        )}
      </div>
    </header>
  );
}