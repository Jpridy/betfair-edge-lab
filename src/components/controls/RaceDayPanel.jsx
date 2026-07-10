import React from 'react';
import { CalendarDays, Database, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useRaceDay } from '@/lib/RaceDayContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';

export default function RaceDayPanel() {
  const { cache, schedule, status, load, refreshNearby, manualNext, debugNext, clear } = useRaceDay();
  const s = cache.summary || {}; const next = schedule.nextRace; const loaded = !!cache.loadedAt;
  const metrics = [['Races', s.totalRacesLoaded || 0], ['Markets', s.totalMarketsLoaded || 0], ['WIN', s.winMarketsLoaded || 0], ['PLACE', s.placeMarketsLoaded || 0], ['H2H', s.h2hMarketsLoaded || 0], ['Runners', s.totalRunnersLoaded || 0], ['Priced', s.marketsWithInitialPrices || 0], ['Cached packs', cache.racePacksByRaceKey.size]];
  return <Panel title="Race Day Cache" subtitle="Static AU race structures cached once; nearby prices stay current" action={<StatusBadge status={loaded ? 'ok' : 'warning'}>{loaded ? 'Loaded' : 'Not loaded'}</StatusBadge>}>
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">{metrics.map(([label, value]) => <div key={label} className="rounded-md border border-border-subtle bg-muted/20 p-2"><div className="text-[10px] uppercase tracking-label text-muted-foreground">{label}</div><div className="font-mono text-lg font-semibold">{value}</div></div>)}</div>
      <div className="rounded-md border border-border-subtle p-3 text-sm"><div className="flex items-center gap-2 font-medium"><CalendarDays className="h-4 w-4 text-primary" />{next ? next.eventName : 'No upcoming cached race'}</div><p className="mt-1 text-xs text-muted-foreground">{schedule.selectedRaceForScan ? `${schedule.selectedRaceForScan.eventName} is inside the scan window.` : loaded ? `Race day loaded. No race currently inside the scan window.${next?.secondsToJump ? ` Next window opens in about ${Math.max(0, Math.ceil((next.secondsToJump - 500) / 60))} minutes.` : ''}` : 'Load the Australian race day to prepare scanning.'}</p></div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><Button onClick={load} disabled={status === 'loading'}><Database />{loaded ? 'Refresh Race Day' : 'Load Race Day'}</Button><Button variant="outline" onClick={() => refreshNearby(true)} disabled={!loaded || status === 'refreshing'}><RefreshCw />Refresh Nearby Prices</Button><Button variant="outline" onClick={manualNext} disabled={!loaded}><Search />Manual Scan Next Race</Button><Button variant="outline" onClick={debugNext} disabled={!loaded}>Debug Scan Next Race</Button><Button variant="outline" onClick={clear} disabled={!loaded}><Trash2 />Clear Race Day Cache</Button></div>
    </div>
  </Panel>;
}