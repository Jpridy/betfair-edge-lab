import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Target, CheckCircle2, XCircle } from 'lucide-react';
import { fmtPct } from '@/lib/candidateScoring';

export default function BestCandidatePanel({ bestCandidate }) {
  if (!bestCandidate) return null;

  const passed = bestCandidate.passed;

  return (
    <Panel title="Best Candidate" action={
      <StatusBadge status={passed ? 'ok' : 'warning'}>
        {passed ? 'PASS' : 'CLOSEST'}
      </StatusBadge>
    }>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          {passed
            ? <CheckCircle2 className="h-5 w-5 text-chart-1 shrink-0" />
            : <Target className="h-5 w-5 text-chart-4 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground">{bestCandidate.runnerName}</div>
            <div className="text-[10px] text-muted-foreground">{bestCandidate.marketName}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Score</div>
            <div className="text-lg font-bold font-mono text-foreground">{bestCandidate.overallScore}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Odds" value={bestCandidate.odds?.toFixed(2)} />
          <Stat label="Edge" value={fmtPct(bestCandidate.edge)} positive={bestCandidate.edge > 0} />
          <Stat label="Exp. ROI" value={fmtPct(bestCandidate.expectedROI)} positive={bestCandidate.expectedROI > 0} />
          <Stat label="Confidence" value={fmtPct(bestCandidate.confidence)} />
          <Stat label="Liquidity" value={`$${bestCandidate.liquidity?.toFixed(0)}`} />
          <Stat label="Spread" value={`${bestCandidate.spread}t`} />
        </div>

        {/* Market movement */}
        {bestCandidate.marketMovement && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Movement:</span>
            <StatusBadge status={
              bestCandidate.marketMovement.label === 'shortening' ? 'ok' :
              bestCandidate.marketMovement.label === 'drifting' ? 'danger' : 'neutral'
            }>
              {bestCandidate.marketMovement.label}
            </StatusBadge>
            {bestCandidate.dataSource === 'MARKET_ONLY' && (
              <span className="text-[10px] text-chart-3">Market-only signal</span>
            )}
          </div>
        )}

        {/* Failed thresholds */}
        {!passed && bestCandidate.failedThresholds && bestCandidate.failedThresholds.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Failed Thresholds</div>
            {bestCandidate.failedThresholds.map((ft, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] text-chart-5">
                <XCircle className="h-3 w-3 shrink-0 mt-0.5" />
                {ft.reason}
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function Stat({ label, value, positive }) {
  return (
    <div className="bg-muted/30 rounded p-2 text-center">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold font-mono mt-0.5 ${
        positive === true ? 'text-chart-1' : positive === false ? 'text-chart-5' : 'text-foreground'
      }`}>{value}</div>
    </div>
  );
}