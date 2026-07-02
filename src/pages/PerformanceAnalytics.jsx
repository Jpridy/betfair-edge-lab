import React, { useState } from 'react';
import { Panel, PLValue, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, DollarSign, Target, Percent, Activity, BarChart3 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { DEMO_EQUITY_CURVE, DEMO_MONTHLY_GROWTH, DEMO_WINLOSS_DISTRIBUTION, DEMO_DRAWDOWN_CURVE } from '@/lib/demoData';

const COLORS = ['hsl(142 71% 45%)', 'hsl(0 72% 51%)', 'hsl(263 70% 55%)', 'hsl(199 89% 48%)'];

export default function PerformanceAnalytics() {
  const { bankrollStats, strategyStats, plData } = useApp();
  const [timeRange, setTimeRange] = useState('12m');

  const totalWins = strategyStats.reduce((sum, s) => sum + s.wins, 0);
  const totalLosses = strategyStats.reduce((sum, s) => sum + s.losses, 0);
  const winLossRatio = totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : '—';
  const totalBets = totalWins + totalLosses;
  const totalNetPL = strategyStats.reduce((sum, s) => sum + s.netProfit, 0);
  const avgROI = strategyStats.reduce((sum, s) => sum + s.roi, 0) / strategyStats.length;
  const bestMonth = DEMO_MONTHLY_GROWTH.reduce((best, m) => m.growth > best.growth ? m : best, DEMO_MONTHLY_GROWTH[0]);
  const worstMonth = DEMO_MONTHLY_GROWTH.reduce((worst, m) => m.growth < worst.growth ? m : worst, DEMO_MONTHLY_GROWTH[0]);
  const positiveMonths = DEMO_MONTHLY_GROWTH.filter(m => m.growth > 0).length;
  const negativeMonths = DEMO_MONTHLY_GROWTH.filter(m => m.growth < 0).length;
  const sharpeEstimate = (avgROI / (Math.sqrt(DEMO_MONTHLY_GROWTH.reduce((sum, m) => sum + Math.pow(m.growth - avgROI, 2), 0) / DEMO_MONTHLY_GROWTH.length))).toFixed(2);

  const kpiCards = [
    { label: 'Total Net P/L', value: `+$${totalNetPL.toFixed(2)}`, icon: DollarSign, trend: 'up', color: 'text-chart-1' },
    { label: 'Win/Loss Ratio', value: winLossRatio, icon: Target, trend: totalWins > totalLosses ? 'up' : 'down', color: totalWins > totalLosses ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Avg ROI', value: `${avgROI.toFixed(2)}%`, icon: Percent, trend: avgROI > 0 ? 'up' : 'down', color: avgROI > 0 ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Total Bets', value: totalBets, icon: Activity, trend: 'neutral', color: 'text-foreground' },
    { label: 'Win Rate', value: `${((totalWins / totalBets) * 100).toFixed(1)}%`, icon: TrendingUp, trend: 'up', color: 'text-chart-3' },
    { label: 'Est. Sharpe', value: sharpeEstimate, icon: BarChart3, trend: parseFloat(sharpeEstimate) > 0 ? 'up' : 'down', color: parseFloat(sharpeEstimate) > 0 ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Best Month', value: `${bestMonth.month} +${bestMonth.growth}%`, icon: TrendingUp, trend: 'up', color: 'text-chart-1' },
    { label: 'Worst Month', value: `${worstMonth.month} ${worstMonth.growth}%`, icon: TrendingDown, trend: 'down', color: 'text-chart-5' },
  ];

  const tooltipStyle = {
    background: 'hsl(222 47% 9%)',
    border: '1px solid hsl(217 33% 17%)',
    borderRadius: '8px',
    fontSize: '12px',
  };

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpiCards.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{k.label}</span>
                <Icon className={`h-3.5 w-3.5 ${k.color}`} />
              </div>
              <div className={`text-sm font-bold font-mono ${k.color}`}>{k.value}</div>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="equity">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="equity" className="text-xs">Equity Curve</TabsTrigger>
          <TabsTrigger value="growth" className="text-xs">Monthly Growth</TabsTrigger>
          <TabsTrigger value="winloss" className="text-xs">Win/Loss Distribution</TabsTrigger>
          <TabsTrigger value="drawdown" className="text-xs">Drawdown</TabsTrigger>
          <TabsTrigger value="compare" className="text-xs">Strategy Comparison</TabsTrigger>
        </TabsList>

        {/* Equity Curve */}
        <TabsContent value="equity">
          <Panel title="Equity Curve — Cumulative Bankroll (12 Months)">
            <div className="p-4">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={DEMO_EQUITY_CURVE}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(263 70% 55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(263 70% 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                  <XAxis dataKey="month" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={(v) => [`$${v.toFixed(2)}`, 'Bankroll']} />
                  <ReferenceLine y={10000} stroke="hsl(215 20% 55%)" strokeDasharray="5 5" label={{ value: 'Starting Bank', fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
                  <Area type="monotone" dataKey="bankroll" stroke="hsl(263 70% 55%)" strokeWidth={2} fill="url(#equityGradient)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-chart-1">${DEMO_EQUITY_CURVE[0].bankroll.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Starting Bankroll</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-foreground">${DEMO_EQUITY_CURVE[DEMO_EQUITY_CURVE.length - 1].bankroll.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Current Bankroll</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-chart-1">+${(DEMO_EQUITY_CURVE[DEMO_EQUITY_CURVE.length - 1].bankroll - DEMO_EQUITY_CURVE[0].bankroll).toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Total Growth</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-chart-1">{(((DEMO_EQUITY_CURVE[DEMO_EQUITY_CURVE.length - 1].bankroll - DEMO_EQUITY_CURVE[0].bankroll) / DEMO_EQUITY_CURVE[0].bankroll) * 100).toFixed(2)}%</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Total ROI</div>
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* Monthly Growth */}
        <TabsContent value="growth">
          <Panel title="Monthly Growth Chart — Net P/L by Month">
            <div className="p-4">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={DEMO_MONTHLY_GROWTH}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                  <XAxis dataKey="month" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={(v, name) => name === 'growth' ? [`${v}%`, 'Growth'] : [`$${v}`, 'Net P/L']} />
                  <ReferenceLine y={0} stroke="hsl(215 20% 55%)" />
                  <Bar dataKey="netPL" name="netPL" radius={[4, 4, 0, 0]}>
                    {DEMO_MONTHLY_GROWTH.map((entry, i) => (
                      <Cell key={i} fill={entry.netPL >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-chart-1">{positiveMonths}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Profitable Months</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-chart-5">{negativeMonths}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Losing Months</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-chart-1">{((positiveMonths / DEMO_MONTHLY_GROWTH.length) * 100).toFixed(0)}%</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Consistency Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-chart-1">+{bestMonth.growth}%</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Best Month ({bestMonth.month})</div>
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* Win/Loss Distribution */}
        <TabsContent value="winloss">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Panel title="Win/Loss Ratio Distribution by Strategy">
              <div className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={DEMO_WINLOSS_DISTRIBUTION} dataKey="wins" nameKey="strategy" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ strategy, wins }) => `${strategy}: ${wins}W`}>
                      {DEMO_WINLOSS_DISTRIBUTION.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`${v} wins`, name]} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Wins vs Losses by Strategy">
              <div className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={DEMO_WINLOSS_DISTRIBUTION} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" horizontal={false} />
                    <XAxis type="number" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} />
                    <YAxis type="category" dataKey="strategy" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} width={100} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="wins" name="Wins" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="losses" name="Losses" fill="hsl(0 72% 51%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <Panel title="Win/Loss Summary" className="mt-5">
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background/50 border border-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold font-mono text-chart-1">{totalWins}</div>
                <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Total Wins</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold font-mono text-chart-5">{totalLosses}</div>
                <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Total Losses</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold font-mono text-chart-3">{winLossRatio}</div>
                <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Win/Loss Ratio</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold font-mono text-foreground">{((totalWins / totalBets) * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Overall Strike Rate</div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* Drawdown */}
        <TabsContent value="drawdown">
          <Panel title="Drawdown Curve — Peak-to-Trough Decline (12 Months)">
            <div className="p-4">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={DEMO_DRAWDOWN_CURVE}>
                  <defs>
                    <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                  <XAxis dataKey="month" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={(v) => [`$${v}`, 'Drawdown']} />
                  <ReferenceLine y={0} stroke="hsl(215 20% 55%)" />
                  <Area type="monotone" dataKey="drawdown" stroke="hsl(0 72% 51%)" strokeWidth={2} fill="url(#ddGradient)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-chart-5">${Math.min(...DEMO_DRAWDOWN_CURVE.map(d => d.drawdown)).toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Max Drawdown</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-chart-5">{(Math.min(...DEMO_DRAWDOWN_CURVE.map(d => d.drawdown)) / 10000 * 100).toFixed(2)}%</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Max DD %</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-foreground">${(DEMO_DRAWDOWN_CURVE.reduce((sum, d) => sum + d.drawdown, 0) / DEMO_DRAWDOWN_CURVE.length).toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Avg Drawdown</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-chart-1">{(bankrollStats.maxDrawdown / bankrollStats.bankroll * 100).toFixed(2)}%</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Current DD %</div>
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* Strategy Comparison */}
        <TabsContent value="compare">
          <Panel title="Strategy Comparison — Detailed Performance Metrics">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs">Strategy</TableHead>
                  <TableHead className="text-xs text-right">Signals</TableHead>
                  <TableHead className="text-xs text-right">Orders</TableHead>
                  <TableHead className="text-xs text-right">Wins</TableHead>
                  <TableHead className="text-xs text-right">Losses</TableHead>
                  <TableHead className="text-xs text-right">Strike Rate</TableHead>
                  <TableHead className="text-xs text-right">Net P/L</TableHead>
                  <TableHead className="text-xs text-right">ROI</TableHead>
                  <TableHead className="text-xs text-right">Profit Factor</TableHead>
                  <TableHead className="text-xs text-right">Max DD</TableHead>
                  <TableHead className="text-xs text-right">Avg Edge</TableHead>
                  <TableHead className="text-xs text-right">CLV</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {strategyStats.map(s => (
                  <TableRow key={s.id} className="border-border">
                    <TableCell className="text-xs font-semibold">{s.strategyName}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{s.totalSignals}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{s.totalPaperOrders}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-chart-1">{s.wins}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-chart-5">{s.losses}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{s.strikeRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs text-right"><PLValue value={s.netProfit} /></TableCell>
                    <TableCell className={`text-xs text-right font-mono ${s.roi >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{s.roi.toFixed(2)}%</TableCell>
                    <TableCell className={`text-xs text-right font-mono ${s.profitFactor >= 1 ? 'text-chart-1' : 'text-chart-5'}`}>{s.profitFactor.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-chart-5">${s.maxDrawdown.toFixed(0)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{s.averageEdge.toFixed(2)}%</TableCell>
                    <TableCell className={`text-xs text-right font-mono ${s.closingLineValue >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{s.closingLineValue >= 0 ? '+' : ''}{s.closingLineValue.toFixed(2)}%</TableCell>
                    <TableCell><StatusBadge status={s.statusLabel === 'promising' ? 'ok' : s.statusLabel === 'failing' ? 'danger' : s.statusLabel === 'needs_more_data' ? 'info' : 'warning'}>{s.statusLabel.replace(/_/g, ' ')}</StatusBadge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}