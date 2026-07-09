import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge, SideBadge, PLValue } from '@/components/ui/Trading';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle } from 'lucide-react';

export default function RiskOrdersPanel() {
  const { bankrollStats, settings, paperOrders, rejectedOrders, riskStatus } = useApp();

  const openOrders = paperOrders.filter(o => ['matched', 'partially_matched', 'pending', 'executable'].includes(o.status));
  const settledOrders = paperOrders.filter(o => o.status === 'settled');
  const latestOrder = paperOrders[0];
  const latestRejection = rejectedOrders[0];

  const openExposure = (bankrollStats.openPaperExposure || 0) + (bankrollStats.openLiveExposure || 0);
  const available = bankrollStats.available || 0;
  const layOrders = openOrders.filter(o => o.side === 'LAY');
  const totalLayLiability = layOrders.reduce((s, o) => s + (o.liability || 0), 0);

  return (
    <div className="space-y-5">
      <Panel title="Risk & Exposure" subtitle="Bankroll, exposure, and loss limits">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border-subtle">
          <Metric label="Bankroll" value={`$${(bankrollStats.bankroll || 0).toFixed(2)}`} />
          <Metric label="Available" value={`$${available.toFixed(2)}`} tone={available < 0 ? 'danger' : 'default'} />
          <Metric label="Open Exposure" value={`$${openExposure.toFixed(2)}`} tone={openExposure > 0 ? 'warning' : 'default'} />
          <Metric label="Today P/L" value={<PLValue value={bankrollStats.todayPL || 0} />} />
          <Metric label="Total P/L" value={<PLValue value={bankrollStats.totalPL || 0} />} />
          <Metric label="Daily Loss Used" value={`${(riskStatus?.dailyLossLimit?.value || 0).toFixed(0)}%`} tone={riskStatus?.dailyLossLimit?.status === 'danger' ? 'danger' : 'default'} />
          <Metric label="Weekly Loss Used" value={`${(riskStatus?.weeklyLossLimit?.value || 0).toFixed(0)}%`} tone={riskStatus?.weeklyLossLimit?.status === 'danger' ? 'danger' : 'default'} />
          <Metric label="Max Drawdown" value={`$${(bankrollStats.maxDrawdown || 0).toFixed(2)}`} tone="warning" />
        </div>

        {layOrders.length > 0 && (
          <div className="m-4 bg-danger/8 border border-danger/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-danger font-body font-semibold text-xs">
              <AlertTriangle className="h-4 w-4" />
              LAY LIABILITY ACTIVE
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
              <div><span className="text-muted-foreground font-body">LAY Orders:</span> <span className="font-mono tabular-nums font-semibold text-foreground">{layOrders.length}</span></div>
              <div><span className="text-muted-foreground font-body">Total Liability:</span> <span className="font-mono tabular-nums font-semibold text-danger">${totalLayLiability.toFixed(2)}</span></div>
              <div><span className="text-muted-foreground font-body">Max Profit:</span> <span className="font-mono tabular-nums font-semibold text-success">${layOrders.reduce((s, o) => s + (o.matchedStake || o.requestedStake || 0), 0).toFixed(2)}</span></div>
              <div><span className="text-muted-foreground font-body">Max Loss:</span> <span className="font-mono tabular-nums font-semibold text-danger">${totalLayLiability.toFixed(2)}</span></div>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel title="Latest Paper Order">
          {latestOrder ? (
            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <SideBadge side={latestOrder.side} />
                <span className="font-body font-semibold text-foreground">{latestOrder.runnerName}</span>
                <StatusBadge status={latestOrder.status === 'matched' ? 'ok' : latestOrder.status === 'settled' ? 'ok' : 'warning'}>
                  {latestOrder.status}
                </StatusBadge>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <KV label="Market" value={latestOrder.marketName || latestOrder.venue || '—'} />
                <KV label="Odds" value={latestOrder.requestedOdds?.toFixed(2) || latestOrder.matchedOdds?.toFixed(2) || '—'} mono />
                <KV label="Stake" value={`$${(latestOrder.requestedStake || 0).toFixed(2)}`} mono />
                <KV label="Liability" value={`$${(latestOrder.liability || 0).toFixed(2)}`} mono />
                {latestOrder.result && <KV label="Result" value={latestOrder.result} />}
                {latestOrder.netProfit != null && <KV label="Net P/L" value={<PLValue value={latestOrder.netProfit} />} />}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground font-body">No paper orders yet.</div>
          )}
        </Panel>

        <Panel title="Latest Rejection">
          {latestRejection ? (
            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <StatusBadge status="danger">REJECTED</StatusBadge>
                <span className="font-body font-semibold text-foreground">{latestRejection.runner || latestRejection.selectionId || '—'}</span>
              </div>
              <div className="bg-danger/8 text-danger border border-danger/20 rounded-md p-2.5 text-xs font-body">
                {latestRejection.rejection_reason || latestRejection.failed_validation_field || 'Unknown reason'}
              </div>
              {latestRejection.field && <KV label="Failed Field" value={latestRejection.field} />}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground font-body">No rejected orders.</div>
          )}
        </Panel>
      </div>

      {openOrders.length > 0 && (
        <Panel title={`Open Orders (${openOrders.length})`}>
          <div className="divide-y divide-border-subtle">
            {openOrders.slice(0, 5).map(o => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <SideBadge side={o.side} />
                <span className="font-body font-medium text-foreground flex-1 truncate">{o.runnerName}</span>
                <span className="font-mono tabular-nums text-muted-foreground">@ {o.requestedOdds?.toFixed(2) || '—'}</span>
                <span className="font-mono tabular-nums text-muted-foreground">${(o.requestedStake || 0).toFixed(0)}</span>
                {o.side === 'LAY' && <span className="font-mono tabular-nums text-danger">Liab: ${(o.liability || 0).toFixed(0)}</span>}
                <StatusBadge status={o.status === 'matched' ? 'ok' : 'warning'}>{o.status}</StatusBadge>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="flex justify-end">
        <Link to="/orders">
          <Button variant="outline" size="sm" className="gap-1.5">
            View All Orders <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }) {
  const tones = { danger: 'text-danger', warning: 'text-warning', default: 'text-foreground' };
  return (
    <div className="bg-card p-2.5 text-center">
      <div className="text-[9px] font-body font-medium text-muted-foreground uppercase tracking-label">{label}</div>
      <div className={cn('text-sm font-mono tabular-nums font-semibold mt-0.5', tones[tone || 'default'])}>{value}</div>
    </div>
  );
}

function KV({ label, value, mono }) {
  return (
    <div>
      <div className="text-[9px] font-body font-medium text-muted-foreground uppercase tracking-label mb-0.5">{label}</div>
      <div className={cn('text-xs font-semibold', mono && 'font-mono tabular-nums', 'text-foreground')}>{value}</div>
    </div>
  );
}