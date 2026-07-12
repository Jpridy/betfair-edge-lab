import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import useAuthoritativeTradingState from '@/hooks/useAuthoritativeTradingState';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { LiveStatusBadge } from '@/components/ui/workstation';
import { fmtAge, fmtTime } from '@/lib/format';
import { MapPin, Clock, Users, DollarSign, Lock, Unlock, ArrowRight } from 'lucide-react';

function RaceMetric({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground">{label}:</span>
      <span className="text-[11px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

export default function CurrentRaceCard() {
  const { markets, runners } = useApp();
  const auth = useAuthoritativeTradingState();
  const raceMonitoring = auth.currentRace;
  const raceDetails = raceMonitoring?.selectedRaceMarketDetails?.[0];
  const raceKey = raceMonitoring?.selectedRaceKey;

  const selectedMarket = markets.find(m => m.status === 'OPEN' && !m.inPlay);
  const raceRunners = runners.filter(r => selectedMarket && (String(r.marketId) === String(selectedMarket.id) || String(r.marketId) === String(selectedMarket.betfairMarketId)));
  const totalMatched = selectedMarket?.totalMatched || 0;
  const startTime = selectedMarket?.startTime || selectedMarket?.marketStartTime;
  const countdown = startTime ? Math.max(0, Math.ceil((new Date(startTime).getTime() - Date.now()) / 1000)) : null;
  const locked = raceMonitoring?.raceLocked;

  const venue = selectedMarket?.venue || raceDetails?.marketName?.split(' - ')?.[0] || '—';
  const raceNumber = selectedMarket?.raceNumber || '—';
  const raceName = selectedMarket?.eventName || selectedMarket?.marketName || raceKey || 'No race selected';

  return (
    <Panel
      title="Current Race"
      subtitle="The race the bot is monitoring"
      action={raceKey ? <LiveStatusBadge status={auth.priceFeedStatus} age={auth.priceAgeSeconds != null ? `${auth.priceAgeSeconds}s` : undefined} /> : null}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-heading font-semibold text-foreground truncate">{venue} — Race {raceNumber}</div>
            <div className="text-xs text-muted-foreground truncate">{raceName}</div>
          </div>
          <div className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-body font-semibold tracking-label ${locked ? 'bg-warning/10 text-warning border-warning/25' : 'bg-success/10 text-success border-success/25'}`}>
            {locked ? <><Lock className="inline h-3 w-3 mr-1" />Locked</> : <><Unlock className="inline h-3 w-3 mr-1" />Unlocked</>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <RaceMetric icon={Clock} label="Start" value={startTime ? fmtTime(startTime) : '—'} />
          <RaceMetric icon={Clock} label="Countdown" value={countdown != null ? `${Math.floor(countdown / 60)}m ${countdown % 60}s` : '—'} />
          <RaceMetric icon={MapPin} label="Market" value={selectedMarket?.marketTypeCode || selectedMarket?.marketType || '—'} />
          <RaceMetric icon={Users} label="Runners" value={String(raceRunners.length || '—')} />
          <RaceMetric icon={DollarSign} label="Matched" value={totalMatched > 0 ? `$${totalMatched.toLocaleString('en-AU', { maximumFractionDigits: 0 })}` : '—'} />
          <RaceMetric icon={Clock} label="Data age" value={fmtAge(auth.lastActualPriceUpdateAt)} />
        </div>
        <Button asChild size="sm" className="w-full">
          <Link to="/controls">Open Controls <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </div>
    </Panel>
  );
}