import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { getMarketDataSourceLabel } from '@/lib/betfairMarketMerge';
import { Activity, Database, TrendingUp, DollarSign } from 'lucide-react';

/**
 * Shows the CURRENT live market state from AppContext — not the last bot cycle.
 * This is separate from LatestDecision / DecisionTimeline which show what the
 * bot saw during its last scan.
 */
export default function CurrentMarketFeed() {
  const { markets, runners, apiConnected, betfairConnection, exchangeOpportunities } = useApp();

  const streamStatus = betfairConnection?.streamConnectionStatus || 'disconnected';
  const sourceLabel = getMarketDataSourceLabel(markets, streamStatus);

  const SOURCE_BADGE = {
    stream_live: { status: 'ok', label: 'Stream' },
    rest_catalogue: { status: 'info', label: 'REST catalogue' },
    merged: { status: 'ok', label: 'Merged' },
    cached_stale: { status: 'warning', label: 'Cached' },
    none: { status: 'danger', label: 'None' },
  };
  const srcInfo = SOURCE_BADGE[sourceLabel] || SOURCE_BADGE.none;

  const pricedRunners = runners.filter(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0)).length;
  const openMarkets = markets.filter(m => m.status === 'OPEN').length;
  const openPreRace = markets.filter(m => m.status === 'OPEN' && !m.inPlay).length;
  const marketsWithPrices = new Set();
  for (const r of runners) {
    if (r.bestBackPrice > 0 || r.bestLayPrice > 0) marketsWithPrices.add(String(r.marketId || ''));
  }
  const withPriceData = marketsWithPrices.size;

  return (
    <Panel
      title="Current Market Feed"
      subtitle="Live app state — updated immediately on refresh"
      action={
        <div className="flex items-center gap-2">
          <StatusBadge status={srcInfo.status}>{srcInfo.label}</StatusBadge>
          {apiConnected
            ? <StatusBadge status="ok">Connected</StatusBadge>
            : <StatusBadge status="warning">Not connected</StatusBadge>}
        </div>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border">
        <Metric icon={Database} label="Markets" value={markets.length} color="text-foreground" />
        <Metric icon={Activity} label="Runners" value={runners.length} color="text-info" />
        <Metric icon={TrendingUp} label="Priced Runners" value={pricedRunners} color={pricedRunners > 0 ? 'text-success' : 'text-danger'} />
        <Metric icon={Activity} label="Open Pre-Race" value={openPreRace} color={openPreRace > 0 ? 'text-success' : 'text-muted-foreground'} />
        <Metric icon={DollarSign} label="With Prices" value={withPriceData} color={withPriceData > 0 ? 'text-success' : 'text-danger'} />
      </div>

      {markets.length > 0 && exchangeOpportunities?.length > 0 && (
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
          <span className="text-success font-semibold">{exchangeOpportunities.length}</span> opportunities from last scan
          {' · '}
          <span className="text-info font-semibold">{exchangeOpportunities.filter(o => o.decision === 'BET').length}</span> positive-EV
        </div>
      )}

      {markets.length === 0 && (
        <div className="px-4 py-3 border-t border-border text-xs text-warning">
          No markets in memory. Click "Refresh Markets" to load the Betfair catalogue.
        </div>
      )}
    </Panel>
  );
}

function Metric({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card p-3 text-center">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}