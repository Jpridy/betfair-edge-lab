import React, { useMemo, useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { SideBadge } from '@/components/ui/Trading';
import { fmtMoney, fmtOdds, fmtPct, plClass } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ArrowUpDown, Ban, CheckCircle2, FlaskConical } from 'lucide-react';

const FILTERS = ['All', 'BET', 'NO_BET', 'BACK', 'LAY'];
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function candidateDecision(candidate) {
  if (candidate.decision === 'PROOF_OVERRIDE') return 'PROOF_OVERRIDE';
  if (candidate.decision === 'BET' && candidate.gatesPassed === true) return 'BET';
  return 'NO_BET';
}

function SortHeader({ label, keyName, onSort }) {
  return (
    <th className="cursor-pointer px-3 py-2 text-right hover:text-foreground" onClick={() => onSort(keyName)}>
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 opacity-50" /></span>
    </th>
  );
}

export default function CandidateTable() {
  const { exchangeOpportunities, botCycles } = useApp();
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState('ev');
  const [sortDir, setSortDir] = useState('desc');

  const latestCycle = botCycles[0]?.scanSummary || {};
  const unique = useMemo(() => {
    const combined = [
      ...(exchangeOpportunities || []),
      ...(latestCycle.topOpportunities || []),
      ...(latestCycle.topRejected || []),
    ];
    return [...new Map(combined.map((candidate, index) => [
      candidate.opportunityId || `${candidate.marketId}-${candidate.selectionId}-${candidate.side}-${index}`,
      candidate,
    ])).values()];
  }, [exchangeOpportunities, latestCycle.topOpportunities, latestCycle.topRejected]);

  const filtered = useMemo(() => {
    let result = [...unique];
    if (filter === 'BET') result = result.filter(candidate => candidateDecision(candidate) === 'BET');
    else if (filter === 'NO_BET') result = result.filter(candidate => candidateDecision(candidate) === 'NO_BET');
    else if (filter === 'BACK') result = result.filter(candidate => candidate.side === 'BACK');
    else if (filter === 'LAY') result = result.filter(candidate => candidate.side === 'LAY');

    return result.sort((left, right) => {
      const leftValue = numeric(left[sortKey] ?? (sortKey === 'edge' ? left.commissionAdjustedEdge : null));
      const rightValue = numeric(right[sortKey] ?? (sortKey === 'edge' ? right.commissionAdjustedEdge : null));
      return sortDir === 'desc' ? rightValue - leftValue : leftValue - rightValue;
    });
  }, [unique, filter, sortKey, sortDir]);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(current => current === 'desc' ? 'asc' : 'desc');
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <Panel title="All Candidates" subtitle={`${filtered.length} candidates from the latest scan`}>
      <div className="border-b border-border-subtle p-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-body font-medium transition-colors',
                filter === item ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr className="text-[10px] font-body font-medium uppercase tracking-label text-muted-foreground">
                <th className="px-3 py-2 text-left">Rank</th>
                <th className="px-3 py-2 text-left">Runner</th>
                <th className="px-3 py-2 text-center">Side</th>
                <SortHeader label="Odds" keyName="odds" onSort={toggleSort} />
                <SortHeader label="Edge" keyName="commissionAdjustedEdge" onSort={toggleSort} />
                <SortHeader label="EV" keyName="ev" onSort={toggleSort} />
                <SortHeader label="ROI" keyName="roi" onSort={toggleSort} />
                <SortHeader label="Conf" keyName="confidence" onSort={toggleSort} />
                <th className="px-3 py-2 text-center">Decision</th>
                <th className="px-3 py-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtered.map((candidate, index) => {
                const decision = candidateDecision(candidate);
                const reason = candidate.failedGate || candidate.blocker || candidate.blockers?.[0] || '—';
                const edge = candidate.commissionAdjustedEdge ?? candidate.edge;
                const roi = candidate.roi ?? candidate.expectedROI;
                return (
                  <tr key={candidate.opportunityId || `${candidate.marketId}-${candidate.selectionId}-${candidate.side}-${index}`} className="hover:bg-hover/50">
                    <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                    <td className="max-w-[150px] truncate px-3 py-2 font-medium text-foreground">{candidate.runnerName || '—'}</td>
                    <td className="px-3 py-2 text-center"><SideBadge side={candidate.side || 'BACK'} /></td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtOdds(candidate.odds)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{edge == null ? '—' : fmtPct(edge * 100)}</td>
                    <td className={cn('px-3 py-2 text-right font-mono tabular-nums', plClass(candidate.ev))}>{fmtMoney(candidate.ev)}</td>
                    <td className={cn('px-3 py-2 text-right font-mono tabular-nums', plClass(roi))}>{roi == null ? '—' : fmtPct(roi * 100)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{candidate.confidence == null ? '—' : fmtPct(candidate.confidence)}</td>
                    <td className="px-3 py-2 text-center">
                      {decision === 'BET' && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success"><CheckCircle2 className="h-3 w-3" />BET</span>}
                      {decision === 'PROOF_OVERRIDE' && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-info"><FlaskConical className="h-3 w-3" />PROOF</span>}
                      {decision === 'NO_BET' && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning"><Ban className="h-3 w-3" />NO BET</span>}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-[10px] text-muted-foreground">{String(reason).replace(/_/g, ' ').toLowerCase()}</td>
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
