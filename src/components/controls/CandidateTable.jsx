import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { SideBadge } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';
import { fmtOdds, fmtPct, fmtMoney, plClass } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ArrowUpDown, CheckCircle2, Ban } from 'lucide-react';

const FILTERS = ['All', 'BET', 'NO_BET', 'BACK', 'LAY'];

export default function CandidateTable() {
  const { exchangeOpportunities, botCycles } = useApp();
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState('ev');
  const [sortDir, setSortDir] = useState('desc');

  const cycle = botCycles[0]?.scanSummary || {};
  const combined = [...(exchangeOpportunities || []), ...(cycle.topOpportunities || []), ...(cycle.topRejected || [])];
  const unique = useMemo(() => [...new Map(combined.map((o, i) => [o.opportunityId || `${o.marketId}-${o.selectionId}-${o.side}-${i}`, o])).values()], [exchangeOpportunities, botCycles]);

  const filtered = useMemo(() => {
    let result = unique;
    if (filter === 'BET') result = result.filter(o => o.decision === 'BET' || o.passed);
    else if (filter === 'NO_BET') result = result.filter(o => o.decision !== 'BET' && !o.passed);
    else if (filter === 'BACK') result = result.filter(o => o.side === 'BACK');
    else if (filter === 'LAY') result = result.filter(o => o.side === 'LAY');

    return result.sort((a, b) => {
      const aVal = Number(a[sortKey] || 0);
      const bVal = Number(b[sortKey] || 0);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [unique, filter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortHeader = ({ label, keyName }) => (
    <th className="px-3 py-2 text-right cursor-pointer hover:text-foreground" onClick={() => toggleSort(keyName)}>
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 opacity-50" /></span>
    </th>
  );

  return (
    <Panel title="All Candidates" subtitle={`${filtered.length} candidates from the latest scan`}>
      <div className="p-3 border-b border-border-subtle">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-body font-medium transition-colors',
                filter === f ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">
                <th className="px-3 py-2 text-left">Rank</th>
                <th className="px-3 py-2 text-left">Runner</th>
                <th className="px-3 py-2 text-center">Side</th>
                <SortHeader label="Odds" keyName="odds" />
                <SortHeader label="Edge" keyName="edge" />
                <SortHeader label="EV" keyName="ev" />
                <SortHeader label="ROI" keyName="roi" />
                <SortHeader label="Conf" keyName="confidence" />
                <th className="px-3 py-2 text-center">Decision</th>
                <th className="px-3 py-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtered.map((o, i) => {
                const isBet = o.decision === 'BET' || o.passed;
                const reason = o.failedGate || o.blocker || o.blockers?.[0] || '—';
                return (
                  <tr key={o.opportunityId || i} className="hover:bg-hover/50">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-foreground max-w-[150px] truncate">{o.runnerName || '—'}</td>
                    <td className="px-3 py-2 text-center"><SideBadge side={o.side || 'BACK'} /></td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtOdds(o.odds)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtPct((o.edge || 0) * 100)}</td>
                    <td className={cn('px-3 py-2 text-right font-mono tabular-nums', plClass(o.ev))}>{fmtMoney(o.ev)}</td>
                    <td className={cn('px-3 py-2 text-right font-mono tabular-nums', plClass(o.roi || o.expectedROI))}>{fmtPct((o.roi || o.expectedROI || 0) * 100)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtPct(o.confidence)}</td>
                    <td className="px-3 py-2 text-center">
                      {isBet
                        ? <span className="inline-flex items-center gap-1 text-success text-[10px] font-semibold"><CheckCircle2 className="h-3 w-3" /> BET</span>
                        : <span className="inline-flex items-center gap-1 text-warning text-[10px] font-semibold"><Ban className="h-3 w-3" /> NO BET</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate text-[10px]">{reason.replace(/_/g, ' ').toLowerCase()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground">No candidates match the current filter.</div>
      )}
    </Panel>
  );
}