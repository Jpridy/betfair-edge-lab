import React from 'react';
import { Panel } from '@/components/ui/Trading';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(222 44% 8%)',
  border: '1px solid hsl(217 33% 17%)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'hsl(210 40% 96%)',
};

function ChartCard({ title, children }) {
  return (
    <Panel title={title}>
      <div className="p-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export default function StrategyCharts({ audit }) {
  if (!audit) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <ChartCard title="Equity Curve">
        <LineChart data={audit.equityCurve}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="week" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="value" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Drawdown Over Time">
        <AreaChart data={audit.drawdownCurve}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="week" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine y={0} stroke="hsl(217 33% 25%)" />
          <Area type="monotone" dataKey="drawdown" stroke="hsl(0 72% 51%)" fill="hsl(0 72% 51% / 0.15)" strokeWidth={2} />
        </AreaChart>
      </ChartCard>

      <ChartCard title="ROI by Week">
        <BarChart data={audit.weeklyROI}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="week" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine y={0} stroke="hsl(217 33% 25%)" />
          <Bar dataKey="roi" fill="hsl(263 70% 55%)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="CLV Over Time">
        <LineChart data={audit.clvHistory}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="week" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine y={0} stroke="hsl(217 33% 25%)" />
          <Line type="monotone" dataKey="clv" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Strike Rate Over Time">
        <LineChart data={audit.strikeRateHistory}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="week" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} domain={[0, 100]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="rate" stroke="hsl(43 96% 56%)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Profit by Odds Range">
        <BarChart data={audit.profitByOddsRange}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="range" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine y={0} stroke="hsl(217 33% 25%)" />
          <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
            {audit.profitByOddsRange.map((entry, i) => (
              <Cell key={i} fill={entry.profit >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'} />
            ))}
          </Bar>
        </BarChart>
      </ChartCard>
    </div>
  );
}