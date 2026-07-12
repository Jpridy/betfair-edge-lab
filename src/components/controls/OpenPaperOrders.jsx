import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { SideBadge, StatusBadge } from '@/components/ui/Trading';
import { fmtOdds, fmtMoney, fmtTime } from '@/lib/format';

export default function OpenPaperOrders() {
  const { paperOrders } = useApp();
  const openOrders = paperOrders.filter(o => ['matched', 'partially_matched', 'pending', 'executable', 'unmatched'].includes(o.status));

  return (
    <Panel title={`Open Paper Orders (${openOrders.length})`} subtitle="Unresolved paper bets only">
      {openOrders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">
                <th className="px-3 py-2 text-left">Race</th>
                <th className="px-3 py-2 text-left">Runner</th>
                <th className="px-3 py-2 text-center">Side</th>
                <th className="px-3 py-2 text-right">Odds</th>
                <th className="px-3 py-2 text-right">Matched Stake</th>
                <th className="px-3 py-2 text-right">Liability</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {openOrders.map(o => (
                <tr key={o.id} className="hover:bg-hover/50">
                  <td className="px-3 py-2 text-foreground max-w-[120px] truncate">{o.marketName || o.venue || '—'}</td>
                  <td className="px-3 py-2 font-medium text-foreground max-w-[120px] truncate">{o.runnerName || '—'}</td>
                  <td className="px-3 py-2 text-center"><SideBadge side={o.side} /></td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtOdds(o.matchedOdds || o.requestedOdds)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtMoney(o.matchedStake || o.matched_size || 0)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-danger">{fmtMoney(o.liability || 0)}</td>
                  <td className="px-3 py-2 text-center"><StatusBadge status={o.status === 'matched' || o.status === 'partially_matched' ? 'ok' : 'warning'}>{o.status}</StatusBadge></td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtTime(o.placed_date || o.created_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground">No open paper orders.</div>
      )}
    </Panel>
  );
}