import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { fmtPct } from '@/lib/format';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function CalibrationMetric({ label, value, warning }) {
  return (
    <div className="rounded-md border border-border-subtle bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-label text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-foreground">{value}</div>
      {warning && <div className="mt-1 text-[10px] text-warning">{warning}</div>}
    </div>
  );
}

const toPercent = value => Number.isFinite(Number(value)) ? Number(value) * 100 : 0;

export default function CalibrationTab() {
  const { calibration } = useApp();

  if (!calibration || calibration.sampleSize === 0) {
    return (
      <Panel title="Calibration" subtitle="Model probability accuracy">
        <div className="p-8 text-center text-sm text-muted-foreground">
          No eligible settled bets with model probabilities yet. Calibration excludes proof, invalid and unresolved orders.
        </div>
      </Panel>
    );
  }

  const sampleSize = calibration.sampleSize || 0;
  const expectedStrike = toPercent(calibration.predictedWinRate);
  const actualStrike = toPercent(calibration.actualWinRate);
  const difference = actualStrike - expectedStrike;
  const brierScore = calibration.brierScore;
  const logLoss = calibration.logLoss;
  const warning = sampleSize < 100 ? `Small sample (${sampleSize}/100). Do not rely on these results yet.` : null;

  const bandData = (calibration.roiByConfidenceBand || []).map(band => ({
    label: band.label,
    predicted: toPercent(band.predictedWinRate),
    actual: toPercent(band.actualWinRate),
    count: band.count || 0,
  }));

  const sideData = Object.entries(calibration.calibrationBySide || {}).map(([side, stats]) => ({
    label: side,
    predicted: toPercent(stats.predictedWinRate),
    actual: toPercent(stats.actualWinRate),
    count: stats.count || 0,
  }));

  return (
    <div className="space-y-4">
      {warning && <div className="rounded-lg border border-warning/20 bg-warning/8 p-3 text-xs text-warning">{warning}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <CalibrationMetric label="Expected Strike Rate" value={fmtPct(expectedStrike)} />
        <CalibrationMetric label="Actual Strike Rate" value={fmtPct(actualStrike)} />
        <CalibrationMetric label="Actual − Expected" value={fmtPct(difference)} warning={Math.abs(difference) > 5 ? 'Material calibration gap' : null} />
        <CalibrationMetric label="Brier Score" value={brierScore != null ? Number(brierScore).toFixed(4) : '—'} warning={brierScore > 0.25 ? 'Poor calibration' : null} />
        <CalibrationMetric label="Log Loss" value={logLoss != null ? Number(logLoss).toFixed(4) : '—'} warning={logLoss > 0.69 ? 'Poor calibration' : null} />
      </div>

      <Panel title="Reliability Chart" subtitle="Expected versus actual strike rate by probability band">
        {bandData.length > 0 ? (
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bandData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={value => `${value}%`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={value => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="predicted" name="Expected" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="p-8 text-center text-sm text-muted-foreground">No probability-band data available.</div>}
      </Panel>

      <Panel title="Calibration by Side" subtitle="BACK and LAY are measured separately">
        {sideData.length > 0 ? (
          <div className="h-48 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sideData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={value => `${value}%`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={value => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="predicted" name="Expected" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="p-8 text-center text-sm text-muted-foreground">No side calibration data available.</div>}
      </Panel>

      <Panel title="Probability Bands" subtitle="Sample count and accuracy by band">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr className="text-[10px] font-body font-medium uppercase tracking-label text-muted-foreground">
                <th className="px-3 py-2 text-left">Band</th>
                <th className="px-3 py-2 text-right">Samples</th>
                <th className="px-3 py-2 text-right">Expected</th>
                <th className="px-3 py-2 text-right">Actual</th>
                <th className="px-3 py-2 text-right">Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {bandData.map(band => (
                <tr key={band.label} className="hover:bg-hover/50">
                  <td className="px-3 py-2 font-medium text-foreground">{band.label}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{band.count}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{band.predicted.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{band.actual.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{(band.actual - band.predicted).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
