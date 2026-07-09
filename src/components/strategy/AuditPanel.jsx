import React from 'react';
import { Panel } from '@/components/ui/Trading';
import { MetricWarningBadge } from './StrategyStatusBadge';
import { reconcileMetrics } from '@/lib/strategyValidation';

function MetricRow({ label, value, isPL, isPercent }) {
  const formatValue = () => {
    if (value === null || value === undefined) return '—';
    if (isPL) {
      const positive = value > 0;
      const zero = value === 0;
      const color = zero ? 'text-muted-foreground' : positive ? 'text-success' : 'text-danger';
      return <span className={`font-mono font-semibold ${color}`}>{zero ? '$0.00' : `${positive ? '+' : '-'}$${Math.abs(value).toFixed(2)}`}</span>;
    }
    if (isPercent) return <span className="font-mono font-semibold">{value.toFixed(2)}%</span>;
    return <span className="font-mono font-semibold">{value}</span>;
  };
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {formatValue()}
    </div>
  );
}

export default function AuditPanel({ audit }) {
  if (!audit) {
    return (
      <Panel title="Strategy Audit">
        <div className="p-8 text-center text-muted-foreground text-sm">No audit data available.</div>
      </Panel>
    );
  }

  const recon = reconcileMetrics(audit);

  return (
    <Panel title="Strategy Audit Panel" action={!recon.valid && <MetricWarningBadge />}>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Volume</div>
          <MetricRow label="Total Signals" value={audit.totalSignals} />
          <MetricRow label="Total Paper Orders" value={audit.totalPaperOrders} />
          <MetricRow label="Matched Orders" value={audit.matchedOrders} />
          <MetricRow label="Unmatched Orders" value={audit.unmatchedOrders} />
          <MetricRow label="Wins" value={audit.wins} />
          <MetricRow label="Losses" value={audit.losses} />
          <MetricRow label="Strike Rate" value={audit.strikeRate} isPercent />
        </div>
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Financials</div>
          <MetricRow label="Total Stake" value={`$${audit.totalStake?.toFixed(2)}`} />
          <MetricRow label="Total Liability" value={`$${audit.totalLiability?.toFixed(2)}`} />
          <MetricRow label="Gross Profit" value={audit.grossProfit} isPL />
          <MetricRow label="Commission Paid" value={`$${audit.commissionPaid?.toFixed(2)}`} />
          <MetricRow label="Net Profit" value={audit.netProfit} isPL />
          <MetricRow label="ROI (stake-based)" value={audit.roi} isPercent />
          <MetricRow label="Liability ROI" value={audit.liabilityRoi} isPercent />
        </div>
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Risk & Quality</div>
          <MetricRow label="Profit Factor" value={audit.profitFactor?.toFixed(2)} />
          <MetricRow label="Max Drawdown" value={audit.maxDrawdown} isPL />
          <MetricRow label="Longest Losing Streak" value={audit.longestLosingStreak} />
          <MetricRow label="Average Odds" value={audit.averageOdds?.toFixed(2)} />
          <MetricRow label="Average Stake" value={`$${audit.averageStake?.toFixed(2)}`} />
          <MetricRow label="Average Edge" value={audit.averageEdge} isPercent />
          <MetricRow label="Average Matched Price" value={audit.averageMatchedPrice?.toFixed(2)} />
          <MetricRow label="Closing Price" value={audit.closingPrice?.toFixed(2)} />
          <MetricRow label="Closing Line Value" value={audit.closingLineValue} isPercent />
          <MetricRow label="Slippage" value={audit.slippage} isPercent />
          <MetricRow label="Avg Time Before Start" value={`${audit.averageTimeBeforeStart}s`} />
        </div>
      </div>

      {!recon.valid && (
        <div className="mx-4 mb-4 p-3 rounded-lg border border-danger/30 bg-danger/5">
          <div className="text-xs font-bold text-danger mb-2">⚠ Metric Reconciliation Errors</div>
          <ul className="space-y-1">
            {recon.errors.map((err, i) => (
              <li key={i} className="text-xs text-danger/80">• {err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-4 pb-4">
        <div className="text-[10px] text-muted-foreground">
          ROI = Net Profit / Total Stake × 100 &nbsp;|&nbsp; Liability ROI = Net Profit / Total Liability × 100
        </div>
      </div>
    </Panel>
  );
}