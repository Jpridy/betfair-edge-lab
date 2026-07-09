import React, { useState } from 'react';
import { Panel, PLValue } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { runBacktest, AVAILABLE_STRATEGIES } from '@/lib/backtestEngine';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Play, Loader2, AlertTriangle, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Backtesting() {
  const { settings, addBacktestRun, backtestRuns } = useApp();
  const [selectedStrategies, setSelectedStrategies] = useState(['Featherless AI Value Decision Engine']);
  const [numRaces, setNumRaces] = useState(100);
  const [startingBankroll, setStartingBankroll] = useState(settings.bankroll);
  const [daysBack, setDaysBack] = useState(90);
  const [runName, setRunName] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [stakeType, setStakeType] = useState('flat');
  const [commissionRate, setCommissionRate] = useState(settings.commissionRate * 100);
  const [minOddsRange, setMinOddsRange] = useState(settings.minOdds);
  const [maxOddsRange, setMaxOddsRange] = useState(settings.maxOdds);
  const [marketType, setMarketType] = useState('all');
  const [minLiquidity, setMinLiquidity] = useState(settings.minimumLiquidity);
  const [timeWindow, setTimeWindow] = useState('5min-30sec');

  const toggleStrategy = (name) => {
    setSelectedStrategies(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const handleRun = () => {
    if (selectedStrategies.length === 0) return;
    setRunning(true);
    setProgress(0);
    setResult(null);

    // Simulate progress before running
    let p = 0;
    const progressTimer = setInterval(() => {
      p = Math.min(p + Math.random() * 15, 90);
      setProgress(p);
    }, 100);

    setTimeout(() => {
      const res = runBacktest({
        strategies: selectedStrategies,
        numRaces,
        startingBankroll,
        settings,
        daysBack,
        commissionRate,
        stakeType,
        minOddsRange,
        maxOddsRange,
        marketType,
        minLiquidity,
        timeWindow,
      });

      clearInterval(progressTimer);
      setProgress(100);

      const run = {
        name: runName || `${selectedStrategies.join(', ')} — ${numRaces} races`,
        strategyName: selectedStrategies.join(', '),
        startingBankroll,
        endingBankroll: res.endingBankroll,
        totalBets: res.totalBets,
        wins: res.wins,
        losses: res.losses,
        strikeRate: res.strikeRate,
        grossProfit: res.grossProfit,
        netProfit: res.netProfit,
        roi: res.roi,
        profitFactor: res.profitFactor,
        maxDrawdown: res.maxDrawdown,
        longestLosingStreak: res.longestLosingStreak,
        averageOdds: res.averageOdds,
        averageStake: res.averageStake,
        notes: `${res.signalsGenerated} signals · ${res.ordersPlaced} placed · ${res.ordersBlocked} blocked · ${numRaces} races over ${daysBack} days`,
        equityCurve: res.equityCurve,
      };
      addBacktestRun(run);
      setResult(res);
      setRunning(false);
    }, 800);
  };

  return (
    <div className="space-y-5">
      {/* Configuration */}
      <Panel title="Synthetic Backtest Configuration">
        <div className="p-4 space-y-4">
          <div className="bg-info/10 border border-info/30 rounded-lg p-3 text-xs text-muted-foreground">
            <span className="text-info font-medium">How it works:</span> Select your active strategies, choose how many synthetic races to simulate, and the engine will generate probability-weighted synthetic race samples — generating signals, running risk checks, placing simulated orders, and settling them using probability-weighted synthetic settlement. Results include equity curve, drawdown, profit factor, and CLV.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Backtest Name</Label>
              <Input value={runName} onChange={e => setRunName(e.target.value)} placeholder="e.g. Value Bet — 100 races" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Number of Races</Label>
              <Input type="number" value={numRaces} onChange={e => setNumRaces(Math.max(10, +e.target.value))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Starting Bankroll</Label>
              <Input type="number" value={startingBankroll} onChange={e => setStartingBankroll(+e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Stake Type</Label>
              <Select value={stakeType} onValueChange={setStakeType}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat ($ per bet)</SelectItem>
                  <SelectItem value="percentage">Percentage of bankroll</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Commission Rate (%)</Label>
              <Input type="number" step="0.1" value={commissionRate} onChange={e => setCommissionRate(+e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Market Type</Label>
              <Select value={marketType} onValueChange={setMarketType}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="WIN">Win</SelectItem>
                  <SelectItem value="PLACE">Place</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Min Odds</Label>
              <Input type="number" step="0.1" value={minOddsRange} onChange={e => setMinOddsRange(+e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Max Odds</Label>
              <Input type="number" step="0.1" value={maxOddsRange} onChange={e => setMaxOddsRange(+e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Min Liquidity ($)</Label>
              <Input type="number" value={minLiquidity} onChange={e => setMinLiquidity(+e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Time Before Start Window</Label>
              <Select value={timeWindow} onValueChange={setTimeWindow}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10min-30sec">10min – 30sec</SelectItem>
                  <SelectItem value="5min-30sec">5min – 30sec</SelectItem>
                  <SelectItem value="3min-30sec">3min – 30sec</SelectItem>
                  <SelectItem value="any">Any time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <span className="text-warning font-medium">Warning:</span> Backtest results are synthetic. Strategy must still pass paper trading validation (200+ settled trades, positive CLV, profit factor &gt; 1.20). No real bets are placed.
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Select Strategies to Backtest</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_STRATEGIES.map(name => (
                <button
                  key={name}
                  onClick={() => toggleStrategy(name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedStrategies.includes(name)
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-muted/30 text-muted-foreground border-border hover:border-primary/30'
                  }`}
                >
                  {selectedStrategies.includes(name) ? '✓ ' : ''}{name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-xs">Synthetic Sample Period: {daysBack} days</Label>
              <input
                type="range"
                min={30}
                max={365}
                step={15}
                value={daysBack}
                onChange={e => setDaysBack(+e.target.value)}
                className="w-full mt-2 accent-primary"
              />
            </div>
            <Button onClick={handleRun} disabled={running || selectedStrategies.length === 0} className="h-10 px-6">
              {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Running...</> : <><Play className="h-4 w-4" /> Run Backtest</>}
            </Button>
          </div>

          {running && (
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </Panel>

      {/* Simulation Parameters */}
      <Panel title="Simulation Parameters">
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <Param label="Commission" value={`${commissionRate.toFixed(1)}%`} />
          <Param label="Stake Type" value={stakeType === 'flat' ? 'Flat' : 'Percentage'} />
          <Param label="Settlement" value="Synthetic" />
          <Param label="Risk Checks" value="Your settings" />
          <Param label="Min Liquidity" value={`$${minLiquidity.toLocaleString()}`} />
          <Param label="Min Odds" value={minOddsRange.toFixed(2)} />
          <Param label="Max Odds" value={maxOddsRange.toFixed(2)} />
          <Param label="Market Type" value={marketType === 'all' ? 'All' : marketType} />
          <Param label="Time Window" value={timeWindow} />
          <Param label="Max Stake" value={`$${settings.maxStake}`} />
        </div>
      </Panel>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <ResultCard label="Net P/L" value={`${result.netProfit >= 0 ? '+' : ''}$${result.netProfit.toFixed(2)}`} positive={result.netProfit >= 0} />
            <ResultCard label="ROI" value={`${result.roi.toFixed(2)}%`} positive={result.roi >= 0} />
            <ResultCard label="Ending Bank" value={`$${result.endingBankroll.toLocaleString()}`} />
            <ResultCard label="Strike Rate" value={`${result.strikeRate.toFixed(1)}%`} />
            <ResultCard label="Profit Factor" value={result.profitFactor.toFixed(2)} positive={result.profitFactor >= 1} />
            <ResultCard label="Max Drawdown" value={`$${result.maxDrawdown.toFixed(0)}`} positive={false} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <ResultCard label="Signals" value={result.signalsGenerated} />
            <ResultCard label="Orders Placed" value={result.ordersPlaced} />
            <ResultCard label="Blocked" value={result.ordersBlocked} />
            <ResultCard label="Avg Edge" value={`${result.averageEdge.toFixed(2)}%`} positive={result.averageEdge > 0} />
            <ResultCard label="Avg CLV" value={`${result.closingLineValue.toFixed(2)}%`} positive={result.closingLineValue > 0} />
            <ResultCard label="Losing Streak" value={result.longestLosingStreak} />
          </div>

          {/* Equity Curve */}
          <Panel title="Equity Curve">
            <div className="p-4">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={result.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                  <XAxis dataKey="idx" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} label={{ value: 'Trade #', position: 'insideBottom', offset: -5, fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid hsl(217 33% 17%)', borderRadius: '8px', fontSize: '12px' }} formatter={v => [`$${v.toFixed(2)}`, 'Bankroll']} />
                  <ReferenceLine y={startingBankroll} stroke="hsl(215 20% 55%)" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="equity" stroke="hsl(263 70% 55%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Trade Log */}
          <Panel title={`Trade Log — ${result.trades.length} Trades`} action={
            <Badge variant="outline" className="text-xs">
              {result.wins}W / {result.losses}L
            </Badge>
          }>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Strategy</TableHead>
                    <TableHead className="text-xs">Runner</TableHead>
                    <TableHead className="text-xs">Side</TableHead>
                    <TableHead className="text-xs text-right">Odds</TableHead>
                    <TableHead className="text-xs text-right">Stake</TableHead>
                    <TableHead className="text-xs text-right">Edge</TableHead>
                    <TableHead className="text-xs text-right">CLV</TableHead>
                    <TableHead className="text-xs">Result</TableHead>
                    <TableHead className="text-xs text-right">Net P/L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.trades.slice(0, 50).map((t, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                      <TableCell className="text-xs">{t.strategy}</TableCell>
                      <TableCell className="text-xs font-medium">{t.runner}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.side === 'BACK' ? 'bg-info/10 text-info' : 'bg-danger/10 text-danger'}`}>{t.side}</span>
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">{t.odds.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">${t.stake}</TableCell>
                      <TableCell className="text-xs text-right font-mono text-success">{t.edge.toFixed(2)}%</TableCell>
                      <TableCell className={`text-xs text-right font-mono ${t.clv >= 0 ? 'text-success' : 'text-danger'}`}>{t.clv >= 0 ? '+' : ''}{t.clv.toFixed(2)}%</TableCell>
                      <TableCell>
                        {t.result === 'won'
                          ? <span className="text-[10px] font-bold text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Won</span>
                          : <span className="text-[10px] font-bold text-danger flex items-center gap-1"><XCircle className="h-3 w-3" /> Lost</span>}
                      </TableCell>
                      <TableCell className="text-xs text-right"><PLValue value={t.netProfit} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {result.trades.length > 50 && (
              <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
                Showing first 50 of {result.trades.length} trades
              </div>
            )}
          </Panel>

          {/* Blocked Trades */}
          {result.blockedTrades.length > 0 && (
            <Panel title={`Blocked Trades — ${result.blockedTrades.length}`} action={<AlertTriangle className="h-4 w-4 text-warning" />}>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs">Strategy</TableHead>
                    <TableHead className="text-xs">Runner</TableHead>
                    <TableHead className="text-xs text-right">Odds</TableHead>
                    <TableHead className="text-xs text-right">Stake</TableHead>
                    <TableHead className="text-xs">Block Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.blockedTrades.slice(0, 20).map((t, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="text-xs">{t.strategy}</TableCell>
                      <TableCell className="text-xs font-medium">{t.runner}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{t.odds.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">${t.stake}</TableCell>
                      <TableCell className="text-xs text-danger">{t.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          )}
        </>
      )}

      {/* Past Runs */}
      {backtestRuns.length > 0 && !result && (
        <Panel title="Past Backtest Runs">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Strategy</TableHead>
                <TableHead className="text-xs text-right">Bets</TableHead>
                <TableHead className="text-xs text-right">Strike</TableHead>
                <TableHead className="text-xs text-right">Net P/L</TableHead>
                <TableHead className="text-xs text-right">ROI</TableHead>
                <TableHead className="text-xs text-right">PF</TableHead>
                <TableHead className="text-xs text-right">Max DD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backtestRuns.slice(0, 10).map(r => (
                <TableRow key={r.id} className="border-border">
                  <TableCell className="text-xs font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs">{r.strategyName}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{r.totalBets}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{r.strikeRate}%</TableCell>
                  <TableCell className="text-xs text-right"><PLValue value={r.netProfit} /></TableCell>
                  <TableCell className={`text-xs text-right font-mono ${r.roi > 0 ? 'text-success' : 'text-danger'}`}>{r.roi}%</TableCell>
                  <TableCell className="text-xs text-right font-mono">{r.profitFactor}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-danger">${r.maxDrawdown}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

function Param({ label, value }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

function ResultCard({ label, value, positive }) {
  const color = positive === true ? 'text-success' : positive === false ? 'text-danger' : 'text-foreground';
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}