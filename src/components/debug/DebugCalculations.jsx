import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { fmtMoney, fmtOdds, fmtPct, fmtProb, plClass } from '@/lib/format';

function CalcRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono tabular-nums font-semibold ${tone || 'text-foreground'}`}>{value}</span>
    </div>
  );
}

export default function DebugCalculations() {
  const { botCycles, exchangeOpportunities } = useApp();
  const lastCycle = botCycles[0];
  const best = lastCycle?.bestCandidate || exchangeOpportunities?.[0];

  if (!best) {
    return (
      <Panel title="Calculations" subtitle="Canonical calculation snapshots">
        <div className="p-8 text-center text-sm text-muted-foreground">No calculation data available. Run a scan first.</div>
      </Panel>
    );
  }

  const invariantsPassed = best.mathematicalInvariantsPassed;

  return (
    <Panel title="Calculations" subtitle="Ranked vs final authority calculation">
      <div className="p-4 space-y-1">
        <CalcRow label="Runner" value={best.runnerName || '—'} />
        <CalcRow label="Side" value={best.side || '—'} />
        <CalcRow label="Ranked EV" value={fmtMoney(best.ev)} tone={plClass(best.ev)} />
        <CalcRow label="Final Authority EV" value={fmtMoney(best.ev)} tone={plClass(best.ev)} />
        <CalcRow label="Match Result" value={best.decision || '—'} />
        <CalcRow label="EV" value={fmtMoney(best.ev)} tone={plClass(best.ev)} />
        <CalcRow label="ROI" value={fmtPct((best.roi || best.expectedROI || 0) * 100)} tone={plClass(best.roi || best.expectedROI)} />
        <CalcRow label="Edge" value={fmtPct((best.edge || 0) * 100)} />
        <CalcRow label="Stake" value={fmtMoney(best.stake)} />
        <CalcRow label="Liability" value={fmtMoney(best.liability)} />
        <CalcRow label="Odds" value={fmtOdds(best.odds)} />
        <CalcRow label="Model Probability" value={fmtProb(best.modelProbability || best.estimatedProbability)} />
        <CalcRow label="Invariants Passed" value={invariantsPassed ? 'Yes' : 'No'} tone={invariantsPassed ? 'text-success' : 'text-danger'} />
        <CalcRow label="Errors" value={String(lastCycle?.errors || 0)} tone={lastCycle?.errors > 0 ? 'text-danger' : undefined} />
      </div>
    </Panel>
  );
}