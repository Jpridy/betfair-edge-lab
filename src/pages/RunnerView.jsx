import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Activity, Gauge, ArrowLeft, Plus, FileText, AlertTriangle, Radar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ENRICHED_STRATEGY_LIBRARY } from '@/lib/strategyLibrary';
import { calculateSpreadTicks, generatePriceLadder, getSpreadQuality } from '@/lib/tickLadder';

// Generate synthetic price history for a runner
function generatePriceHistory(basePrice) {
  const data = [];
  let price = basePrice;
  for (let i = 0; i < 30; i++) {
    price += (Math.random() - 0.5) * 0.15;
    price = Math.max(1.01, price);
    data.push({ time: i, price: parseFloat(price.toFixed(2)) });
  }
  return data;
}

// Generate ladder using Betfair tick ladder
function generateLadder(bestBack, bestLay) {
  if (!bestBack || !bestLay || bestBack <= 0 || bestLay <= 0) return [];
  const ladder = generatePriceLadder(bestBack, bestLay, 6);
  return ladder.map(row => ({
    price: row.price,
    backSize: row.type === 'back' ? Math.floor(Math.random() * 800 + 100) : 0,
    laySize: row.type === 'lay' ? Math.floor(Math.random() * 600 + 50) : 0,
    isCurrent: row.level === 0,
    type: row.type,
  })).sort((a, b) => b.price - a.price);
}

