import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';

const Metric = ({ label, value }) => <div className="rounded border border-border-subtle bg-muted/20 p-2"><div className="text-[9px] uppercase text-muted-foreground">{label}</div><div className="mt-1 text-xs font-semibold text-foreground">{value ?? '—'}</div></div>;

export default function SelectedRaceMonitoring() {
  const { lastExchangeDiagnostics, botCycles } = useApp();
  const data = lastExchangeDiagnostics?.raceMonitoring || botCycles[0]?.scanSummary || null;
  if (!data?.selectedRaceKey) return null;
  const details = data.selectedRaceMarketDetails || [];
  return <Panel title="Current Selected Race" subtitle="Monitoring and unique market diagnostics" action={<StatusBadge status={data.raceLocked ? 'warning' : 'ok'}>{data.raceMonitoringStatus?.replaceAll('_', ' ')}</StatusBadge>}>
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="Venue / Race" value={`${data.selectedRaceVenue || '—'} R${data.selectedRaceNumber || '—'}`} /><Metric label="Start" value={data.selectedRaceStartTime ? new Date(data.selectedRaceStartTime).toLocaleTimeString('en-AU') : '—'} /><Metric label="Seconds to jump" value={data.secondsToStart} /><Metric label="Cycles scanned" value={data.cyclesScannedOnThisRace || 0} /></div>
      <p className="text-xs text-muted-foreground">{data.reasonStillScanningRace}</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5"><Metric label="WIN" value={data.selectedRaceWinMarketCount || 0} /><Metric label="PLACE" value={data.selectedRacePlaceMarketCount || 0} /><Metric label="H2H" value={data.selectedRaceH2HMarketCount || 0} /><Metric label="Duplicates" value={data.selectedRaceDuplicateMarketCount || 0} /><Metric label="Primary WIN" value={data.primaryWinMarketId || 'None'} /></div>
      {data.raceLocked && <div className="rounded border border-warning/30 bg-warning/10 p-2 text-xs text-warning">Race locked: {data.raceLockReason}. Active orders: {(data.activeOrderIdsForRace || []).join(', ') || 'record found'}.</div>}
      <div className="space-y-1">{details.map((market, index) => <div key={`${market.normalizedMarketId}-${index}`} className="flex flex-wrap justify-between gap-2 rounded border border-border-subtle px-2 py-1.5 text-[10px]"><span>{market.marketId} · {market.marketName} · {market.marketType} · {market.runnerCount} runners</span><span className={market.accepted ? 'text-success' : 'text-warning'}>{market.accepted ? `Accepted — ${market.acceptanceReason}` : market.rejectionReason}</span></div>)}</div>
    </div>
  </Panel>;
}