import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Panel, StatusBadge, SideBadge, PLValue } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Plus, XCircle, RefreshCw, Download, ArrowRight, AlertTriangle, Inbox, TrendingUp } from 'lucide-react';
import PaperProgress from '@/components/paper/PaperProgress';
import { exportToCSV } from '@/lib/csvExport';
import { createValidatedPaperOrder } from '@/lib/createValidatedPaperOrder';
import EmptyState from '@/components/EmptyState';

const ORDER_STATUSES = ['pending', 'executable', 'execution_complete', 'matched', 'partially_matched', 'unmatched', 'cancelled', 'lapsed', 'voided', 'settled', 'rejected'];

export default function PaperTrading() {
  const { paperOrders, addPaperOrder, markets, runners, settings, bankrollStats, emergencyStop, addAuditLog, cancelUnmatchedOrders, recalculateMetrics, dataLoading } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    marketId: markets[0]?.id || '',
    runnerId: '',
    side: 'BACK',
    odds: 3.0,
    stake: settings.baseStake,
    strategy: 'Featherless AI Value Decision Engine',
    persistenceType: 'LAPSE',
  });

  const marketRunners = runners.filter(r => r.marketId === form.marketId);
  const selectedRunner = runners.find(r => r.id === form.runnerId);

  // Auto-fill odds from live market data when runner or side changes
  useEffect(() => {
    if (selectedRunner) {
      const liveOdds = form.side === 'BACK' ? selectedRunner.bestBackPrice : selectedRunner.bestLayPrice;
      if (liveOdds > 0) {
        setForm(prev => ({ ...prev, odds: liveOdds }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.runnerId, form.side]);

  const handleSubmit = () => {
    if (!form.runnerId || !selectedRunner) return;
    if (emergencyStop) return;

    const runner = runners.find(r => r.id === form.runnerId);
    const market = markets.find(m => m.id === form.marketId);

    const { order, rejected, reason } = createValidatedPaperOrder({
      market,
      runner,
      side: form.side,
      stake: form.stake,
      odds: form.odds,
      strategyName: form.strategy,
      source: 'manual',
      settings,
      bankrollStats,
      existingOrders: paperOrders,
      emergencyStop,
      persistenceType: form.persistenceType || 'LAPSE',
      entryReason: `${form.strategy} manual paper order`,
    });

    addPaperOrder(order);
    if (rejected) {
      addAuditLog('Paper Order Rejected', 'order', 'warning', `${form.side} ${runner?.runnerName} — rejected: ${reason}`);
    } else {
      addAuditLog('Paper Order Created', 'order', 'info', `${form.side} ${runner?.runnerName} @ ${form.odds} × $${form.stake} (${form.persistenceType}) — ${order.status}`);
    }
    setShowForm(false);
  };

  const startingBankroll = settings.paperBankroll || settings.bankroll;
  const equityCurve = paperOrders.slice(0, 20).reverse().map((o, i) => ({
    idx: i + 1,
    equity: startingBankroll + paperOrders.slice(0, i + 1).reduce((sum, p) => sum + (p.netProfit || 0), 0),
  }));

  const openOrders = paperOrders.filter(o => ['pending', 'executable', 'unmatched', 'partially_matched'].includes(o.status));
  const settledOrders = paperOrders.filter(o => o.result === 'won' || o.result === 'lost');

  const handleCancelUnmatched = () => {
    cancelUnmatchedOrders();
  };

  const handleRecalculate = () => {
    recalculateMetrics();
  };

  const handleExportCSV = () => {
    const columns = [
      { key: 'created_date', label: 'Time' },
      { key: 'strategyName', label: 'Strategy' },
      { key: 'marketName', label: 'Market' },
      { key: 'runnerName', label: 'Runner' },
      { key: 'side', label: 'Side' },
      { key: 'matchedOdds', label: 'Odds' },
      { key: 'matchedStake', label: 'Stake' },
      { key: 'status', label: 'Status' },
      { key: 'result', label: 'Result' },
      { key: 'netProfit', label: 'Net P/L' },
    ];
    exportToCSV(`paper-trading-${new Date().toISOString().slice(0, 10)}.csv`, paperOrders, columns);
    addAuditLog('Export Paper Trading CSV', 'system', 'info', `Exported ${paperOrders.length} paper orders to CSV`);
  };

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Paper Bankroll</span>
          <div className="text-xl font-bold font-mono text-foreground mt-1">${bankrollStats.bankroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Paper P/L</span>
          <div className={`text-xl font-bold font-mono mt-1 ${bankrollStats.totalPL >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{bankrollStats.totalPL >= 0 ? '+' : ''}${bankrollStats.totalPL.toFixed(2)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Paper ROI</span>
          <div className={`text-xl font-bold font-mono mt-1 ${bankrollStats.roi >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{bankrollStats.roi}%</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Open Orders</span>
          <div className="text-xl font-bold font-mono text-chart-4 mt-1">{openOrders.length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Settled Orders</span>
          <div className="text-xl font-bold font-mono text-foreground mt-1">{settledOrders.length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Drawdown</span>
          <div className="text-xl font-bold font-mono text-chart-5 mt-1">${bankrollStats.maxDrawdown.toFixed(2)}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setShowForm(true)} disabled={emergencyStop}>
          <Plus className="h-4 w-4" /> Create Manual Paper Order
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancelUnmatched} disabled={openOrders.length === 0}>
          <XCircle className="h-4 w-4" /> Cancel Unmatched ({openOrders.length})
        </Button>
        <Button size="sm" variant="outline" onClick={handleRecalculate}>
          <RefreshCw className="h-4 w-4" /> Recalculate Settled Stats
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportCSV}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
        <Link to="/orders" className="ml-auto">
          <Button size="sm" variant="ghost">
            View All Orders <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* Paper Progress Per Strategy */}
      <PaperProgress />

      {/* Equity Curve */}
      <Panel title="Equity Curve">
        <div className="p-4">
          {equityCurve.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No equity data yet" message="Settled paper orders will build the equity curve over time." className="h-[200px]" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                <XAxis dataKey="idx" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid hsl(217 33% 17%)', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="equity" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} name="Bankroll $" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      {/* New Order Form */}
      {showForm && (
        <Panel title="New Paper Order">
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Market</Label>
              <Select value={form.marketId} onValueChange={v => setForm({...form, marketId: v, runnerId: ''})}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {markets.map(m => <SelectItem key={m.id} value={m.id}>{m.venue} — {m.marketName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Runner</Label>
              <Select value={form.runnerId} onValueChange={v => setForm({...form, runnerId: v})}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue placeholder="Select runner" /></SelectTrigger>
                <SelectContent>
                  {marketRunners.map(r => <SelectItem key={r.id} value={r.id}>{r.runnerName} ({r.bestBackPrice.toFixed(2)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Strategy</Label>
              <Select value={form.strategy} onValueChange={v => setForm({...form, strategy: v})}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Featherless AI Value Decision Engine">Featherless AI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Side</Label>
              <Select value={form.side} onValueChange={v => setForm({...form, side: v})}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BACK">BACK</SelectItem>
                  <SelectItem value="LAY">LAY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Odds</Label>
              <Input type="number" step="0.01" value={form.odds} onChange={e => setForm({...form, odds: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Stake ($)</Label>
              <Input type="number" value={form.stake} onChange={e => setForm({...form, stake: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Persistence Type</Label>
              <Select value={form.persistenceType} onValueChange={v => setForm({...form, persistenceType: v})}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LAPSE">LAPSE (cancel at jump)</SelectItem>
                  <SelectItem value="PERSIST" disabled={!settings.persistApproved}>PERSIST (keep in-play){!settings.persistApproved ? ' — disabled' : ''}</SelectItem>
                  <SelectItem value="MARKET_ON_CLOSE">MARKET_ON_CLOSE (BSP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedRunner && (
              <div className="md:col-span-3 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                Best Back: <span className="font-mono text-chart-3">{selectedRunner.bestBackPrice.toFixed(2)}</span> ·
                Best Lay: <span className="font-mono text-chart-5">{selectedRunner.bestLayPrice.toFixed(2)}</span> ·
                Implied Prob: <span className="font-mono">{selectedRunner.impliedProbability.toFixed(1)}%</span> ·
                Spread: <span className="font-mono">{selectedRunner.spreadTicks || '—'} ticks</span> ·
                MBR: <span className="font-mono">{((markets.find(m => m.id === form.marketId)?.marketBaseRate || 0) * 100).toFixed(1)}%</span>
              </div>
            )}
            {form.persistenceType === 'PERSIST' && (
              <div className="md:col-span-3 text-xs text-chart-5 flex items-center gap-1 bg-chart-5/5 rounded p-2">
                <AlertTriangle className="h-3 w-3" /> PERSIST keeps unmatched bets active in-play — dangerous in paper mode. {settings.persistApproved ? 'Approved.' : 'Not approved — bot never uses PERSIST.'}
              </div>
            )}
            <div className="md:col-span-3 flex gap-2">
              <Button onClick={handleSubmit} disabled={emergencyStop || !form.runnerId || !selectedRunner || form.stake <= 0 || form.stake > settings.maxStake || form.odds < settings.minOdds || form.odds > settings.maxOdds}>Submit Paper Order</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Panel>
      )}

      {/* Order Lifecycle Table */}
      <Panel title="Order Lifecycle — Betfair Exchange Structure">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs">Strategy</TableHead>
              <TableHead className="text-xs">Race</TableHead>
              <TableHead className="text-xs">Horse</TableHead>
              <TableHead className="text-xs">Side</TableHead>
              <TableHead className="text-xs text-right">Odds</TableHead>
              <TableHead className="text-xs text-right">Stake</TableHead>
              <TableHead className="text-xs">Persistence</TableHead>
              <TableHead className="text-xs">Sim Quality</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Result</TableHead>
              <TableHead className="text-xs text-right">CLV</TableHead>
              <TableHead className="text-xs text-right">P/L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paperOrders.length === 0 && !dataLoading ? (
              <TableRow>
                <TableCell colSpan={13} className="py-0">
                  <EmptyState
                    icon={Inbox}
                    title="No paper orders yet"
                    message="Create a manual paper order above, or start the bot from the Bot Control Centre to begin automated paper trading."
                  />
                </TableCell>
              </TableRow>
            ) : paperOrders.map(o => (
              <TableRow key={o.id} className="border-border">
                <TableCell className="text-xs text-muted-foreground">{new Date(o.created_date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                <TableCell className="text-xs">{o.strategyName}</TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium">{o.venue || '—'}</div>
                  <div className="text-muted-foreground">R{o.raceNumber || '?'} · {o.marketName}</div>
                  {o.marketStartTime && <div className="text-muted-foreground">{new Date(o.marketStartTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</div>}
                </TableCell>
                <TableCell className="text-xs font-medium">#{o.horseNumber || '?'} {o.runnerName}</TableCell>
                <TableCell><SideBadge side={o.side} /></TableCell>
                <TableCell className="text-xs text-right font-mono">{o.matchedOdds?.toFixed(2) || '—'}</TableCell>
                <TableCell className="text-xs text-right font-mono">${o.matchedStake || o.requestedStake || 0}</TableCell>
                <TableCell className="text-xs">
                  <StatusBadge status={o.persistenceType === 'PERSIST' ? 'warning' : o.persistenceType === 'MARKET_ON_CLOSE' ? 'info' : 'neutral'}>{o.persistenceType || 'LAPSE'}</StatusBadge>
                </TableCell>
                <TableCell className="text-xs">
                  <StatusBadge status={o.paperSimulationQuality === 'High' ? 'ok' : o.paperSimulationQuality === 'Good' ? 'info' : 'warning'}>{o.paperSimulationQuality || 'Basic'}</StatusBadge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={
                    o.status === 'matched' ? 'ok' :
                    o.status === 'rejected' || o.status === 'cancelled' || o.status === 'failed' || o.status === 'lapsed' ? 'danger' :
                    o.status === 'partially_matched' || o.status === 'unmatched' ? 'warning' : 'info'
                  }>{o.status}</StatusBadge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={o.result === 'won' ? 'ok' : o.result === 'lost' ? 'danger' : 'neutral'}>{o.result}</StatusBadge>
                </TableCell>
                <TableCell className={`text-xs text-right font-mono ${(o.clv || 0) >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{o.clv ? `${o.clv >= 0 ? '+' : ''}${o.clv.toFixed(1)}%` : '—'}</TableCell>
                <TableCell className="text-xs text-right"><PLValue value={o.netProfit} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {/* Lifecycle Stages */}
      <Panel title="Order Status Flow">
        <div className="p-4 flex flex-wrap items-center gap-2">
          {ORDER_STATUSES.map((s, i) => (
            <React.Fragment key={s}>
              <div className="px-3 py-1.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">{s}</div>
              {i < ORDER_STATUSES.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
            </React.Fragment>
          ))}
        </div>
      </Panel>
    </div>
  );
}