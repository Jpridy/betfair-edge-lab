import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, SideBadge, StatusBadge } from '@/components/ui/Trading';

export default function DashboardOpportunities() {
  const { exchangeOpportunities, botCycles } = useApp();
  const cycle = botCycles[0]?.scanSummary || {};
  const combined = [...(exchangeOpportunities || []), ...(cycle.topOpportunities || []), ...(cycle.topRejected || [])];
  const unique = [...new Map(combined.map((o, i) => [o.opportunityId || `${o.marketId}-${o.selectionId}-${o.side}-${i}`, o])).values()];
  const accepted = unique.filter(o => o.decision === 'BET' || o.passed).sort((a, b) => (b.ev || 0) - (a.ev || 0)).slice(0, 3);
  const rejected = unique.filter(o => o.decision === 'NO_BET' || (!o.passed && o.blockers?.length)).sort((a, b) => (b.ev || 0) - (a.ev || 0)).slice(0, 3);
  const rows = [...accepted, ...rejected];
  return <Panel title="Current Opportunities" subtitle="Best accepted and rejected candidates from the latest scan">
    {rows.length ? <div className="divide-y divide-border">{rows.map((o, i) => (
      <div key={o.opportunityId || i} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
        <SideBadge side={o.side || 'BACK'} />
        <div className="min-w-0 flex-1"><div className="font-medium text-foreground truncate">{o.runnerName || 'Unknown runner'}</div><div className="text-xs text-muted-foreground truncate">{o.marketName || o.eventName || 'Unknown market'}</div></div>
        <div className="font-mono text-foreground">{o.odds?.toFixed(2) || '—'}</div>
        <div className="font-mono text-foreground">EV ${Number(o.ev || 0).toFixed(2)}</div>
        <StatusBadge status={o.decision === 'BET' || o.passed ? 'ok' : 'warning'}>{o.decision === 'BET' || o.passed ? 'Accepted' : 'Rejected'}</StatusBadge>
        {!(o.decision === 'BET' || o.passed) && <div className="w-full pl-14 text-xs text-warning">{o.specificNoBetReason || o.failedGate || o.blocker || o.blockers?.[0] || 'Below active threshold'}</div>}
      </div>
    ))}</div> : <div className="p-8 text-center text-sm text-muted-foreground">Run a scan to evaluate current opportunities.</div>}
  </Panel>;
}