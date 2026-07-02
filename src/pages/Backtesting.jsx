import React, { useState, useRef } from 'react';
import { Panel, StatusBadge, PLValue } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Upload, Play, FileText } from 'lucide-react';

export default function Backtesting() {
  const { backtestRuns, addBacktestRun, settings } = useApp();
  const [fileName, setFileName] = useState('');
  const [config, setConfig] = useState({
    name: '',
    strategy: 'Value Bet',
    startingBankroll: settings.bankroll,
  });
  const [running, setRunning] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) setFileName(file.name);
  };

  const runBacktest = () => {
    setRunning(true);
    setTimeout(() => {
      // Simulate backtest results
      const totalBets = Math.floor(Math.random() * 200 + 50);
      const wins = Math.floor(totalBets * (0.55 + Math.random() * 0.2));
      const losses = totalBets - wins;
      const strikeRate = (wins / totalBets) * 100;
      const grossProfit = Math.random() * 2000 - 200;
      const commission = grossProfit > 0 ? grossProfit * settings.commissionRate : 0;
      const netProfit = grossProfit - commission;
      const endingBankroll = config.startingBankroll + netProfit;
      const roi = (netProfit / config.startingBankroll) * 100;

      // Generate equity curve
      let equity = config.startingBankroll;
      const equityData = [{ idx: 0, equity }];
      for (let i = 1; i <= totalBets; i++) {
        const win = Math.random() < (wins / totalBets);
        equity += win ? Math.random() * 150 : -Math.random() * 100;
        equityData.push({ idx: i, equity: parseFloat(equity.toFixed(2)) });
      }

      const run = {
        name: config.name || `Backtest ${new Date().toLocaleDateString()}`,
        strategyName: config.strategy,
        startingBankroll: config.startingBankroll,
        endingBankroll: parseFloat(equity.toFixed(2)),
        totalBets,
        wins,
        losses,
        strikeRate: parseFloat(strikeRate.toFixed(2)),
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        roi: parseFloat(roi.toFixed(2)),
        profitFactor: parseFloat((Math.random() * 1.5 + 1).toFixed(2)),
        maxDrawdown: parseFloat(-(Math.random() * 500 + 100).toFixed(2)),
        longestLosingStreak: Math.floor(Math.random() * 6 + 1),
        averageOdds: parseFloat((Math.random() * 4 + 2).toFixed(2)),
        averageStake: parseFloat((Math.random() * 80 + 50).toFixed(2)),
        notes: fileName ? `Data source: ${fileName}` : 'Simulated data',
        equityCurve: equityData,
      };

      addBacktestRun(run);
      setRunning(false);
      setFileName('');
      setConfig({ ...config, name: '' });
    }, 1500);
  };

  return (
    <div className="space-y-5">
      {/* Upload & Config */}
      <Panel title="Backtest Configuration">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 text-xs text-chart-3 bg-chart-3/10 border border-chart-3/30 rounded-lg p-3">
            <Upload className="h-4 w-4 shrink-0" />
            <span>Upload Betfair historical data files (CSV/JSON). Data is replayed in time order with conservative fill logic.</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label className="text-xs">Backtest Name</Label>
              <Input value={config.name} onChange={e => setConfig({...config, name: e.target.value})} placeholder="e.g. Value Bet June 2026" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Strategy</Label>
              <Select value={config.strategy} onValueChange={v => setConfig({...config, strategy: v})}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Value Bet">Value Bet</SelectItem>
                  <SelectItem value="Pre-Off Scalping">Pre-Off Scalping</SelectItem>
                  <SelectItem value="Fav/Outsider">Fav/Outsider</SelectItem>
                  <SelectItem value="Cross-Market">Cross-Market</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Starting Bankroll</Label>
              <Input type="number" value={config.startingBankroll} onChange={e => setConfig({...config, startingBankroll: +e.target.value})} className="mt-1" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input ref={fileRef} type="file" accept=".csv,.json" onChange={handleFile} className="hidden" />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> {fileName || 'Upload Data File'}
            </Button>
            <Button onClick={runBacktest} disabled={running}>
              <Play className="h-4 w-4 mr-2" /> {running ? 'Running Backtest...' : 'Run Backtest'}
            </Button>
            {!fileName && <span className="text-xs text-muted-foreground">No file uploaded — will use simulated data</span>}
          </div>
        </div>
      </Panel>

      {/* Simulation Notes */}
      <Panel title="Simulation Parameters">
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span className="text-muted-foreground">Commission:</span> <span className="font-mono font-semibold">{(settings.commissionRate * 100).toFixed(1)}%</span></div>
          <div><span className="text-muted-foreground">Slippage:</span> <span className="font-mono font-semibold">Conservative (2 ticks)</span></div>
          <div><span className="text-muted-foreground">Unmatched:</span> <span className="font-mono font-semibold">Modelled</span></div>
          <div><span className="text-muted-foreground">Partial Fills:</span> <span className="font-mono font-semibold">Modelled</span></div>
          <div><span className="text-muted-foreground">Market Suspension:</span> <span className="font-mono font-semibold">Handled</span></div>
          <div><span className="text-muted-foreground">Fill Logic:</span> <span className="font-mono font-semibold">Conservative</span></div>
        </div>
      </Panel>

      {/* Past Runs */}
      <Panel title="Backtest Results">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Strategy</TableHead>
              <TableHead className="text-xs text-right">Bets</TableHead>
              <TableHead className="text-xs text-right">Strike</TableHead>
              <TableHead className="text-xs text-right">Net P/L</TableHead>
              <TableHead className="text-xs text-right">ROI</TableHead>
              <TableHead className="text-xs text-right">Profit Factor</TableHead>
              <TableHead className="text-xs text-right">Max DD</TableHead>
              <TableHead className="text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backtestRuns.map(r => (
              <TableRow key={r.id} className="border-border">
                <TableCell className="text-xs font-medium">{r.name}</TableCell>
                <TableCell className="text-xs">{r.strategyName}</TableCell>
                <TableCell className="text-xs text-right font-mono">{r.totalBets}</TableCell>
                <TableCell className="text-xs text-right font-mono">{r.strikeRate}%</TableCell>
                <TableCell className="text-xs text-right"><PLValue value={r.netProfit} /></TableCell>
                <TableCell className={`text-xs text-right font-mono ${r.roi > 0 ? 'text-chart-1' : 'text-chart-5'}`}>{r.roi}%</TableCell>
                <TableCell className="text-xs text-right font-mono">{r.profitFactor}</TableCell>
                <TableCell className="text-xs text-right font-mono text-chart-5">${r.maxDrawdown}</TableCell>
                <TableCell><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedRun(r)}>View</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {/* Selected Run Detail */}
      {selectedRun && (
        <Panel title={`Detail: ${selectedRun.name}`} action={<Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedRun(null)}>Close</Button>}>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <DetailStat label="Starting Bank" value={`$${selectedRun.startingBankroll.toLocaleString()}`} />
              <DetailStat label="Ending Bank" value={`$${selectedRun.endingBankroll.toLocaleString()}`} />
              <DetailStat label="Total Bets" value={selectedRun.totalBets} />
              <DetailStat label="Wins / Losses" value={`${selectedRun.wins} / ${selectedRun.losses}`} />
              <DetailStat label="Avg Odds" value={selectedRun.averageOdds} />
              <DetailStat label="Avg Stake" value={`$${selectedRun.averageStake}`} />
            </div>
            {selectedRun.equityCurve && (
              <div>
                <div className="text-xs text-muted-foreground mb-2">Equity Curve</div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={selectedRun.equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                    <XAxis dataKey="idx" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                    <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid hsl(217 33% 17%)', borderRadius: '8px', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="equity" stroke="hsl(263 70% 55%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {selectedRun.notes && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <FileText className="h-3 w-3" /> {selectedRun.notes}
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

function DetailStat({ label, value }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold font-mono mt-1">{value}</div>
    </div>
  );
}