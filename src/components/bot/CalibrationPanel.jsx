import React, { useMemo } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Brain, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { computeCalibration } from '@/lib/calibration';
import { fmtPct } from '@/lib/candidateScoring';

export default function CalibrationPanel() {
  const { paperOrders } = useApp();

  const calibration = useMemo(() => computeCalibration(paperOrders), [paperOrders]);

  return (
    <Panel title="AI Calibration" action={
      <StatusBadge status={calibration.isCalibrated ? 'ok' : 'warning'}>
        {calibration.sampleSize} / 50 settled
      </StatusBadge>
    }>
      <div className="p-4 space-y-4">
        {/* Warning banner */}
        {calibration.warning && (
          <div className="flex items-start gap-2 text-xs bg-chart-4/10 border border-chart-4/30 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-chart-4 shrink-0 mt-0.5" />
            <span className="text-foreground">{calibration.warning}</span>
          </div>
        )}

        {calibration.isCalibrated && (
          <div className="flex items-center gap-2 text-xs bg-chart-1/10 border border-chart-1/30 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4 text-chart-1 shrink-0" />
            <span className="text-foreground">Calibration active — {calibration.sampleSize} settled paper bets analysed.</span>
          </div>
        )}

        {calibration.sampleSize > 0 && (
          <>
            {/* Overall calibration */}
            <div className="grid grid-cols-3 gap-3">
              <CalibStat label="Predicted Win Rate" value={fmtPct(calibration.predictedWinRate, 1)} />
              <CalibStat label="Actual Win Rate" value={fmtPct(calibration.actualWinRate, 1)} />
              <CalibStat
                label="Overconfidence"
                value={fmtPct(calibration.overconfidence, 1)}
                positive={calibration.overconfidence <= 0}
              />
            </div>

            {/* ROI by odds band */}
            {calibration.roiByOddsBand.length > 0 && (
              <CalibChart title="ROI by Odds Band" data={calibration.roiByOddsBand} />
            )}

            {/* ROI by confidence band */}
            {calibration.roiByConfidenceBand.length > 0 && (
              <CalibChart title="ROI by Confidence Band" data={calibration.roiByConfidenceBand} />
            )}

            {/* ROI by edge band */}
            {calibration.roiByEdgeBand.length > 0 && (
              <CalibChart title="ROI by Edge Band" data={calibration.roiByEdgeBand} />
            )}
          </>
        )}

        {calibration.sampleSize === 0 && (
          <div className="text-center py-6">
            <Brain className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-xs text-muted-foreground">No settled paper bets yet.</div>
            <div className="text-[10px] text-muted-foreground mt-1">Calibration will appear after 50+ settled paper trades.</div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function CalibStat({ label, value, positive }) {
  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3 text-center">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold font-mono mt-1 ${
        positive === true ? 'text-chart-1' : positive === false ? 'text-chart-5' : 'text-foreground'
      }`}>{value}</div>
    </div>
  );
}

function CalibChart({ title, data }) {
  const chartData = data.map(d => ({
    label: d.label,
    roi: +(d.roi * 100).toFixed(2),
    count: d.count,
    winRate: +(d.winRate * 100).toFixed(1),
  }));

  return (
    <div>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{title}</div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="label" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 9 }} />
          <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 9 }} />
          <Tooltip
            contentStyle={{ background: 'hsl(222 44% 8%)', border: '1px solid hsl(217 33% 17%)', borderRadius: '8px', fontSize: '11px' }}
            labelStyle={{ color: 'hsl(210 40% 96%)' }}
          />
          <Bar dataKey="roi" name="ROI %" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.roi >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-1">
        {chartData.map((d, i) => (
          <div key={i} className="text-[10px] text-muted-foreground">
            {d.label}: {d.count} bets · {d.winRate}% SR
          </div>
        ))}
      </div>
    </div>
  );
}