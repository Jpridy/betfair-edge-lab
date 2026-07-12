import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import useAuthoritativeTradingState from '@/hooks/useAuthoritativeTradingState';
import { fmtAge, fmtTime } from '@/lib/format';

function DataMetric({ label, value }) {
  return (
    <div className="rounded-md border border-border-subtle bg-muted/20 p-2.5">
      <div className="text-[10px] uppercase tracking-label text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-foreground">{value ?? '—'}</div>
    </div>
  );
}

export default function DebugLiveData() {
  const { markets, runners, exchangeOpportunities, paperOrders, betfairConnection } = useApp();
  const auth = useAuthoritativeTradingState();

  const pricedRunners = runners.filter(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0)).length;
  const raceMonitoring = auth.currentRace;

  return (
    <div className="space-y-4">
      <Panel title="Live Data" subtitle="Current in-memory data state and freshness">
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <DataMetric label="Current Race" value={raceMonitoring?.selectedRaceKey || 'None'} />
          <DataMetric label="Markets" value={String(markets.length)} />
          <DataMetric label="Runners" value={String(runners.length)} />
          <DataMetric label="Priced Runners" value={String(pricedRunners)} />
          <DataMetric label="Opportunities" value={String(exchangeOpportunities.length)} />
          <DataMetric label="Orders" value={String(paperOrders.length)} />
          <DataMetric label="Source" value={auth.dataSource} />
          <DataMetric label="Freshness" value={auth.priceFeedStatus} />
          <DataMetric label="Last Price Update" value={fmtTime(betfairConnection?.lastActualPriceUpdateAt)} />
          <DataMetric label="Price Age" value={auth.priceAgeSeconds != null ? `${auth.priceAgeSeconds}s` : '—'} />
          <DataMetric label="Catalogue Refresh" value={fmtAge(betfairConnection?.lastCatalogueRefreshAt)} />
          <DataMetric label="Stream Update" value={fmtAge(betfairConnection?.lastStreamUpdateAt)} />
        </div>
      </Panel>

      <Panel title="Markets" subtitle={`${markets.length} loaded`}>
        <div className="max-h-96 overflow-y-auto">
          {markets.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="bg-muted/30 sticky top-0">
                <tr className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">
                  <th className="px-3 py-2 text-left">Market</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Runners</th>
                  <th className="px-3 py-2 text-right">Matched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {markets.slice(0, 50).map(m => (
                  <tr key={m.id || m.betfairMarketId} className="hover:bg-hover/50">
                    <td className="px-3 py-2 text-foreground max-w-[200px] truncate">{m.eventName || m.marketName || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.marketTypeCode || m.marketType || '—'}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{m.status || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.runnerCount || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.totalMatched ? `$${m.totalMatched.toLocaleString('en-AU', { maximumFractionDigits: 0 })}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No markets loaded.</div>
          )}
        </div>
        {markets.length > 50 && <div className="p-2 text-center text-[10px] text-muted-foreground border-t border-border-subtle">Showing first 50 of {markets.length}</div>}
      </Panel>
    </div>
  );
}