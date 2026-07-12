import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

function CycleMetric({ label, value }) {
  return (
    <div className="rounded-md border border-border-subtle bg-muted/20 p-2.5">
      <div className="text-[10px] uppercase tracking-label text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

export default function CycleDetails() {
  const { botCycles } = useApp();
  const [open, setOpen] = useState(false);
  const lastCycle = botCycles[0];

  if (!lastCycle) return null;

  const duration = lastCycle.startedAt && lastCycle.finishedAt
    ? `${((new Date(lastCycle.finishedAt).getTime() - new Date(lastCycle.startedAt).getTime()) / 1000).toFixed(1)}s`
    : '—';

  return (
    <Panel title="Cycle Details" subtitle={`Cycle #${lastCycle.cycleNumber}`}>
      <div className="p-3">
        <Button size="sm" variant="ghost" className="w-full" onClick={() => setOpen(!open)}>
          {open ? <><ChevronUp className="h-4 w-4" /> Hide Cycle Details</> : <><ChevronDown className="h-4 w-4" /> Show Cycle Details</>}
        </Button>
        {open && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <CycleMetric label="Cycle number" value={`#${lastCycle.cycleNumber}`} />
            <CycleMetric label="Duration" value={duration} />
            <CycleMetric label="Runners assessed" value={String(lastCycle.runnersAssessed || 0)} />
            <CycleMetric label="Opportunities" value={String(lastCycle.scanSummary?.totalOpportunities || 0)} />
            <CycleMetric label="Passed filters" value={String(lastCycle.marketsPassedFilters || 0)} />
            <CycleMetric label="Signals created" value={String(lastCycle.signalsCreated || 0)} />
            <CycleMetric label="Orders created" value={String(lastCycle.ordersCreated || 0)} />
            <CycleMetric label="Orders blocked" value={String(lastCycle.ordersBlocked || 0)} />
            <CycleMetric label="Final decision" value={lastCycle.cycleOutcome || '—'} />
            <CycleMetric label="Errors" value={String(lastCycle.errors || 0)} />
            <CycleMetric label="Markets scanned" value={String(lastCycle.marketsScanned || 0)} />
            <CycleMetric label="Status" value={lastCycle.status || '—'} />
          </div>
        )}
      </div>
    </Panel>
  );
}