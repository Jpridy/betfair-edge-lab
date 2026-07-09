import React from 'react';
import { Panel } from '@/components/ui/Trading';
import { Radar, Users, Filter, TrendingUp, CheckCircle2, FileText } from 'lucide-react';

export default function ScanSummaryPanel({ scanSummary }) {
  if (!scanSummary) return null;

  const steps = [
    { label: 'Markets Scanned', value: scanSummary.marketsScanned, icon: Radar, color: 'text-info' },
    { label: 'Runners Assessed', value: scanSummary.runnersAssessed, icon: Users, color: 'text-info' },
    { label: 'Passed Liquidity', value: scanSummary.candidatesPassedLiquidity, icon: Filter, color: 'text-warning' },
    { label: 'Passed Odds', value: scanSummary.candidatesPassedOddsRange, icon: Filter, color: 'text-warning' },
    { label: 'Passed Edge', value: scanSummary.candidatesPassedEdge, icon: TrendingUp, color: 'text-primary' },
    { label: 'Passed ROI', value: scanSummary.candidatesPassedROI, icon: TrendingUp, color: 'text-primary' },
    { label: 'Passed Confidence', value: scanSummary.candidatesPassedConfidence, icon: CheckCircle2, color: 'text-success' },
    { label: 'Paper Bets', value: scanSummary.paperBetsCreated, icon: FileText, color: 'text-success' },
  ];

  return (
    <Panel title="Scan Summary">
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {steps.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-muted/30 border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
                  <Icon className={`h-3 w-3 ${s.color}`} />
                </div>
                <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
              </div>
            );
          })}
        </div>

        {scanSummary.noBetReason && scanSummary.paperBetsCreated === 0 && (
          <div className="mt-3 text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg p-2">
            {scanSummary.noBetReason}
          </div>
        )}

        {scanSummary.thresholds && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span className="font-bold uppercase tracking-wider">Mode:</span>
            <span className="text-foreground font-medium">{scanSummary.thresholds.label}</span>
            <span>·</span>
            <span>Edge ≥ {scanSummary.thresholds.minEdge}%</span>
            <span>·</span>
            <span>ROI ≥ {scanSummary.thresholds.minExpectedROI}%</span>
            <span>·</span>
            <span>Conf ≥ {scanSummary.thresholds.minConfidence}%</span>
            <span>·</span>
            <span>Liq ≥ ${scanSummary.thresholds.minLiquidity}</span>
          </div>
        )}
      </div>
    </Panel>
  );
}