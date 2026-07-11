import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';

const Metric = ({ label, value }) => <div className="rounded border border-border-subtle bg-muted/20 p-2"><div className="text-[9px] uppercase text-muted-foreground">{label}</div><div className="mt-1 text-xs font-semibold text-foreground">{value ?? '—'}</div></div>;

export function SelectedRaceMonitoringView({ data }) {
  if (!data?.selectedRaceKey) return null;
  const details = data.selectedRaceMarketDetails || [];
  return <Panel title="Current Selected Race" subtitle="Monitoring and unique market diagnostics" action={<StatusBadge status={data.raceLocked ? 'warning' : 'ok'}>{data.raceMonitoringStatus?.replaceAll('_', ' ')}</StatusBadge>}>
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5"><Metric label="Monitoring status" value={data.raceMonitoringStatus?.replaceAll('_', ' ')} /><Metric label="Cycles scanned" value={data.cyclesScannedOnThisRace || 0} /><Metric label="Race locked" value={data.raceLocked ? 'Yes' : 'No'} /><Metric label="Active order" value={data.activeOrderExistsForRace ? 'Yes' : 'No'} /><Metric label="Active order IDs" value={(data.activeOrderIdsForRace || []).join(', ') || 'None'} /></div>
      <p className="text-xs text-muted-foreground">{data.reasonStillScanningRace}</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="Unique markets" value={data.selectedRaceUniqueMarketCount || 0} /><Metric label="Duplicate markets" value={data.selectedRaceDuplicateMarketCount || 0} /><Metric label="Duplicate detected" value={data.duplicateMarketRecordDetected ? 'Yes' : 'No'} /><Metric label="Diagnostic error" value={data.diagnosticError || 'None'} /></div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3"><Metric label="Lock reason" value={data.raceLockReason || 'None'} /><Metric label="Primary WIN" value={data.primaryWinMarketId || 'None'} /><Metric label="Secondary WIN IDs" value={(data.secondaryWinMarketIds || []).join(', ') || 'None'} /></div>
      {data.raceLocked && <div className="rounded border border-warning/30 bg-warning/10 p-2 text-xs text-warning">Race locked: {data.raceLockReason}. Active orders: {(data.activeOrderIdsForRace || []).join(', ') || 'record found'}.</div>}
      <p className="text-[10px] font-semibold uppercase tracking-label text-muted-foreground">Selected race market details</p>
      <div className="space-y-1">{details.map((market, index) => <div key={`${market.normalizedMarketId}-${index}`} className="flex flex-wrap justify-between gap-2 rounded border border-border-subtle px-2 py-1.5 text-[10px]"><span>{market.marketId} · {market.marketName} · {market.marketType} · {market.runnerCount} runners</span><span className={market.accepted ? 'text-success' : 'text-warning'}>{market.accepted ? `Accepted — ${market.acceptanceReason}` : market.rejectionReason}</span></div>)}</div>
    </div>
  </Panel>;
}

export default function SelectedRaceMonitoring() {
  const { lastExchangeDiagnostics, botCycles } = useApp();
  return <SelectedRaceMonitoringView data={lastExchangeDiagnostics?.raceMonitoring || botCycles[0]?.scanSummary || null} />;
}