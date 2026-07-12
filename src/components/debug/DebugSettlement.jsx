import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { fmtAge, fmtTime } from '@/lib/format';

function SettlementMetric({ label, value }) {
  return (
    <div className="rounded-md border border-border-subtle bg-muted/20 p-2.5">
      <div className="text-[10px] uppercase tracking-label text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-foreground">{value ?? '—'}</div>
    </div>
  );
}

export default function DebugSettlement() {
  const { paperOrders, settlementReport, settlementRunning, runSettlementCheckNow } = useApp();

  const due = paperOrders.filter(o => o.status === 'matched' || o.status === 'partially_matched').length;
  const awaitingResult = paperOrders.filter(o => o.status === 'awaiting_result').length;
  const settled = paperOrders.filter(o => o.status === 'settled').length;
  const failed = paperOrders.filter(o => o.settlementStatus === 'failed').length;
  const nextRetry = paperOrders.filter(o => o.nextSettlementRetryAt).sort((a, b) => new Date(a.nextSettlementRetryAt) - new Date(b.nextSettlementRetryAt))[0];

  return (
    <Panel title="Settlement" subtitle="Order settlement worker status">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SettlementMetric label="Due" value={String(due)} />
          <SettlementMetric label="Awaiting Result" value={String(awaitingResult)} />
          <SettlementMetric label="Settled" value={String(settled)} />
          <SettlementMetric label="Failed" value={String(failed)} />
          <SettlementMetric label="Next Retry" value={nextRetry ? fmtTime(nextRetry.nextSettlementRetryAt) : '—'} />
          <SettlementMetric label="Worker Lock" value={settlementRunning ? 'Locked' : 'Free'} />
          <SettlementMetric label="Last Run" value={settlementReport ? fmtAge(settlementReport.checkedAt) : '—'} />
          <SettlementMetric label="Last Errors" value={String(settlementReport?.errors || 0)} />
        </div>
      </div>
    </Panel>
  );
}