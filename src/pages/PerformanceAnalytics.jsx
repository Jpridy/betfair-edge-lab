import React from 'react';
import { Panel, PLValue, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, DollarSign, Target, Percent, Activity, BarChart3 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { buildEquityCurve, buildMonthlyGrowth, buildWinLossDistribution, buildDrawdownCurve, buildCLVByStrategy, buildStrikeRateByStrategy, buildProfitByOddsRange, buildProfitByVenue, buildProfitBySide } from '@/lib/performanceData';

const COLORS = ['hsl(142 71% 45%)', 'hsl(0 72% 51%)', 'hsl(263 70% 55%)', 'hsl(199 89% 48%)'];

function EmptyChart({ text }) {
  return (
    <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

export default function PerformanceAnalytics() {
  const { bankrollStats, strategyStats, plData, paperOrders, settings } = useApp();

  const settledOrders = (paperOrders || []).filter(o => o.result === 'won' || o.result === 'lost');
  const settledWins = settledOrders.filter(o => o.result === 'won').length;
  const settledLosses = settledOrders.filter(o => o.result === 'lost').length;
  const settledNetPL = settledOrders.reduce((sum, o) => sum + (o.netProfit || 0), 0);
  const settledGrossPL = settledOrders.reduce((sum, o) => sum + (o.grossProfit || 0), 0);
  const settledCommission = settledOrders.reduce((sum, o) => sum + (o.commission || 0), 0);
  const avgCLV = settledOrders.length > 0 ? settledOrders.reduce((sum, o) => sum + (o.clv || 0), 0) / settledOrders.length : 0;
  const avgSlippage = settledOrders.length > 0 ? settledOrders.reduce((sum, o) => sum + (o.slippage || 0), 0) / settledOrders.length : 0;

  const totalWins = settledWins;
  const totalLosses = settledLosses;
  const winLossRatio = totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : '—';
  const totalBets = totalWins + totalLosses;
  const totalNetPL = settledNetPL;
  const avgROI = bankrollStats.roi || 0;

  // Live-derived chart data
  const startingBankroll = settings.paperBankroll || settings.bankroll || 10000;
  const equityCurve = buildEquityCurve(plData);
  const monthlyGrowth = buildMonthlyGrowth(settledOrders, startingBankroll);
  const winLossDist = buildWinLossDistribution(settledOrders);
  const drawdownCurve = buildDrawdownCurve(plData);
  const clvByStrategy = buildCLVByStrategy(settledOrders);
  const strikeRateByStrategy = buildStrikeRateByStrategy(settledOrders);
  const profitByOdds = buildProfitByOddsRange(settledOrders);
  const profitByVenue = buildProfitByVenue(settledOrders);
  const profitBySide = buildProfitBySide(settledOrders);

  const bestMonth = monthlyGrowth.length > 0 ? monthlyGrowth.reduce((best, m) => m.growth > best.growth ? m : best, monthlyGrowth[0]) : null;
  const worstMonth = monthlyGrowth.length > 0 ? monthlyGrowth.reduce((worst, m) => m.growth < worst.growth ? m : worst, monthlyGrowth[0]) : null;
  const positiveMonths = monthlyGrowth.filter(m => m.growth > 0).length;
  const negativeMonths = monthlyGrowth.filter(m => m.growth < 0).length;
  const sharpeEstimate = monthlyGrowth.length > 1
    ? (avgROI / (Math.sqrt(monthlyGrowth.reduce((sum, m) => sum + Math.pow(m.growth - avgROI, 2), 0) / monthlyGrowth.length))).toFixed(2)
    : '—';

  const kpiCards = [
    { label: 'Settled Net P/L', value: `${settledNetPL >= 0 ? '+' : ''}$${settledNetPL.toFixed(2)}`, icon: DollarSign, trend: settledNetPL >= 0 ? 'up' : 'down', color: settledNetPL >= 0 ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Win/Loss Ratio', value: winLossRatio, icon: Target, trend: totalWins > totalLosses ? 'up' : 'down', color: totalWins > totalLosses ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Avg ROI', value: `${avgROI.toFixed(2)}%`, icon: Percent, trend: avgROI > 0 ? 'up' : 'down', color: avgROI > 0 ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Settled Bets', value: settledOrders.length, icon: Activity, trend: 'neutral', color: 'text-foreground' },
    { label: 'Strike Rate', value: `${settledOrders.length > 0 ? ((settledWins / settledOrders.length) * 100).toFixed(1) : 0}%`, icon: TrendingUp, trend: 'up', color: 'text-chart-3' },
    { label: 'Avg CLV', value: `${avgCLV >= 0 ? '+' : ''}${avgCLV.toFixed(2)}%`, icon: Target, trend: avgCLV >= 0 ? 'up' : 'down', color: avgCLV >= 0 ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Avg Slippage', value: `${avgSlippage.toFixed(2)}%`, icon: BarChart3, trend: avgSlippage <= 0 ? 'up' : 'down', color: avgSlippage <= 0 ? 'text-chart-1' : 'text-chart-5' },
    { label: 'Commission Paid', value: `$${settledCommission.toFixed(2)}`, icon: DollarSign, trend: 'neutral', color: 'text-chart-4' },
  ];

  const tooltipStyle = {
    background: 'hsl(222 47% 9%)',
    border: '1px solid hsl(217 33% 17%)',
    borderRadius: '8px',
    fontSize: '12px',
  };

  const startingBank = equityCurve.length > 0 ? equityCurve[0].bankroll - (equityCurve[0].pl || 0) : startingBankroll;
  const currentBank = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].bankroll : startingBankroll;
  const totalGrowth = currentBank - startingBank;
  const totalGrowthPct = startingBank > 0 ? (totalGrowth / startingBank) * 100 : 0;

  const maxDrawdownVal = drawdownCurve.length > 0 ? Math.min(...drawdownCurve.map(d => d.drawdown)) : 0;
  const avgDrawdownVal = drawdownCurve.length > 0 ? drawdownCurve.reduce((s, d) => s + d.drawdown, 0) / drawdownCurve.length : 0;
  const currentDDPct = bankrollStats.bankroll > 0 ? (bankrollStats.maxDrawdown / bankrollStats.bankroll) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Settled Orders Notice */}
      <div className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground">
        <span className="text-chart-3 font-semibold">Metrics based on settled orders only.</span> {settledOrders.length} settled out of {(paperOrders || []).length} total. Pending and voided orders are excluded from performance calculations. Gross P/L: <span className="font-mono">${settledGrossPL.toFixed(2)}</span> · Commission: <span className="font-mono">${settledCommission.toFixed(2)}</span> · Net: <span className="font-mono">${settledNetPL.toFixed(2)}</span>
      </div>

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
        <TabsList className="bg-card border border-border flex-wrap">
          <TabsTrigger value="equity" className="text-xs">Equity Curve</TabsTrigger>
          <TabsTrigger value="growth" className="text-xs">Monthly Growth</TabsTrigger>
          <TabsTrigger value="winloss" className="text-xs">Win/Loss Distribution</TabsTrigger>
          <TabsTrigger value="drawdown" className="text-xs">Drawdown</TabsTrigger>
          <TabsTrigger value="clv" className="text-xs">CLV Over Time</TabsTrigger>
          <TabsTrigger value="profit" className="text-xs">Profit Breakdown</TabsTrigger>
          <TabsTrigger value="strikerate" className="text-xs">Strike Rate</TabsTrigger>
          <TabsTrigger value="compare" className="text-xs">Strategy Comparison</TabsTrigger>
        </TabsList>

        {/* Equity Curve */}
        <TabsContent value="equity">
          <Panel title="Equity Curve — Cumulative Bankroll">
            <div className="p-4">
              {equityCurve.length === 0 ? (
                <EmptyChart text="No settled orders yet. Start paper trading to build the equity curve." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={equityCurve}>
                      <defs>
                        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(263 70% 55%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(263 70% 55%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                      <XAxis dataKey="label" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} />
                      <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={(v) => [`$${v.toFixed(2)}`, 'Bankroll']} />
                      <ReferenceLine y={startingBank} stroke="hsl(215 20% 55%)" strokeDasharray="5 5" label={{ value: 'Starting Bank', fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
                      <Area type="monotone" dataKey="bankroll" stroke="hsl(263 70% 55%)" strokeWidth={2} fill="url(#equityGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono text-muted-foreground">${startingBank.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Starting Bankroll</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono text-foreground">${currentBank.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Current Bankroll</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-lg font-bold font-mono ${totalGrowth >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{totalGrowth >= 0 ? '+' : ''}${totalGrowth.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Total Growth</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-lg font-bold font-mono ${totalGrowthPct >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{totalGrowthPct >= 0 ? '+' : ''}{totalGrowthPct.toFixed(2)}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Total ROI</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Panel>
        </TabsContent>

        {/* Monthly Growth */}
        <TabsContent value="growth">
          <Panel title="Monthly Growth Chart — Net P/L by Month">
            <div className="p-4">
              {monthlyGrowth.length === 0 ? (
                <EmptyChart text="No settled orders yet. Monthly growth will appear once orders are settled." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={monthlyGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                      <XAxis dataKey="month" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} />
                      <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={(v, name) => name === 'growth' ? [`${v}%`, 'Growth'] : [`$${v}`, 'Net P/L']} />
                      <ReferenceLine y={0} stroke="hsl(215 20% 55%)" />
                      <Bar dataKey="netPL" name="netPL" radius={[4, 4, 0, 0]}>
                        {monthlyGrowth.map((entry, i) => (
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
                      <div className="text-lg font-bold font-mono text-chart-1">{monthlyGrowth.length > 0 ? ((positiveMonths / monthlyGrowth.length) * 100).toFixed(0) : 0}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Consistency Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono text-chart-1">{bestMonth ? `+${bestMonth.growth}%` : '—'}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{bestMonth ? `Best Month (${bestMonth.month})` : 'Best Month'}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Panel>
        </TabsContent>

        {/* Win/Loss Distribution */}
        <TabsContent value="winloss">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Panel title="Win/Loss Ratio Distribution by Strategy">
              <div className="p-4">
                {winLossDist.length === 0 ? (
                  <EmptyChart text="No settled orders yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={winLossDist} dataKey="wins" nameKey="strategy" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ strategy, wins }) => `${strategy}: ${wins}W`}>
                        {winLossDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`${v} wins`, name]} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            <Panel title="Wins vs Losses by Strategy">
              <div className="p-4">
                {winLossDist.length === 0 ? (
                  <EmptyChart text="No settled orders yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={winLossDist} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" horizontal={false} />
                      <XAxis type="number" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} />
                      <YAxis type="category" dataKey="strategy" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} width={100} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="wins" name="Wins" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="losses" name="Losses" fill="hsl(0 72% 51%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
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
                <div className="text-2xl font-bold font-mono text-foreground">{totalBets > 0 ? ((totalWins / totalBets) * 100).toFixed(1) : 0}%</div>
                <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Overall Strike Rate</div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* Drawdown */}
        <TabsContent value="drawdown">
          <Panel title="Drawdown Curve — Peak-to-Trough Decline">
            <div className="p-4">
              {drawdownCurve.length === 0 ? (
                <EmptyChart text="No settled orders yet. Drawdown will appear once orders are settled." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={drawdownCurve}>
                      <defs>
                        <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                      <XAxis dataKey="label" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} />
                      <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={(v) => [`$${v}`, 'Drawdown']} />
                      <ReferenceLine y={0} stroke="hsl(215 20% 55%)" />
                      <Area type="monotone" dataKey="drawdown" stroke="hsl(0 72% 51%)" strokeWidth={2} fill="url(#ddGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono text-chart-5">${Math.abs(maxDrawdownVal).toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Max Drawdown</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono text-chart-5">{startingBank > 0 ? (Math.abs(maxDrawdownVal) / startingBank * 100).toFixed(2) : 0}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Max DD %</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono text-foreground">${avgDrawdownVal.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Avg Drawdown</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono text-chart-1">{Math.abs(currentDDPct).toFixed(2)}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Current DD %</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Panel>
        </TabsContent>

        {/* CLV Over Time */}
        <TabsContent value="clv">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {clvByStrategy.length === 0 ? (
              <Panel title="CLV Over Time" className="lg:col-span-2">
                <EmptyChart text="No settled orders with CLV data yet." />
              </Panel>
            ) : clvByStrategy.map(s => (
              <Panel key={s.strategyName} title={`${s.strategyName} — CLV Over Time`}>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={s.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                      <XAxis dataKey="trade" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={v => [`${v}%`, 'CLV']} />
                      <ReferenceLine y={0} stroke="hsl(215 20% 55%)" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="clv" stroke={s.avgCLV >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="text-center text-[10px] text-muted-foreground mt-2">Avg CLV: {s.avgCLV >= 0 ? '+' : ''}{s.avgCLV.toFixed(1)}%</div>
                </div>
              </Panel>
            ))}
          </div>
        </TabsContent>

        {/* Profit Breakdown */}
        <TabsContent value="profit">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Panel title="Profit by Strategy">
              <div className="p-4">
                {strategyStats.length === 0 ? (
                  <EmptyChart text="No strategy data yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={strategyStats.map(s => ({ name: s.strategyName, profit: s.netProfit }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                      <XAxis dataKey="name" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={v => [`$${v}`, 'Net P/L']} />
                      <ReferenceLine y={0} stroke="hsl(215 20% 55%)" />
                      <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                        {strategyStats.map((s, i) => <Cell key={i} fill={s.netProfit >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            <Panel title="Profit by Odds Range">
              <div className="p-4">
                {profitByOdds.length === 0 ? (
                  <EmptyChart text="No settled orders yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={profitByOdds}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                      <XAxis dataKey="range" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={v => [`$${v}`, 'Profit']} />
                      <ReferenceLine y={0} stroke="hsl(215 20% 55%)" />
                      <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                        {profitByOdds.map((e, i) => <Cell key={i} fill={e.profit >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            <Panel title="Profit by Venue">
              <div className="p-4">
                {profitByVenue.length === 0 ? (
                  <EmptyChart text="No settled orders yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={profitByVenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                      <XAxis dataKey="venue" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={v => [`$${v}`, 'Profit']} />
                      <ReferenceLine y={0} stroke="hsl(215 20% 55%)" />
                      <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                        {profitByVenue.map((e, i) => <Cell key={i} fill={e.profit >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            <Panel title="Profit by Side (Back vs Lay)">
              <div className="p-4">
                {profitBySide.length === 0 ? (
                  <EmptyChart text="No settled orders yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={profitBySide}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                      <XAxis dataKey="side" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={v => [`$${v}`, 'Profit']} />
                      <ReferenceLine y={0} stroke="hsl(215 20% 55%)" />
                      <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                        {profitBySide.map((e, i) => <Cell key={i} fill={e.profit >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* Strike Rate Over Time */}
        <TabsContent value="strikerate">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {strikeRateByStrategy.length === 0 ? (
              <Panel title="Strike Rate Over Time" className="lg:col-span-2">
                <EmptyChart text="No settled orders yet. Strike rate trends will appear once orders are settled." />
              </Panel>
            ) : strikeRateByStrategy.map(s => (
              <Panel key={s.strategyName} title={`${s.strategyName} — Strike Rate Over Time`}>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={s.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                      <XAxis dataKey="trade" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(215 20% 55%)' }} formatter={v => [`${v}%`, 'Strike Rate']} />
                      <ReferenceLine y={50} stroke="hsl(215 20% 55%)" strokeDasharray="3 3" label={{ value: '50%', fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
                      <Line type="monotone" dataKey="rate" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="text-center text-[10px] text-muted-foreground mt-2">Current: {s.currentRate.toFixed(1)}%</div>
                </div>
              </Panel>
            ))}
          </div>
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
                {strategyStats.length === 0 ? (
                  <TableRow><TableCell colSpan={13} className="text-center text-xs text-muted-foreground py-8">No strategy stats yet. Start paper trading to build performance data.</TableCell></TableRow>
                ) : strategyStats.map(s => (
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