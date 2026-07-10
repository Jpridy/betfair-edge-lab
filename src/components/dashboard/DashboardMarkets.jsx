import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';

export default function DashboardMarkets() {
  const { markets, runners } = useApp();
  const next = markets.filter(m => m.status === 'OPEN' && !m.inPlay).sort((a, b) => new Date(a.startTime || a.marketStartTime) - new Date(b.startTime || b.marketStartTime)).slice(0, 5);
  const priced = market => runners.some(r => (String(r.marketId) === String(market.id) || String(r.marketId) === String(market.betfairMarketId)) && (r.bestBackPrice > 0 || r.bestLayPrice > 0));
  return <Panel title="Next Markets" subtitle={`${markets.length} markets currently loaded`}>
    {next.length ? <div className="divide-y divide-border">{next.map(m => {
      const start = m.startTime || m.marketStartTime;
      return <div key={m.id || m.betfairMarketId} className="flex items-center gap-3 px-4 py-3 text-sm">
        <div className="w-16 font-mono text-muted-foreground">{start ? new Date(start).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
        <div className="min-w-0 flex-1"><div className="font-medium truncate">{m.eventName || m.venue || 'Race'}</div><div className="text-xs text-muted-foreground truncate">{m.marketName}</div></div>
        <StatusBadge status="neutral">{m.marketTypeCode || m.marketType || 'Market'}</StatusBadge>
        <StatusBadge status={priced(m) ? 'ok' : 'warning'}>{priced(m) ? 'Priced' : 'No price'}</StatusBadge>
      </div>;
    })}</div> : <div className="p-8 text-center text-sm text-muted-foreground">No open pre-race markets are loaded.</div>}
  </Panel>;
}