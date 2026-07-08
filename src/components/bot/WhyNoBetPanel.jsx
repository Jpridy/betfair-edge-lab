import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpCircle, AlertTriangle, TrendingDown } from 'lucide-react';
import { fmtPct } from '@/lib/candidateScoring';

export default function WhyNoBetPanel({ diagnostics }) {
  if (!diagnostics || !diagnostics.noBetReason) return null;

  const { bestCandidate, assessedRunners, noBetReason, scanSummary } = diagnostics;
  const thresholds = scanSummary?.thresholds;

  return (
    <Panel title="Why no paper bet?">
      <div className="p-4 space-y-4">
        {/* Main reason banner */}
        <div className="flex items-start gap-3 bg-chart-4/10 border border-chart-4/30 rounded-lg p-3">
          <HelpCircle className="h-5 w-5 text-chart-4 shrink-0 mt-0.5" />
          <div className="text-xs text-foreground">{noBetReason}</div>
        </div>

        {/* Closest runner details */}
        {bestCandidate && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Closest Runner</div>
                <div className="text-sm font-bold text-foreground mt-0.5">{bestCandidate.runnerName}</div>
                <div className="text-[10px] text-muted-foreground">{bestCandidate.marketName}</div>
              </div>
              <StatusBadge status="warning">
                Score: {bestCandidate.overallScore}/100
              </StatusBadge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Odds" value={bestCandidate.odds?.toFixed(2) || '—'} />
              <Metric label="Edge" value={fmtPct(bestCandidate.edge)} required={thresholds ? fmtPct(thresholds.minEdge / 100) : null} />
              <Metric label="Exp. ROI" value={fmtPct(bestCandidate.expectedROI)} required={thresholds ? fmtPct(thresholds.minExpectedROI / 100) : null} />
              <Metric label="Confidence" value={fmtPct(bestCandidate.confidence)} required={thresholds ? fmtPct(thresholds.minConfidence / 100) : null} />
              <Metric label="Implied Prob" value={fmtPct(bestCandidate.impliedProbability)} />
              <Metric label="Est. Prob" value={fmtPct(bestCandidate.estimatedProbability)} />
              <Metric label="Liquidity" value={`$${bestCandidate.liquidity?.toFixed(2)}`} required={thresholds ? `$${thresholds.minLiquidity}` : null} />
              <Metric label="Spread" value={`${bestCandidate.spread} ticks`} required={thresholds ? `max ${thresholds.maxSpread}` : null} />
            </div>

            {bestCandidate.mainBlocker && (
              <div className="flex items-center gap-2 text-xs text-chart-5 bg-chart-5/10 rounded p-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">Main blocker:</span> {bestCandidate.mainBlocker}
              </div>
            )}

            {/* Data source label */}
            {bestCandidate.dataSource === 'MARKET_ONLY' && (
              <div className="text-[10px] text-chart-3 bg-chart-3/5 rounded p-1.5">
                Market-only paper signal — no external form data used.
              </div>
            )}
          </div>
        )}

        {/* Assessed runners table */}
        {assessedRunners && assessedRunners.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              All Assessed Runners ({assessedRunners.length})
            </div>
            <div className="max-h-64 overflow-y-auto rounded border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] h-7 px-2">Runner</TableHead>
                    <TableHead className="text-[10px] h-7 px-2 text-right">Odds</TableHead>
                    <TableHead className="text-[10px] h-7 px-2 text-right">Edge</TableHead>
                    <TableHead className="text-[10px] h-7 px-2 text-right">ROI</TableHead>
                    <TableHead className="text-[10px] h-7 px-2 text-right">Conf</TableHead>
                    <TableHead className="text-[10px] h-7 px-2">Status</TableHead>
                    <TableHead className="text-[10px] h-7 px-2">Failed Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessedRunners.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs px-2 py-1 font-medium truncate max-w-[120px]">{r.runnerName}</TableCell>
                      <TableCell className="text-xs px-2 py-1 text-right font-mono">{r.odds?.toFixed(2)}</TableCell>
                      <TableCell className={`text-xs px-2 py-1 text-right font-mono ${r.edge > 0 ? 'text-chart-1' : 'text-chart-5'}`}>{fmtPct(r.edge)}</TableCell>
                      <TableCell className={`text-xs px-2 py-1 text-right font-mono ${r.expectedROI > 0 ? 'text-chart-1' : 'text-chart-5'}`}>{fmtPct(r.expectedROI)}</TableCell>
                      <TableCell className="text-xs px-2 py-1 text-right font-mono">{fmtPct(r.confidence)}</TableCell>
                      <TableCell className="text-xs px-2 py-1">
                        <StatusBadge status={r.status === 'pass' ? 'ok' : 'danger'}>{r.status === 'pass' ? 'PASS' : 'FAIL'}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-[10px] px-2 py-1 text-muted-foreground truncate max-w-[150px]">{r.failedReason || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Scan funnel */}
        {scanSummary && scanSummary.runnersAssessed > 0 && (
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Scan Funnel</div>
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <FunnelStep label="Assessed" value={scanSummary.runnersAssessed} />
              <Arrow />
              <FunnelStep label="Liquidity" value={scanSummary.candidatesPassedLiquidity} />
              <Arrow />
              <FunnelStep label="Odds" value={scanSummary.candidatesPassedOddsRange} />
              <Arrow />
              <FunnelStep label="Edge" value={scanSummary.candidatesPassedEdge} />
              <Arrow />
              <FunnelStep label="ROI" value={scanSummary.candidatesPassedROI} />
              <Arrow />
              <FunnelStep label="Confidence" value={scanSummary.candidatesPassedConfidence} />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Metric({ label, value, required }) {
  const failed = required != null && value != null && value !== '—';
  return (
    <div className="bg-muted/30 rounded p-2">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold font-mono mt-0.5">{value}</div>
      {required && <div className="text-[9px] text-muted-foreground">req: {required}</div>}
    </div>
  );
}

function FunnelStep({ label, value }) {
  return (
    <div className="bg-card border border-border rounded px-2 py-1">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-bold font-mono text-foreground">{value}</span>
    </div>
  );
}

function Arrow() {
  return <TrendingDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />;
}