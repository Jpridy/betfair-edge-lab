import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { SideBadge } from '@/components/ui/Trading';
import { fmtMoney, fmtOdds, fmtPct, fmtProb, plClass } from '@/lib/format';
import { CheckCircle2, Ban, ChevronDown, ChevronUp } from 'lucide-react';

function Detail({ label, value, mono, tone }) {
  return (
    <div>
      <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${mono ? 'font-mono tabular-nums' : ''} ${tone || 'text-foreground'}`}>{value}</div>
    </div>
  );
}

export default function BestOpportunityCard() {
  const { exchangeOpportunities, botCycles } = useApp();
  const [showChecks, setShowChecks] = useState(false);

  const cycle = botCycles[0]?.scanSummary || {};
  const combined = [...(exchangeOpportunities || []), ...(cycle.topOpportunities || []), ...(cycle.topRejected || [])];
  const unique = [...new Map(combined.map((o, i) => [o.opportunityId || `${o.marketId}-${o.selectionId}-${o.side}-${i}`, o])).values()];
  const best = unique.sort((a, b) => (b.ev || 0) - (a.ev || 0))[0];

  if (!best) {
    return (
      <Panel title="Best Opportunity" subtitle="Top candidate from the latest scan">
        <div className="p-8 text-center text-sm text-muted-foreground">
          No opportunities found. Run a scan to evaluate candidates.
        </div>
      </Panel>
    );
  }

  const approved = best.decision === 'BET' || best.passed;
  const blocker = best.failedGate || best.blocker || best.blockers?.[0];

  return (
    <Panel
      title="Best Opportunity"
      subtitle="Top candidate from the latest scan"
      action={
        <div className={`rounded-md border px-2 py-0.5 text-[10px] font-body font-semibold tracking-label ${approved ? 'bg-success/10 text-success border-success/25' : 'bg-warning/10 text-warning border-warning/25'}`}>
          {approved ? <><CheckCircle2 className="inline h-3 w-3 mr-1" />Paper bet approved</> : <><Ban className="inline h-3 w-3 mr-1" />Rejected</>}
        </div>
      }
    >
      <div className="p-4 space-y-3">
        {!approved && blocker && (
          <div className="rounded-lg p-3 text-sm font-body border bg-warning/8 text-warning border-warning/20">
            Rejected: {blocker.replace(/_/g, ' ').toLowerCase()}
          </div>
        )}

        <div className="flex items-center gap-3">
          <SideBadge side={best.side || 'BACK'} />
          <div className="min-w-0 flex-1">
            <div className="text-base font-heading font-semibold text-foreground truncate">{best.runnerName || 'Unknown'}</div>
            <div className="text-xs text-muted-foreground truncate">{best.marketName || best.eventName || '—'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Detail label="Odds" value={fmtOdds(best.odds)} mono />
          <Detail label="Model Prob" value={fmtProb(best.modelProbability || best.estimatedProbability)} mono />
          <Detail label="Breakeven Prob" value={fmtProb(best.breakevenProbability || best.impliedProbability)} mono />
          <Detail label="Edge" value={fmtPct((best.edge || 0) * 100)} mono />
          <Detail label="EV" value={fmtMoney(best.ev)} mono tone={plClass(best.ev)} />
          <Detail label="ROI" value={fmtPct((best.roi || best.expectedROI || 0) * 100)} mono tone={plClass(best.roi || best.expectedROI)} />
          <Detail label="Confidence" value={fmtPct(best.confidence)} mono />
          <Detail label="Stake" value={fmtMoney(best.stake)} mono />
          <Detail label="Liability" value={fmtMoney(best.liability)} mono />
          <Detail label="Max Profit" value={fmtMoney(best.maxProfit)} mono tone="text-success" />
          <Detail label="Max Loss" value={fmtMoney(best.maxLoss)} mono tone="text-danger" />
          <Detail label="Decision Source" value={best.decisionSource || '—'} />
        </div>

        {showChecks && best.blockers && best.blockers.length > 0 && (
          <div className="rounded-lg p-3 bg-muted/30 border border-border-subtle space-y-1">
            <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label mb-1">All checks</div>
            {best.blockers.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Ban className="h-3 w-3 text-danger shrink-0" />
                <span className="text-foreground">{b.replace(/_/g, ' ').toLowerCase()}</span>
              </div>
            ))}
          </div>
        )}

        <Button size="sm" variant="outline" onClick={() => setShowChecks(!showChecks)}>
          {showChecks ? <><ChevronUp className="h-3.5 w-3.5" /> Hide all checks</> : <><ChevronDown className="h-3.5 w-3.5" /> Show all checks</>}
        </Button>
      </div>
    </Panel>
  );
}