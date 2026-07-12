import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { fmtPct } from '@/lib/format';
import { BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine } from 'recharts';

function CalibrationMetric({ label, value, warning }) {
  return (
    <div className="rounded-md border border-border-subtle bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-label text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-foreground">{value}</div>
      {warning && <div className="mt-1 text-[10px] text-warning">{warning}</div>}
    </div>
  );
}

export default function CalibrationTab() {
  const { calibration } = useApp();

  if (!calibration || calibration.sampleSize === 0) {
    return (
      <Panel title="Calibration" subtitle="Model probability accuracy">
        <div className="p-8 text-center text-sm text-muted-foreground">
          No settled bets with model probabilities yet. Calibration requires settled BACK or LAY paper bets with AI probability data.
        </div>
      </Panel>
    );
  }

  const sampleSize = calibration.sampleSize || 0;
  const expectedStrike = calibration.predictedWinRate != null ? calibration.predictedWinRate * 100 : 0;
  const actualStrike = calibration.actualWinRate != null ? calibration.actualWinRate * 100 : 0;
  const diff = expectedStrike - actualStrike;
  const brierScore = calibration.brierScore;
  const logLoss = calibration.logLoss;
  const warning = sampleSize < 50 ? `Small sample (${sampleSize}/50). Results may not be reliable.` : null;

  // Build reliability chart data from confidence bands
  const bandData = (calibration.roiByConfidenceBand || []).map(b => ({
    label: b.label,
    predicted: (b.predictedWinRate || 0) * 100,
    actual: (b.actualWinRate || 0) * 100,
    count: b.count || 0,
  }));

  // Calibration by side
  const sideData = Object.entries(calibration.calibrationBySide || {}).map(([side, stats]) => ({
    label: side,
    predicted: (stats.predictedWinRate || 0) * 100,
    actual: (stats.actualWinRate || 0) * 100,
    count: stats.count || 0,
  }));

  return (
    <div className="space-y-4">
      {warning && (
        <div className="rounded-lg p-3 text-xs bg-warning/8 text-warning border border-warning/20">
          {warning}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <CalibrationMetric label="Expected Strike Rate" value={fmtPct(expectedStrike)} />
        <CalibrationMetric label="Actual Strike Rate" value={fmtPct(actualStrike)} />
        <CalibrationMetric label="Difference" value={fmtPct(Math.abs(diff))} warning={Math.abs(diff) > 5 ? 'Overconfident' : null} />
        <CalibrationMetric label="Brier Score" value={brierScore != null ? brierScore.toFixed(4) : '—'} warning={brierScore > 0.25 ? 'Poor' : null} />
        <CalibrationMetric label="Log Loss" value={logLoss != null ? logLoss.toFixed(4) : '—'} warning={logLoss > 0.69 ? 'Poor' : null} />
      </div>

      <Panel title="Reliability Chart" subtitle="Expected vs actual strike rate by probability band">
        {bandData.length > 0 ? (
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bandData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={v => `${v.toFixed(1)}%`} />
                <Bar dataKey="predicted" name="Expected" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">No confidence band data available.</div>
        )}
      </Panel>

      <Panel title="Calibration by Side" subtitle="BACK vs LAY calibration comparison">
        {sideData.length > 0 ? (
          <div className="p-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sideData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={v => `${v.toFixed(1)}%`} />
                <Bar dataKey="predicted" name="Expected" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">No side calibration data available.</div>
        )}
      </Panel>

      <Panel title="Probability Bands" subtitle="Sample sizes and accuracy by confidence band">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">
                <th className="px-3 py-2 text-left">Band</th>
                <th className="px-3 py-2 text-right">Samples</th>
                <th className="px-3 py-2 text-right">Expected</th>
                <th className="px-3 py-2 text-right">Actual</th>
                <th className="px-3 py-2 text-right">Brier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {bandData.map(b => (
                <tr key={b.label} className="hover:bg-hover/50">
                  <td className="px-3 py-2 font-medium text-foreground">{b.label}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{b.count}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{b.predicted.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{b.actual.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{b.count > 0 ? '—' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}