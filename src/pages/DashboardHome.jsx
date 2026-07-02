import React from 'react';
import { Panel, StatusBadge, SideBadge, PLValue } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Activity, DollarSign, TrendingUp, AlertCircle, Radar, Wifi } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2 } from 'lucide-react';

export default function DashboardHome() {
  const { bankrollStats, plData, markets, paperOrders, strategySignals, riskStatus, heatmap, mode, emergencyStop, demoMode } = useApp();

  const plMetrics = [
    { label: 'P/L', value: `+$${bankrollStats.totalPL.toFixed(2)}`, trend: 'up' },
    { label: 'ROI', value: `${bankrollStats.roi}%`, trend: 'up' },
    { label: 'Strike Rate', value: `${bankrollStats.strikeRate}%`, trend: 'up' },
    { label: 'Max Drawdown', value: `$${bankrollStats.maxDrawdown.toFixed(2)}`, trend: 'down' },
    { label: 'Longest Losing Streak', value: bankrollStats.longestLosingStreak, trend: 'neutral' },
  ];

  const heatmapBuckets = [
    { label: 'Very High', count: heatmap.veryHigh, color: 'bg-chart-1' },
    { label: 'High', count: heatmap.high, color: 'bg-chart-1/70' },
    { label: 'Medium', count: heatmap.medium, color: 'bg-chart-4' },
    { label: 'Low', count: heatmap.low, color: 'bg-chart-4/70' },
    { label: 'Very Low', count: heatmap.veryLow, color: 'bg-chart-5' },
  ];

  const modeLabel = emergencyStop ? 'EMERGENCY STOP' : mode === 'paper' ? 'PAPER TRADING' : mode === 'research' ? 'RESEARCH' : 'LIVE LOCKED';

  return (
    <div className="space-y-5">
      {/* Top Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Mode</span>
          <div className={`text-lg font-bold mt-2 ${emergencyStop ? 'text-chart-5' : 'text-chart-4'}`}>{modeLabel}</div>
          {demoMode && <div className="text-[10px] text-muted-foreground mt-1">Demo Data Active</div>}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bankroll</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">${bankrollStats.bankroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Starting $10,000</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today's P/L</span>
          <div className="text-2xl font-bold font-mono text-chart-1 mt-2">+${bankrollStats.todayPL.toFixed(2)}</div>
          <div className="text-[10px] text-chart-1 mt-1">↑ {bankrollStats.roi}% today</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Exposure</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">${bankrollStats.openExposure.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{((bankrollStats.openExposure / bankrollStats.bankroll) * 100).toFixed(1)}% of bank</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Markets</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">{markets.filter(m => m.status === 'OPEN').length}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{markets.filter(m => m.watched).length} watched</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Health</span>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-2 w-2 rounded-full bg-chart-1 animate-pulse" />
            <span className="text-lg font-bold text-chart-1">Healthy</span>
          </div>
          <div className="flex items-end gap-0.5 h-4 mt-1">
            {[3, 5, 4, 6, 7, 5, 8, 6, 9, 7, 8, 10].map((h, i) => (
              <div key={i} className="w-1 bg-chart-1/60 rounded-sm" style={{ height: `${h * 10}%` }} />
            ))}
          </div>
        </div>
      </div>

      {/* P/L Performance + Active Markets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="P/L Performance">
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={plData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                <XAxis dataKey="time" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid hsl(217 33% 17%)', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: 'hsl(215 20% 55%)' }}
                />
                <Line type="monotone" dataKey="pl" stroke="hsl(263 70% 55%)" strokeWidth={2} dot={false} name="P/L $" />
              </LineChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-border">
              {plMetrics.map(m => (
                <div key={m.label} className="text-center">
                  <div className={`text-sm font-bold font-mono ${m.trend === 'up' ? 'text-chart-1' : m.trend === 'down' ? 'text-chart-5' : 'text-foreground'}`}>{m.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Active Markets">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Market</TableHead>
                <TableHead className="text-xs">Start</TableHead>
                <TableHead className="text-xs">In-Play</TableHead>
                <TableHead className="text-xs text-right">Runners</TableHead>
                <TableHead className="text-xs text-right">Volume</TableHead>
                <TableHead className="text-xs text-right">Back</TableHead>
                <TableHead className="text-xs text-right">Lay</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {markets.slice(0, 6).map(m => {
                const runner = markets.length > 0 ? null : null;
                return (
                  <TableRow key={m.id} className="border-border">
                    <TableCell className="text-xs font-medium">{m.venue} {m.marketName.split(' ').slice(-1)[0]}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(m.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                    <TableCell className="text-xs">{m.inPlay ? <span className="text-chart-5 font-bold">YES</span> : <span className="text-muted-foreground">No</span>}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{m.numberOfRunners}</TableCell>
                    <TableCell className="text-xs text-right font-mono">${(m.totalMatched / 1000).toFixed(1)}k</TableCell>
                    <TableCell className="text-xs text-right font-mono text-chart-3">—</TableCell>
                    <TableCell className="text-xs text-right font-mono text-chart-5">—</TableCell>
                    <TableCell><StatusBadge status="ok">{m.status}</StatusBadge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      </div>

      {/* Recent Paper Orders + Strategy Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Recent Paper Orders">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Market</TableHead>
                <TableHead className="text-xs">Runner</TableHead>
                <TableHead className="text-xs">Side</TableHead>
                <TableHead className="text-xs text-right">Odds</TableHead>
                <TableHead className="text-xs text-right">Stake</TableHead>
                <TableHead className="text-xs text-right">P/L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paperOrders.slice(0, 6).map(o => (
                <TableRow key={o.id} className="border-border">
                  <TableCell className="text-xs text-muted-foreground">{new Date(o.created_date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell className="text-xs">{o.marketName}</TableCell>
                  <TableCell className="text-xs">{o.runnerName}</TableCell>
                  <TableCell><SideBadge side={o.side} /></TableCell>
                  <TableCell className="text-xs text-right font-mono">{o.matchedOdds?.toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-right font-mono">${o.matchedStake}</TableCell>
                  <TableCell className="text-xs text-right"><PLValue value={o.netProfit} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="Strategy Signals">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Strategy</TableHead>
                <TableHead className="text-xs">Runner</TableHead>
                <TableHead className="text-xs text-right">Edge</TableHead>
                <TableHead className="text-xs text-right">EV</TableHead>
                <TableHead className="text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {strategySignals.slice(0, 6).map(s => (
                <TableRow key={s.id} className="border-border">
                  <TableCell className="text-xs font-medium">{s.strategyName}</TableCell>
                  <TableCell className="text-xs">{s.runnerName || s.runnerId}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-chart-1">{s.edgePercent?.toFixed(2)}%</TableCell>
                  <TableCell className="text-xs text-right font-mono text-chart-1">${s.expectedValue?.toFixed(2)}</TableCell>
                  <TableCell><a className="text-xs text-chart-3 hover:underline cursor-pointer">VIEW</a></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>

      {/* Risk Status + Heatmap + Account */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel title="Risk Status">
          <div className="p-4 space-y-2.5">
            {Object.entries(riskStatus).map(([key, check]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-chart-1" />
                  <span className="text-muted-foreground">{check.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{check.value}{typeof check.value === 'number' && check.value < 100 ? '%' : ''}</span>
                  <StatusBadge status="ok">OK</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Market Heatmap">
          <div className="p-4">
            <div className="flex h-24 rounded-lg overflow-hidden">
              {heatmapBuckets.map(b => (
                <div key={b.label} className={`${b.color} flex-1 flex flex-col items-center justify-center`}>
                  <span className="text-lg font-bold text-background">{b.count}</span>
                  <span className="text-[9px] font-bold text-background/70 uppercase">{b.label}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 text-[10px] text-muted-foreground">
              <span>Liquidity: Very High → Very Low</span>
            </div>
          </div>
        </Panel>

        <Panel title="Account & System">
          <div className="p-4 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Betfair Account</span>
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-chart-1" /><span className="text-chart-1 font-semibold">Connected</span></div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last API Call</span>
              <span className="font-mono">{new Date().toLocaleTimeString('en-AU', { hour12: false })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Response Time</span>
              <span className="font-mono text-chart-1">120ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data Stream</span>
              <span className="font-mono">Demo Data</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">App Version</span>
              <span className="font-mono">v1.0.0</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}