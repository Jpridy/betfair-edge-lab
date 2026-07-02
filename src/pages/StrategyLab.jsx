import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

export default function StrategyLab() {
  return (
    <Tabs defaultValue="value" className="w-full">
      <TabsList className="bg-card border border-border">
        <TabsTrigger value="value" className="text-xs data-[state=active]:bg-primary/20">Value Betting</TabsTrigger>
        <TabsTrigger value="scalping" className="text-xs data-[state=active]:bg-primary/20">Pre-Off Scalping</TabsTrigger>
        <TabsTrigger value="favout" className="text-xs data-[state=active]:bg-primary/20">Fav/Outsider</TabsTrigger>
        <TabsTrigger value="cross" className="text-xs data-[state=active]:bg-primary/20">Cross-Market</TabsTrigger>
      </TabsList>
      <TabsContent value="value"><ValueBetStrategy /></TabsContent>
      <TabsContent value="scalping"><ScalpingStrategy /></TabsContent>
      <TabsContent value="favout"><FavOutsiderStrategy /></TabsContent>
      <TabsContent value="cross"><CrossMarketStrategy /></TabsContent>
    </Tabs>
  );
}

function ValueBetStrategy() {
  const { settings, addStrategySignal } = useApp();
  const [modelProb, setModelProb] = useState(0.35);
  const [odds, setOdds] = useState(3.40);
  const [stake, setStake] = useState(100);

  const commission = settings.commissionRate;
  const impliedProb = 1 / odds;
  const fairOdds = 1 / modelProb;
  const evBack = modelProb * (odds - 1) * (1 - commission) - (1 - modelProb);
  const edgePercent = ((modelProb - impliedProb) * 100);
  const edgePerUnit = evBack / stake;
  const signal = edgePercent > 0 && evBack > 0 ? 'PASS' : 'BLOCK';

  const handleGenerate = () => {
    addStrategySignal({
      strategyName: 'Value Bet',
      marketId: 'dm1',
      runnerId: 'demo',
      side: 'BACK',
      odds,
      stakeSuggestion: stake,
      modelProbability: modelProb,
      impliedProbability: impliedProb,
      fairOdds,
      edgePercent,
      expectedValue: evBack,
      confidence: Math.min(edgePercent / 10, 1),
      signalStatus: signal === 'PASS' ? 'active' : 'blocked',
      reason: `Edge ${edgePercent.toFixed(2)}%, EV $${evBack.toFixed(2)}`,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Panel title="Value Bet Calculator — Inputs">
        <div className="p-4 space-y-4">
          <div>
            <Label className="text-xs">Model Probability (0-1)</Label>
            <Input type="number" step="0.01" min="0" max="1" value={modelProb} onChange={e => setModelProb(+e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Available Odds</Label>
            <Input type="number" step="0.01" value={odds} onChange={e => setOdds(+e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Stake ($)</Label>
            <Input type="number" value={stake} onChange={e => setStake(+e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Commission Rate</Label>
            <div className="mt-1 text-sm font-mono text-muted-foreground">{(commission * 100).toFixed(1)}% (set in Settings)</div>
          </div>
          <Button onClick={handleGenerate} className="w-full" disabled={signal === 'BLOCK'}>
            Generate Signal
          </Button>
        </div>
      </Panel>

      <Panel title="Calculations & Signal">
        <div className="p-4 space-y-3">
          <CalcRow label="Fair Odds" value={fairOdds.toFixed(2)} />
          <CalcRow label="Available Odds" value={odds.toFixed(2)} />
          <CalcRow label="Implied Probability" value={`${(impliedProb * 100).toFixed(2)}%`} />
          <CalcRow label="Model Probability" value={`${(modelProb * 100).toFixed(2)}%`} />
          <CalcRow label="Edge %" value={`${edgePercent.toFixed(2)}%`} positive={edgePercent > 0} />
          <CalcRow label="Expected Value (EV)" value={`$${evBack.toFixed(2)}`} positive={evBack > 0} />
          <CalcRow label="EV per $1 staked" value={`$${edgePerUnit.toFixed(4)}`} positive={edgePerUnit > 0} />
          <CalcRow label="Stake Suggestion" value={`$${stake.toFixed(2)}`} />
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm font-bold">Signal</span>
            {signal === 'PASS'
              ? <StatusBadge status="ok"><CheckCircle2 className="h-3 w-3 mr-1 inline" />PASS</StatusBadge>
              : <StatusBadge status="danger"><XCircle className="h-3 w-3 mr-1 inline" />BLOCK</StatusBadge>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function CalcRow({ label, value, positive }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono font-semibold ${positive === true ? 'text-chart-1' : positive === false ? 'text-chart-5' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function ScalpingStrategy() {
  const { settings } = useApp();
  const [config, setConfig] = useState({
    targetProfitTicks: 5,
    stopLossTicks: 3,
    cancelAfterSeconds: 30,
    exitBeforeStartSeconds: 60,
    maxSpread: 0.2,
    minLiquidity: 5000,
    maxVolatility: 0.1,
    timeWindowStart: settings.defaultTimeWindowStartSeconds,
    timeWindowEnd: settings.defaultTimeWindowEndSeconds,
  });

  const checks = [
    { label: 'Market Open', passed: true },
    { label: 'Not In-Play', passed: true },
    { label: `Spread ≤ ${config.maxSpread}`, passed: true },
    { label: `Liquidity ≥ £${config.minLiquidity}`, passed: true },
    { label: `Volatility ≤ ${config.maxVolatility}`, passed: true },
    { label: `Time in window (${config.timeWindowEnd}s–${config.timeWindowStart}s pre-start)`, passed: true },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Panel title="Pre-Off Scalping Configuration">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Target Profit (ticks)</Label>
              <Input type="number" value={config.targetProfitTicks} onChange={e => setConfig({...config, targetProfitTicks: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Stop Loss (ticks)</Label>
              <Input type="number" value={config.stopLossTicks} onChange={e => setConfig({...config, stopLossTicks: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Cancel After (sec)</Label>
              <Input type="number" value={config.cancelAfterSeconds} onChange={e => setConfig({...config, cancelAfterSeconds: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Exit Before Start (sec)</Label>
              <Input type="number" value={config.exitBeforeStartSeconds} onChange={e => setConfig({...config, exitBeforeStartSeconds: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Max Spread</Label>
              <Input type="number" step="0.1" value={config.maxSpread} onChange={e => setConfig({...config, maxSpread: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Min Liquidity (£)</Label>
              <Input type="number" value={config.minLiquidity} onChange={e => setConfig({...config, minLiquidity: +e.target.value})} className="mt-1" />
            </div>
          </div>
          <Button className="w-full">Run Scalp Scan (Paper Mode)</Button>
        </div>
      </Panel>

      <Panel title="Entry Checks">
        <div className="p-4 space-y-2.5">
          {checks.map(c => (
            <div key={c.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{c.label}</span>
              {c.passed ? <CheckCircle2 className="h-4 w-4 text-chart-1" /> : <XCircle className="h-4 w-4 text-chart-5" />}
            </div>
          ))}
          <div className="pt-3 border-t border-border">
            <div className="text-xs text-muted-foreground mb-2">Exit Rules:</div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <div>• Take profit at +{config.targetProfitTicks} ticks</div>
              <div>• Stop loss at -{config.stopLossTicks} ticks</div>
              <div>• Cancel unmatched after {config.cancelAfterSeconds}s</div>
              <div>• Exit {config.exitBeforeStartSeconds}s before scheduled start</div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function FavOutsiderStrategy() {
  const { settings } = useApp();
  const [config, setConfig] = useState({
    target: 'both',
    minOdds: settings.minOdds,
    maxOdds: settings.maxOdds,
    overroundThreshold: 5,
    timeBeforeStart: 300,
    minLiquidity: settings.minimumLiquidity,
    favRollingROI: 3.5,
    outsiderRollingROI: -1.2,
  });

  const favDisabled = config.favRollingROI < -2;
  const outsiderDisabled = config.outsiderRollingROI < -2;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Panel title="Favourite/Outsider Configuration">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Target Side</Label>
              <select value={config.target} onChange={e => setConfig({...config, target: e.target.value})} className="w-full h-9 mt-1 bg-background border border-input rounded-md text-xs px-3">
                <option value="favourite">Favourite Only</option>
                <option value="outsider">Outsider Only</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Overround Threshold (%)</Label>
              <Input type="number" value={config.overroundThreshold} onChange={e => setConfig({...config, overroundThreshold: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Min Odds</Label>
              <Input type="number" step="0.1" value={config.minOdds} onChange={e => setConfig({...config, minOdds: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Max Odds</Label>
              <Input type="number" step="0.1" value={config.maxOdds} onChange={e => setConfig({...config, maxOdds: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Time Before Start (sec)</Label>
              <Input type="number" value={config.timeBeforeStart} onChange={e => setConfig({...config, timeBeforeStart: +e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Min Liquidity (£)</Label>
              <Input type="number" value={config.minLiquidity} onChange={e => setConfig({...config, minLiquidity: +e.target.value})} className="mt-1" />
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Rolling ROI Guards">
        <div className="p-4 space-y-4">
          <div className={`p-3 rounded-lg border ${favDisabled ? 'bg-chart-5/10 border-chart-5/30' : 'bg-chart-1/10 border-chart-1/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Favourite Rolling ROI</span>
              <span className={`font-mono font-bold ${favDisabled ? 'text-chart-5' : 'text-chart-1'}`}>{config.favRollingROI.toFixed(2)}%</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{favDisabled ? '⚠ DISABLED — ROI below -2% threshold' : '✓ Active'}</div>
            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setConfig({...config, favRollingROI: 0})}>
              <RefreshCw className="h-3 w-3 mr-1" /> Reset
            </Button>
          </div>
          <div className={`p-3 rounded-lg border ${outsiderDisabled ? 'bg-chart-5/10 border-chart-5/30' : 'bg-chart-1/10 border-chart-1/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Outsider Rolling ROI</span>
              <span className={`font-mono font-bold ${outsiderDisabled ? 'text-chart-5' : 'text-chart-1'}`}>{config.outsiderRollingROI.toFixed(2)}%</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{outsiderDisabled ? '⚠ DISABLED — ROI below -2% threshold' : '✓ Active'}</div>
            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setConfig({...config, outsiderRollingROI: 0})}>
              <RefreshCw className="h-3 w-3 mr-1" /> Reset
            </Button>
          </div>
          <div className="pt-2 border-t border-border text-xs text-muted-foreground">
            Markets targeted: exactly 2-runner markets only. Auto-disable triggers at -2% rolling ROI.
          </div>
        </div>
      </Panel>
    </div>
  );
}

function CrossMarketStrategy() {
  const { settings } = useApp();
  const [externalOdds, setExternalOdds] = useState([
    { id: '1', bookmaker: 'Sportsbet', market: 'Flemington R6', runner: 'Thunder Strike', odds: 3.60, betfairBack: 3.40, betfairLay: 3.45 },
    { id: '2', bookmaker: 'TAB', market: 'Flemington R6', runner: 'Storm Chaser', odds: 5.00, betfairBack: 4.80, betfairLay: 4.90 },
  ]);

  const commission = settings.commissionRate;

  const calculateArb = (ext, betfairLay) => {
    const backReturn = ext.odds;
    const layCost = betfairLay;
    const arbMargin = (1 / backReturn + 1 / layCost) * 100 - 100;
    return { arbMargin, profitable: arbMargin < 0 };
  };

  const hedgeStake = (ext, betfairLay) => {
    return (ext.odds / betfairLay) * 100;
  };

  return (
    <div className="space-y-5">
      <Panel title="Cross-Market Watcher — External Odds Entry">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4 text-xs text-chart-4 bg-chart-4/10 border border-chart-4/30 rounded-lg p-3">
            <Upload className="h-4 w-4 shrink-0" />
            <span>Manual entry or CSV upload only. Do NOT scrape bookmaker sites. No bookmaker bets are placed.</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs">Bookmaker</TableHead>
                  <TableHead className="text-xs">Market</TableHead>
                  <TableHead className="text-xs">Runner</TableHead>
                  <TableHead className="text-xs text-right">Ext Odds</TableHead>
                  <TableHead className="text-xs text-right">BF Back</TableHead>
                  <TableHead className="text-xs text-right">BF Lay</TableHead>
                  <TableHead className="text-xs text-right">Arb Margin</TableHead>
                  <TableHead className="text-xs text-right">Hedge Stake</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {externalOdds.map(row => {
                  const calc = calculateArb(row, row.betfairLay);
                  const hedge = hedgeStake(row, row.betfairLay);
                  return (
                    <TableRow key={row.id} className="border-border">
                      <TableCell className="text-xs">{row.bookmaker}</TableCell>
                      <TableCell className="text-xs">{row.market}</TableCell>
                      <TableCell className="text-xs">{row.runner}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{row.odds.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-right font-mono text-chart-3">{row.betfairBack.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-right font-mono text-chart-5">{row.betfairLay.toFixed(2)}</TableCell>
                      <TableCell className={`text-xs text-right font-mono ${calc.profitable ? 'text-chart-1' : 'text-muted-foreground'}`}>
                        {calc.arbMargin.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">${hedge.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Commission: {(commission * 100).toFixed(1)}% — Arb margins shown after commission on Betfair side. Negative margin = profitable arbitrage opportunity.
          </div>
        </div>
      </Panel>
    </div>
  );
}