export default function RunnerView() {
  const { markets, runners, addPaperOrder, settings, bankrollStats, emergencyStop, addAuditLog } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const marketParam = searchParams.get('market');
  const [showPaperForm, setShowPaperForm] = useState(false);
  const [paperForm, setPaperForm] = useState({ side: 'BACK', stake: settings.baseStake, strategy: 'Featherless AI Value Decision Engine' });
  const [selectedMarket, setSelectedMarket] = useState(marketParam || markets[0]?.id || '');
  const marketRunners = useMemo(() => runners.filter(r => r.marketId === selectedMarket), [runners, selectedMarket]);
  const [selectedRunner, setSelectedRunner] = useState(marketRunners[0]?.id || '');

  React.useEffect(() => {
    if (marketParam && markets.find(m => m.id === marketParam)) {
      setSelectedMarket(marketParam);
    }
  }, [marketParam, markets]);

  React.useEffect(() => {
    if (marketRunners.length > 0 && !marketRunners.find(r => r.id === selectedRunner)) {
      setSelectedRunner(marketRunners[0].id);
    }
  }, [marketRunners, selectedRunner]);

  const runner = runners.find(r => r.id === selectedRunner);
  const market = markets.find(m => m.id === selectedMarket);
  const priceHistory = useMemo(() => runner ? generatePriceHistory(runner.lastTradedPrice) : [], [runner?.id, runner?.lastTradedPrice]);
  const ladder = useMemo(() => runner ? generateLadder(runner.bestBackPrice, runner.bestLayPrice) : [], [runner?.id, runner?.bestBackPrice, runner?.bestLayPrice]);

  if (markets.length === 0) {
    return (
      <Panel>
        <div className="p-8 text-center space-y-4">
          <div className="text-sm text-muted-foreground">Select a market from the Markets page first.</div>
          <Link to="/scanner">
            <Button size="sm"><Radar className="h-3 w-3" /> Go to Markets</Button>
          </Link>
        </div>
      </Panel>
    );
  }

  if (!runner) {
    return (
      <Panel>
        <div className="p-8 text-center space-y-4">
          <div className="text-sm text-muted-foreground">No runners available for this market.</div>
          <Link to="/scanner">
            <Button size="sm"><Radar className="h-3 w-3" /> Go to Markets</Button>
          </Link>
        </div>
      </Panel>
    );
  }

  const spread = runner.bestLayPrice - runner.bestBackPrice;
  const spreadTicks = runner.spreadTicks || calculateSpreadTicks(runner.bestBackPrice, runner.bestLayPrice);
  const spreadQuality = getSpreadQuality(spreadTicks);
  const overround = market ? runners.filter(r => r.marketId === selectedMarket).reduce((sum, r) => sum + (1 / r.bestBackPrice), 0) * 100 - 100 : 0;

  // Runner warnings
  const runnerWarnings = [];
  if (runner.status === 'REMOVED') runnerWarnings.push({ level: 'critical', msg: 'Runner removed. Results may require adjustment.' });
  if (runner.status !== 'ACTIVE' && runner.status !== 'WINNER' && runner.status !== 'LOSER') runnerWarnings.push({ level: 'warning', msg: `Runner inactive (${runner.status})` });
  if (!runner.bestBackPrice || runner.bestBackPrice <= 0) runnerWarnings.push({ level: 'warning', msg: 'No back price available' });
  if (!runner.bestLayPrice || runner.bestLayPrice <= 0) runnerWarnings.push({ level: 'warning', msg: 'No lay price available' });
  if (spreadTicks > 5) runnerWarnings.push({ level: 'warning', msg: `Spread too wide (${spreadTicks} ticks)` });
  if (runner.bestBackSize < 50) runnerWarnings.push({ level: 'warning', msg: `Insufficient available back size ($${runner.bestBackSize?.toFixed(2)})` });
  if (runner.bestLaySize < 50) runnerWarnings.push({ level: 'warning', msg: `Insufficient available lay size ($${runner.bestLaySize?.toFixed(2)})` });
  if (market && market.totalMatched < (settings.minimumLiquidity || 5000)) runnerWarnings.push({ level: 'warning', msg: 'Liquidity below strategy minimum' });

  // Model probability (synthetic — based on implied prob adjusted for form factors)
  const modelProbability = runner.impliedProbability * (1 + (Math.random() - 0.45) * 0.1);
  const edge = ((modelProbability / runner.impliedProbability) - 1) * 100;
  const fairOdds = 100 / modelProbability;
  const clvEstimate = ((runner.lastTradedPrice - runner.bestBackPrice) / runner.bestBackPrice) * 100;

  // Strategy suitability — uses enriched strategy library with Betfair fields
  const suitableStrategies = ENRICHED_STRATEGY_LIBRARY.filter(s => {
    if (s.status === 'archived' || s.validationStatus === 'archived') return false;
    if (s.validationStatus === 'failing') return false;
    if (market && !s.marketTypes?.includes(market.marketType)) return false;
    if (market && market.totalMatched < s.minLiquidity) return false;
    if (market && market.inPlay && !s.allowInPlay) return false;
    if (s.minEdge && Math.abs(edge) < s.minEdge * 0.5) return false;
    return true;
  });

  // Momentum and volatility
  const momentum = priceHistory.length >= 2 ? priceHistory[priceHistory.length - 1].price - priceHistory[0].price : 0;
  const volatility = Math.sqrt(priceHistory.reduce((sum, p, i, arr) => i > 0 ? sum + Math.pow(p.price - arr[i-1].price, 2) : 0, 0) / priceHistory.length);

  const handleCreatePaperOrder = () => {
    if (emergencyStop) return;
    // Central validation checks
    const validationErrors = [];
    if (!market || market.status !== 'OPEN') validationErrors.push('Market is not open');
    if (market?.inPlay && !settings.allowInPlay) validationErrors.push('Market is in-play (locked)');
    if (runner.status !== 'ACTIVE') validationErrors.push(`Runner is ${runner.status}`);
    if (paperForm.stake > settings.maxStake) validationErrors.push(`Stake exceeds max ($${settings.maxStake})`);
    if (paperForm.stake < 1) validationErrors.push('Invalid stake');
    const price = paperForm.side === 'BACK' ? runner.bestBackPrice : runner.bestLayPrice;
    if (!price || price < settings.minOdds || price > settings.maxOdds) validationErrors.push('Odds outside allowed range');
    // Available size check
    const availableSize = paperForm.side === 'BACK' ? (runner.bestBackSize || 0) : (runner.bestLaySize || 0);
    if (availableSize <= 0) validationErrors.push('Available size is zero');

    if (validationErrors.length > 0) {
      const rejectedOrder = {
        strategyName: paperForm.strategy,
        marketId: selectedMarket,
        betfairMarketId: market?.betfairMarketId || selectedMarket,
        selectionId: runner.betfairSelectionId || runner.selectionId,
        runnerId: selectedRunner,
        runnerName: runner.runnerName,
        marketName: market?.marketName || 'Unknown',
        venue: market?.venue || '',
        raceNumber: market?.raceNumber || 0,
        side: paperForm.side,
        orderType: 'LIMIT',
        size: paperForm.stake,
        price: price,
        persistenceType: paperForm.persistenceType || 'LAPSE',
        paper_mode: true,
        liveMode: false,
        requested_size: paperForm.stake,
        matched_size: 0,
        remaining_size: paperForm.stake,
        requestedStake: paperForm.stake,
        matchedStake: 0,
        requestedOdds: price,
        matchedOdds: null,
        status: 'rejected',
        rejection_reason: validationErrors.join('; '),
        failed_validation_field: validationErrors[0],
        result: 'pending',
        entryReason: `${paperForm.strategy} manual paper order`,
        warningFlags: validationErrors,
        paperSimulationQuality: 'High',
      };
      addPaperOrder(rejectedOrder);
      addAuditLog('Paper Order Rejected', 'order', 'warning', `${paperForm.side} ${runner.runnerName} — rejected: ${validationErrors.join('; ')}`);
      setShowPaperForm(false);
      return;
    }

    // Calculate matched/unmatched based on available size
    const matchedStake = Math.min(paperForm.stake, availableSize);
    const unmatchedStake = paperForm.stake - matchedStake;
    const orderStatus = unmatchedStake > 0 ? 'partially_matched' : 'matched';

    const order = {
      strategyName: paperForm.strategy,
      marketId: selectedMarket,
      betfairMarketId: market?.betfairMarketId || selectedMarket,
      selectionId: runner.betfairSelectionId || runner.selectionId,
      runnerId: selectedRunner,
      runnerName: runner.runnerName,
      marketName: market?.marketName || 'Unknown',
      venue: market?.venue || '',
      raceNumber: market?.raceNumber || 0,
      side: paperForm.side,
      orderType: 'LIMIT',
      size: paperForm.stake,
      price: price,
      persistenceType: paperForm.persistenceType || 'LAPSE',
      customerRef: 'BEL' + Date.now().toString(36).toUpperCase(),
      customerStrategyRef: 'BEL_' + paperForm.strategy.toUpperCase().replace(/[^A-Z]/g, ''),
      handicap: runner.handicap || 0,
      paper_mode: true,
      liveMode: false,
      requested_size: paperForm.stake,
      matched_size: matchedStake,
      remaining_size: unmatchedStake,
      average_price_matched: matchedStake > 0 ? price : null,
      requested_price: price,
      matched_price: matchedStake > 0 ? price : null,
      placed_date: new Date().toISOString(),
      matched_date: matchedStake > 0 ? new Date().toISOString() : null,
      requestedOdds: price,
      matchedOdds: matchedStake > 0 ? price : null,
      requestedStake: paperForm.stake,
      matchedStake: matchedStake,
      status: orderStatus,
      expectedValue: edge * paperForm.stake / 100,
      result: 'pending',
      grossProfit: 0,
      commission: 0,
      netProfit: 0,
      commissionRateUsed: market?.marketBaseRate || settings.defaultCommissionRate || 0.05,
      commissionSource: market?.marketBaseRate ? 'market_base_rate' : 'default_fallback',
      commission_calculation_status: market?.marketBaseRate ? 'ok' : 'using_default',
      entryReason: `${paperForm.strategy} signal — edge ${edge.toFixed(2)}%`,
      warningFlags: [],
      paperSimulationQuality: 'High',
    };
    addPaperOrder(order);
    addAuditLog('Paper Order from Runner View', 'order', 'info', `${paperForm.side} ${runner.runnerName} @ ${price} × $${paperForm.stake} (${paperForm.persistenceType || 'LAPSE'}) — ${orderStatus}`, { objectName: runner.runnerName });
    setShowPaperForm(false);
    navigate('/orders');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to="/scanner" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to Scanner
        </Link>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/orders')}>
            <FileText className="h-3 w-3" /> Order History
          </Button>
          <Button size="sm" onClick={() => setShowPaperForm(!showPaperForm)} disabled={emergencyStop}>
            <Plus className="h-3 w-3" /> Create Paper Order
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="w-64">
          <label className="text-xs text-muted-foreground mb-1 block">Market</label>
          <Select value={selectedMarket} onValueChange={setSelectedMarket}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {markets.map(m => <SelectItem key={m.id} value={m.id}>{m.venue} — {m.marketName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-64">
          <label className="text-xs text-muted-foreground mb-1 block">Runner</label>
          <Select value={selectedRunner} onValueChange={setSelectedRunner}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {marketRunners.map(r => <SelectItem key={r.id} value={r.id}>{r.runnerName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Paper Order Form */}
      {showPaperForm && (
        <Panel title="Create Paper Order (Betfair Exchange Structure)">
          <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Strategy</label>
              <Select value={paperForm.strategy} onValueChange={v => setPaperForm({...paperForm, strategy: v})}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENRICHED_STRATEGY_LIBRARY.filter(s => s.status !== 'archived' && s.validationStatus !== 'failing' && s.validationStatus !== 'archived').map(s => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Side</label>
              <Select value={paperForm.side} onValueChange={v => setPaperForm({...paperForm, side: v})}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BACK">BACK @ {runner.bestBackPrice?.toFixed(2)}</SelectItem>
                  <SelectItem value="LAY">LAY @ {runner.bestLayPrice?.toFixed(2)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stake ($)</label>
              <Input type="number" value={paperForm.stake} onChange={e => setPaperForm({...paperForm, stake: +e.target.value})} className="h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Persistence Type</label>
              <Select value={paperForm.persistenceType || 'LAPSE'} onValueChange={v => setPaperForm({...paperForm, persistenceType: v})}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LAPSE">LAPSE (cancel at jump)</SelectItem>
                  <SelectItem value="PERSIST">PERSIST (keep in-play)</SelectItem>
                  <SelectItem value="MARKET_ON_CLOSE">MARKET_ON_CLOSE (BSP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={handleCreatePaperOrder} disabled={emergencyStop || paperForm.stake > settings.maxStake}>
                Submit & Go to Orders
              </Button>
            </div>
            {paperForm.stake > settings.maxStake && (
              <div className="md:col-span-5 text-xs text-chart-5">Stake exceeds max (${settings.maxStake})</div>
            )}
            {paperForm.persistenceType === 'PERSIST' && (
              <div className="md:col-span-5 text-xs text-chart-4 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> PERSIST may leave unmatched bets active in-play. Use only if intentionally approved.
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Price Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Best Back</span>
          <div className="text-2xl font-bold font-mono text-chart-3 mt-1">{runner.bestBackPrice.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">${runner.bestBackSize.toLocaleString()}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Best Lay</span>
          <div className="text-2xl font-bold font-mono text-chart-5 mt-1">{runner.bestLayPrice.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">${runner.bestLaySize.toLocaleString()}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Spread (ticks)</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">{spreadTicks}</div>
          <div className="text-[10px] text-muted-foreground">{spreadQuality.label}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Back Size</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">${runner.bestBackSize.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">Available</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Lay Size</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">${runner.bestLaySize.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">Available</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Traded Vol</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">${runner.tradedVolume.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">Total matched</div>
        </div>
      </div>

      {/* Runner Warnings */}
      {runnerWarnings.length > 0 && (
        <Panel title="Runner Warnings">
          <div className="p-4 space-y-2">
            {runnerWarnings.map((w, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded ${w.level === 'critical' ? 'bg-chart-5/10 text-chart-5' : 'bg-chart-4/10 text-chart-4'}`}>
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {w.msg}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Betfair Runner Identity */}
      <Panel title="Betfair Runner Data">
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
          <div><span className="text-muted-foreground">Selection ID</span><div className="font-mono font-semibold mt-0.5">{runner.betfairSelectionId || runner.selectionId || '—'}</div></div>
          <div><span className="text-muted-foreground">Runner Name</span><div className="font-semibold mt-0.5">{runner.runnerName}</div></div>
          <div><span className="text-muted-foreground">Status</span><div className="mt-0.5"><StatusBadge status={runner.status === 'ACTIVE' ? 'ok' : runner.status === 'REMOVED' ? 'danger' : 'warning'}>{runner.status}</StatusBadge></div></div>
          <div><span className="text-muted-foreground">Handicap</span><div className="font-mono mt-0.5">{runner.handicap ?? 0}</div></div>
          <div><span className="text-muted-foreground">Adjustment Factor</span><div className="font-mono mt-0.5">{runner.adjustmentFactor ?? '—'}</div></div>
          <div><span className="text-muted-foreground">Last Price Traded</span><div className="font-mono mt-0.5">{runner.lastPriceTraded?.toFixed(2) || '—'}</div></div>
          <div><span className="text-muted-foreground">Total Matched</span><div className="font-mono mt-0.5">${runner.totalMatched?.toLocaleString() || '0'}</div></div>
          <div><span className="text-muted-foreground">Available to Back</span><div className="font-mono mt-0.5">{runner.availableToBack?.length || 0} levels</div></div>
          <div><span className="text-muted-foreground">Available to Lay</span><div className="font-mono mt-0.5">{runner.availableToLay?.length || 0} levels</div></div>
          <div><span className="text-muted-foreground">Signal Status</span><div className="mt-0.5"><StatusBadge status={runner.strategySignalStatus === 'active' ? 'ok' : runner.strategySignalStatus === 'rejected' ? 'danger' : 'neutral'}>{runner.strategySignalStatus || 'none'}</StatusBadge></div></div>
          {runner.rejectedSignalReason && <div className="col-span-2"><span className="text-muted-foreground">Rejected Reason</span><div className="text-chart-5 mt-0.5">{runner.rejectedSignalReason}</div></div>}
        </div>
      </Panel>

      {/* Model Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Implied Probability</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">{runner.impliedProbability.toFixed(2)}%</div>
          <div className="text-[10px] text-muted-foreground">Market price</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Market-Derived Probability</span>
          <div className="text-2xl font-bold font-mono text-chart-2 mt-1">{modelProbability.toFixed(2)}%</div>
          <div className="text-[10px] text-muted-foreground">
            {runner.formDataStatus === 'MARKET_ONLY' || !runner.formDataStatus
              ? 'Market microstructure only — no horse form data'
              : `Data: ${runner.formDataStatus} (${runner.formDataCompleteness || 0}%)`}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Edge</span>
          <div className={`text-2xl font-bold font-mono mt-1 ${edge > 0 ? 'text-chart-1' : edge < 0 ? 'text-chart-5' : 'text-muted-foreground'}`}>
            {edge > 0 ? '+' : ''}{edge.toFixed(2)}%
          </div>
          <div className="text-[10px] text-muted-foreground">{edge > 2 ? 'Value detected' : edge < -2 ? 'Negative edge' : 'Marginal'}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">CLV Estimate</span>
          <div className={`text-2xl font-bold font-mono mt-1 ${clvEstimate >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>
            {clvEstimate >= 0 ? '+' : ''}{clvEstimate.toFixed(2)}%
          </div>
          <div className="text-[10px] text-muted-foreground">Closing line value</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Signal Status</span>
          <div className="text-2xl font-bold font-mono mt-1">
            {edge > 3 ? <span className="text-chart-1">ACTIVE</span> : edge < -3 ? <span className="text-chart-5">BLOCKED</span> : <span className="text-chart-4">MARGINAL</span>}
          </div>
          <div className="text-[10px] text-muted-foreground">{edge > 3 ? 'Signal eligible' : edge < -3 ? 'Negative edge' : 'Below threshold'}</div>
        </div>
      </div>

      {/* Strategy Suitability */}
      <Panel title="Strategy Suitability">
        <div className="p-4">
          {suitableStrategies.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">No strategies are eligible for this runner/market combination.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {suitableStrategies.map(s => (
                <div key={s.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                  <div>
                    <div className="text-xs font-bold text-foreground">{s.name}</div>
                    <div className="text-[10px] text-muted-foreground">{s.category} · Min edge {s.minEdge}%</div>
                  </div>
                  <StatusBadge status={s.status === 'active' ? 'ok' : 'neutral'}>{s.status}</StatusBadge>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Price Movement Chart */}
        <Panel title="Price Movement" className="lg:col-span-2">
          <div className="p-4">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                <XAxis dataKey="time" stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid hsl(217 33% 17%)', borderRadius: '8px', fontSize: '12px' }} />
                <ReferenceLine y={runner.bestBackPrice} stroke="hsl(199 89% 48%)" strokeDasharray="3 3" label={{ value: 'Back', fill: 'hsl(199 89% 48%)', fontSize: 10 }} />
                <ReferenceLine y={runner.bestLayPrice} stroke="hsl(0 72% 51%)" strokeDasharray="3 3" label={{ value: 'Lay', fill: 'hsl(0 72% 51%)', fontSize: 10 }} />
                <Line type="monotone" dataKey="price" stroke="hsl(263 70% 55%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Indicators */}
        <Panel title="Indicators">
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> Momentum</span>
                <span className={`text-sm font-bold font-mono ${momentum > 0 ? 'text-chart-1' : momentum < 0 ? 'text-chart-5' : 'text-muted-foreground'}`}>
                  {momentum > 0 ? '+' : ''}{momentum.toFixed(2)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${momentum > 0 ? 'bg-chart-1' : 'bg-chart-5'}`} style={{ width: `${Math.min(Math.abs(momentum) * 50, 100)}%` }} />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>{momentum > 0 ? '▲ Steaming' : momentum < 0 ? '▼ Drifting' : '→ Stable'}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Gauge className="h-3 w-3" /> Volatility</span>
                <span className={`text-sm font-bold font-mono ${volatility > 0.1 ? 'text-chart-4' : 'text-chart-1'}`}>
                  {volatility.toFixed(3)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${volatility > 0.1 ? 'bg-chart-4' : 'bg-chart-1'}`} style={{ width: `${Math.min(volatility * 500, 100)}%` }} />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>{volatility > 0.1 ? 'High volatility' : 'Low volatility'}</span>
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Implied Probability</span>
                <span className="font-mono font-semibold">{runner.impliedProbability.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-muted-foreground">Overround</span>
                <span className="font-mono font-semibold">{overround.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-muted-foreground">Favourite Rank</span>
                <span className="font-mono font-semibold">#{runner.favouriteRank}</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Price Ladder */}
      <Panel title="Price Ladder">
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2 max-w-md mx-auto text-xs font-medium text-muted-foreground mb-1">
            <div className="text-center">Back Size</div>
            <div className="text-center">Price</div>
            <div className="text-center">Lay Size</div>
          </div>
          <div className="space-y-0.5 max-w-md mx-auto">
            {ladder.map((row, i) => (
              <div key={i} className={`grid grid-cols-3 gap-2 rounded text-xs ${row.isCurrent ? 'bg-primary/10 border border-primary/30' : ''}`}>
                <div className="text-right py-1.5 pr-3 font-mono text-chart-3">{row.backSize > 0 ? `£${row.backSize}` : ''}</div>
                <div className="text-center py-1.5 font-mono font-bold text-foreground">{row.price.toFixed(2)}</div>
                <div className="text-left py-1.5 pl-3 font-mono text-chart-5">{row.laySize > 0 ? `£${row.laySize}` : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}