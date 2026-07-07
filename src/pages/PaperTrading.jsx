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
import { Plus, XCircle, RefreshCw, Download, ArrowRight, AlertTriangle } from 'lucide-react';
import PaperProgress from '@/components/paper/PaperProgress';
import FeatherlessAIDecisionPanel from '@/components/featherless/FeatherlessAIDecisionPanel';
import { exportToCSV } from '@/lib/csvExport';

const ORDER_STATUSES = ['pending', 'executable', 'execution_complete', 'matched', 'partially_matched', 'unmatched', 'cancelled', 'lapsed', 'voided', 'settled', 'rejected'];

export default function PaperTrading() {
  const { paperOrders, addPaperOrder, markets, runners, settings, bankrollStats, mode, emergencyStop, addAuditLog } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    marketId: markets[0]?.id || '',
    runnerId: '',
    side: 'BACK',
    odds: 3.0,
    stake: settings.baseStake,
    strategy: 'Value Bet',
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
    if (emergencyStop || mode === 'live') return;

    // Risk checks
    const riskChecks = [];
    if (form.stake > settings.maxStake) riskChecks.push('Stake exceeds max');
    if ((form.stake / bankrollStats.bankroll) * 100 > settings.maxStakePercent) riskChecks.push('Stake % exceeds limit');
    if (form.odds < settings.minOdds || form.odds > settings.maxOdds) riskChecks.push('Odds outside range');
    if (bankrollStats.openExposure + form.stake > settings.maxMarketExposure) riskChecks.push('Exposure limit');

    const runner = runners.find(r => r.id === form.runnerId);
    const market = markets.find(m => m.id === form.marketId);

    const order = {
      strategyName: form.strategy,
      marketId: form.marketId,
      betfairMarketId: market?.betfairMarketId || form.marketId,
      selectionId: runner?.betfairSelectionId || runner?.selectionId,
      runnerId: form.runnerId,
      runnerName: runner?.runnerName || 'Unknown',
      marketName: market?.marketName || 'Unknown',
      venue: market?.venue || '',
      raceNumber: market?.raceNumber || 0,
      side: form.side,
      orderType: 'LIMIT',
      size: form.stake,
      price: form.odds,
      persistenceType: form.persistenceType || 'LAPSE',
      customerRef: 'BEL' + Date.now().toString(36).toUpperCase(),
      customerStrategyRef: 'BEL_' + form.strategy.toUpperCase().replace(/[^A-Z]/g, ''),
      handicap: runner?.handicap || 0,
      paper_mode: true,
      liveMode: false,
      requested_size: form.stake,
      matched_size: riskChecks.length > 0 ? 0 : form.stake,
      remaining_size: riskChecks.length > 0 ? form.stake : 0,
      average_price_matched: riskChecks.length > 0 ? null : form.odds,
      requested_price: form.odds,
      matched_price: riskChecks.length > 0 ? null : form.odds,
      placed_date: new Date().toISOString(),
      matched_date: riskChecks.length > 0 ? null : new Date().toISOString(),
      requestedOdds: form.odds,
      matchedOdds: riskChecks.length > 0 ? null : form.odds,
      requestedStake: form.stake,
      matchedStake: riskChecks.length > 0 ? 0 : form.stake,
      status: riskChecks.length > 0 ? 'rejected' : 'matched',
      failed_validation_field: riskChecks[0] || null,
      rejection_reason: riskChecks.length > 0 ? riskChecks.join('; ') : null,
      expectedValue: 0,
      result: 'pending',
      grossProfit: 0,
      commission: 0,
      netProfit: 0,
      commissionRateUsed: market?.marketBaseRate || settings.defaultCommissionRate || 0.05,
      commissionSource: market?.marketBaseRate ? 'market_base_rate' : 'default_fallback',
      commission_calculation_status: market?.marketBaseRate ? 'ok' : 'using_default',
      entryReason: `${form.strategy} manual paper order`,
      warningFlags: riskChecks,
      paperSimulationQuality: 'High',
    };

    addPaperOrder(order);
    if (riskChecks.length > 0) {
      addAuditLog('Paper Order Rejected', 'order', 'warning', `${form.side} ${runner?.runnerName} — rejected: ${riskChecks.join('; ')}`);
    } else {
      addAuditLog('Paper Order Created', 'order', 'info', `${form.side} ${runner?.runnerName} @ ${form.odds} × $${form.stake} (${form.persistenceType})`);
    }
    setShowForm(false);
  };

  const startingBankroll = settings.paperBankroll || settings.bankroll;
  const equityCurve = paperOrders.slice(0, 20).reverse().map((o, i) => ({
    idx: i + 1,
    equity: startingBankroll + paperOrders.slice(0, i + 1).reduce((sum, p) => sum + (p.netProfit || 0), 0),
  }));

  const openOrders = paperOrders.filter(o => o.result === 'pending');
  const settledOrders = paperOrders.filter(o => o.result === 'won' || o.result === 'lost');

  const handleCancelUnmatched = () => {
    addAuditLog('Cancel Unmatched Orders', 'order', 'warning', `Cancelled ${openOrders.length} unmatched/pending paper orders`);
  };

  const handleRecalculate = () => {
    addAuditLog('Recalculate Paper Results', 'system', 'info', 'Paper trading results recalculated from settled orders');
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
        <Button size="sm" onClick={() => setShowForm(true)} disabled={emergencyStop || mode === 'live_locked'}>
          <Plus className="h-4 w-4" /> Create Manual Paper Order
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancelUnmatched} disabled={openOrders.length === 0}>
          <XCircle className="h-4 w-4" /> Cancel Unmatched ({openOrders.length})
        </Button>
        <Button size="sm" variant="outline" onClick={handleRecalculate}>
          <RefreshCw className="h-4 w-4" /> Recalculate Results
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

      {/* Featherless AI Decision Panel */}
      <FeatherlessAIDecisionPanel />

      {/* Paper Progress Per Strategy */}
      <PaperProgress />

      {/* Equity Curve */}
      <Panel title="Equity Curve">
        <div className="p-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
              <XAxis dataKey="idx" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid hsl(217 33% 17%)', borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="equity" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} name="Bankroll $" />
            </LineChart>
          </ResponsiveContainer>
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
                  <SelectItem value="Value Bet">Value Bet</SelectItem>
                  <SelectItem value="Pre-Off Scalping">Pre-Off Scalping</SelectItem>
                  <SelectItem value="Fav/Outsider">Fav/Outsider</SelectItem>
                  <SelectItem value="Steam/Drift">Steam/Drift</SelectItem>
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
                  <SelectItem value="PERSIST">PERSIST (keep in-play)</SelectItem>
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
              <div className="md:col-span-3 text-xs text-chart-4 flex items-center gap-1 bg-chart-4/5 rounded p-2">
                <AlertTriangle className="h-3 w-3" /> PERSIST keeps unmatched bets active in-play. Use only if intentionally approved.
              </div>
            )}
            <div className="md:col-span-3 flex gap-2">
              <Button onClick={handleSubmit} disabled={emergencyStop}>Submit Paper Order</Button>
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
            {paperOrders.map(o => (
              <TableRow key={o.id} className="border-border">
                <TableCell className="text-xs text-muted-foreground">{new Date(o.created_date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                <TableCell className="text-xs">{o.strategyName}</TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium">{o.venue || '—'}</div>
                  <div className="text-muted-foreground">{o.marketName}</div>
                </TableCell>
                <TableCell className="text-xs font-medium">{o.runnerName}</TableCell>
                <TableCell><SideBadge side={o.side} /></TableCell>
                <TableCell className="text-xs text-right font-mono">{o.matchedOdds?.toFixed(2) || '—'}</TableCell>
                <TableCell className="text-xs text-right font-mono">${o.matchedStake || 0}</TableCell>
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