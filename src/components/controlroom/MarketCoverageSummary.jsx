import React from 'react';
import { StatusBadge } from '@/components/ui/Trading';

export default function MarketCoverageSummary({ coverage }) {
  if (!coverage) return null;
  const filtered = coverage.marketsRejectedBeforeEngine || 0;
  return <div className="rounded-lg border border-border-subtle bg-muted/20 p-3 space-y-2">
    <div className="flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Selected Race Market Coverage</span><StatusBadge status={filtered ? 'warning' : 'ok'}>{filtered ? `${filtered} filtered` : 'Catalogue mapped'}</StatusBadge></div>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
      <Metric label="WIN" value={coverage.uniqueWinMarketCount || 0} />
      <Metric label="PLACE" value={coverage.uniquePlaceMarketCount || 0} />
      <Metric label="H2H" value={coverage.uniqueH2HMarketCount || 0} />
      <Metric label="UNKNOWN" value={coverage.unknownMarketCount || 0} />
      <Metric label="Runners" value={coverage.totalRunnerCount || 0} />
    </div>
    <div className="text-[10px] text-muted-foreground">{coverage.uniquePlaceMarketCount ? 'PLACE returned by Betfair.' : 'PLACE unavailable on Betfair for this race.'} {coverage.uniqueH2HMarketCount ? 'H2H returned by Betfair.' : 'H2H unavailable on Betfair for this race.'}</div>
    {filtered > 0 && <div className="text-[10px] text-warning">Returned but filtered by this app: {coverage.rejectionReasons.map(item=>`${item.marketId}: ${item.reason}`).join('; ')}</div>}
  </div>;
}
function Metric({ label, value }) { return <div className="rounded border border-border-subtle bg-card p-2"><div className="text-[9px] uppercase text-muted-foreground">{label}</div><div className="font-mono font-semibold text-foreground">{value}</div></div>; }