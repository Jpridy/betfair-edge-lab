import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import useAuthoritativeTradingState from '@/hooks/useAuthoritativeTradingState';
import { Panel, LiveStatusBadge } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { fmtAge, fmtTime } from '@/lib/format';
import { MapPin, Clock, Users, DollarSign, Lock, Unlock, ArrowRight, Radio, AlertTriangle } from 'lucide-react';

function RaceMetric({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-md border border-border-subtle bg-muted/15 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-label text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />{label}
      </div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${tone || 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function countdownLabel(startTime) {
  if (!startTime) return '—';
  const seconds = Math.max(0, Math.ceil((new Date(startTime).getTime() - Date.now()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function marketMatches(market, detail) {
  if (!market || !detail) return false;
  const ids = [market.id, market.marketId, market.betfairMarketId].filter(Boolean).map(String);
  const detailIds = [detail.marketId, detail.betfairMarketId, detail.normalizedMarketId].filter(Boolean).map(String);
  return ids.some(id => detailIds.includes(id));
}

export default function CurrentRaceCard() {
  const { markets, runners } = useApp();
  const state = useAuthoritativeTradingState();
  const raceMonitoring = state.currentRace;
  const details = raceMonitoring?.selectedRaceMarketDetails || [];
  const raceKey = raceMonitoring?.selectedRaceKey;
  const primaryDetail = details.find(item => item.accepted) || details[0];
  const selectedMarket = markets.find(market => marketMatches(market, primaryDetail)) || markets.find(market => market.status === 'OPEN' && !market.inPlay);
  const marketIds = new Set([selectedMarket?.id, selectedMarket?.marketId, selectedMarket?.betfairMarketId, primaryDetail?.marketId, primaryDetail?.betfairMarketId, primaryDetail?.normalizedMarketId].filter(Boolean).map(String));
  const raceRunners = runners.filter(runner => marketIds.has(String(runner.marketId)) || marketIds.has(String(runner.betfairMarketId)));
  const totalMatched = selectedMarket?.totalMatched ?? primaryDetail?.totalMatched ?? 0;
  const startTime = selectedMarket?.startTime || selectedMarket?.marketStartTime || raceMonitoring?.selectedRaceStartTime;
  const locked = raceMonitoring?.raceLocked === true;
  const venue = selectedMarket?.venue || raceMonitoring?.venue || primaryDetail?.venue || 'No race selected';
  const raceNumber = selectedMarket?.raceNumber || raceMonitoring?.selectedRaceNumber || primaryDetail?.raceNumber || '—';
  const raceName = selectedMarket?.eventName || selectedMarket?.marketName || raceMonitoring?.selectedRaceName || raceKey || 'Waiting for a race to scan';
  const marketType = selectedMarket?.marketTypeCode || selectedMarket?.marketType || primaryDetail?.marketType || '—';

  if (!raceKey && !selectedMarket) {
    return (
      <Panel title="Current Race" subtitle="The race the bot is monitoring">
        <div className="p-5">
          <div className="rounded-lg border border-warning/25 bg-warning/8 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-warning"><AlertTriangle className="h-4 w-4" />No race selected yet</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Connect Betfair data and wait for live prices. The bot will pick the next valid pre-race market inside the scan window.</p>
          </div>
          <Button asChild size="sm" className="mt-3 w-full"><Link to="/controls">Open Controls <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Current Race"
      subtitle="The one race the bot is allowed to act on right now"
      action={<LiveStatusBadge status={state.priceFeedStatus} age={state.priceAgeSeconds != null ? `${state.priceAgeSeconds}s` : undefined} source={state.dataSource} />}
    >
      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-base font-heading font-semibold text-foreground md:text-lg">{venue} — Race {raceNumber}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{raceName}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded-md border border-border-subtle bg-muted/20 px-2 py-0.5 text-muted-foreground">{marketType}</span>
              <span className="rounded-md border border-border-subtle bg-muted/20 px-2 py-0.5 text-muted-foreground">{details.length || 1} linked market(s)</span>
            </div>
          </div>
          <div className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-body font-semibold tracking-label ${locked ? 'border-warning/25 bg-warning/10 text-warning' : 'border-success/25 bg-success/10 text-success'}`}>
            {locked ? <><Lock className="mr-1 inline h-3 w-3" />Locked by open order</> : <><Unlock className="mr-1 inline h-3 w-3" />Unlocked</>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <RaceMetric icon={Clock} label="Start" value={startTime ? fmtTime(startTime) : '—'} />
          <RaceMetric icon={Clock} label="Countdown" value={countdownLabel(startTime)} />
          <RaceMetric icon={Users} label="Runners" value={String(raceRunners.length || primaryDetail?.runnerCount || '—')} />
          <RaceMetric icon={DollarSign} label="Matched" value={totalMatched > 0 ? `$${Number(totalMatched).toLocaleString('en-AU', { maximumFractionDigits: 0 })}` : '—'} />
          <RaceMetric icon={Radio} label="Price data" value={state.priceFeedStatus} tone={state.priceFeedStatus === 'LIVE' ? 'text-success' : 'text-warning'} />
          <RaceMetric icon={MapPin} label="Data age" value={fmtAge(state.lastActualPriceUpdateAt)} />
        </div>
        <Button asChild size="sm" className="w-full">
          <Link to="/controls">Open Controls <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </div>
    </Panel>
  );
}
