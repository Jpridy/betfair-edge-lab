import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge, PLValue } from '@/components/ui/Trading';
import { cn } from '@/lib/utils';

export default function SettlementPanel() {
  const { paperOrders } = useApp();

  const awaiting = paperOrders.filter(o => o.status === 'awaiting_result');
  const settled = paperOrders.filter(o => o.status === 'settled');
  const unknown = paperOrders.filter(o => o.status === 'awaiting_result' && o.resultConfidence === 'unknown');
  const voided = paperOrders.filter(o => o.status === 'voided' || o.voided);
  const pending = paperOrders.filter(o => ['matched', 'partially_matched'].includes(o.status));

  let settlementStatus = 'not_applicable';
  let settlementLabel = 'No orders to settle';
  if (pending.length > 0) {
    settlementStatus = 'pending';
    settlementLabel = `${pending.length} order(s) awaiting market close`;
  } else if (awaiting.length > 0) {
    settlementStatus = 'awaiting_result';
    settlementLabel = `${awaiting.length} order(s) awaiting result data`;
  } else if (settled.length > 0) {
    settlementStatus = 'settled';
    settlementLabel = `${settled.length} order(s) settled`;
  }

  const recentSettled = settled.slice(0, 5);
  const latestPL = settled[0]?.netProfit;

  return (
    <Panel title="Settlement Status" subtitle="Automatic settlement via Betfair stream results">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border-subtle">
        <Metric label="Pending Match" value={pending.length} tone="warning" />
        <Metric label="Awaiting Result" value={awaiting.length} tone="warning" />
        <Metric label="Settled" value={settled.length} tone="success" />
        <Metric label="Result Unknown" value={unknown.length} tone="warning" />
        <Metric label="Voided" value={voided.length} tone="danger" />
      </div>

      <div className={cn(
        'px-4 py-2.5 border-b border-border-subtle flex items-center justify-between',
        settlementStatus === 'not_applicable' ? 'bg-muted/20' : 'bg-card'
      )}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">Status:</span>
          <StatusBadge status={
            settlementStatus === 'settled' ? 'ok' :
            settlementStatus === 'pending' || settlementStatus === 'awaiting_result' ? 'warning' :
            'neutral'
          }>
            {settlementStatus.toUpperCase().replace(/_/g, ' ')}
          </StatusBadge>
        </div>
        <span className="text-[11px] text-muted-foreground font-body">{settlementLabel}</span>
      </div>

      {latestPL != null && (
        <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-body">Latest Settlement P/L:</span>
          <PLValue value={latestPL} />
        </div>
      )}

      {recentSettled.length > 0 ? (
        <div className="divide-y divide-border-subtle">
          {recentSettled.map(o => (
            <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <StatusBadge status={o.result === 'won' ? 'ok' : o.result === 'lost' ? 'danger' : 'neutral'}>
                {o.result?.toUpperCase() || '—'}
              </StatusBadge>
              <span className="font-body font-medium text-foreground flex-1 truncate">{o.runnerName}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{o.settled_date ? new Date(o.settled_date).toLocaleDateString('en-AU') : '—'}</span>
              <PLValue value={o.netProfit || 0} />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-5 text-center text-xs text-muted-foreground font-body">
          No settled orders yet. Settlement happens automatically when markets close via the Betfair stream.
        </div>
      )}

      <div className="px-4 py-2.5 bg-primary/5 border-t border-primary/15 text-[10px] text-muted-foreground font-body leading-relaxed">
        Settlement uses real Betfair stream results only. No random or simulated settlement. If no winner data is available, orders are marked "awaiting_result" — never guessed.
      </div>
    </Panel>
  );
}

function Metric({ label, value, tone }) {
  const tones = { success: 'text-success', warning: 'text-warning', danger: 'text-danger', default: 'text-foreground' };
  return (
    <div className="bg-card p-2.5 text-center">
      <div className="text-[9px] font-body font-medium text-muted-foreground uppercase tracking-label">{label}</div>
      <div className={cn('text-lg font-heading font-semibold tabular-nums mt-0.5', tones[tone || 'default'])}>{value}</div>
    </div>
  );
}