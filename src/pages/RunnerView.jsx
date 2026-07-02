import React, { useState, useMemo, useEffect } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Gauge } from 'lucide-react';

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

// Generate ladder around current price
function generateLadder(bestBack, bestLay) {
  const center = (bestBack + bestLay) / 2;
  const ladder = [];
  for (let i = 8; i >= 1; i--) {
    const price = parseFloat((center + i * 0.1).toFixed(2));
    ladder.push({
      price,
      backSize: i === 1 ? 1250 : Math.floor(Math.random() * 800 + 100),
      laySize: i === 1 ? 890 : Math.floor(Math.random() * 600 + 50),
      isCurrent: i === 1,
    });
  }
  for (let i = 1; i <= 8; i++) {
    const price = parseFloat((center - i * 0.1).toFixed(2));
    ladder.push({
      price,
      backSize: i === 1 ? 1100 : Math.floor(Math.random() * 700 + 100),
      laySize: i === 1 ? 750 : Math.floor(Math.random() * 500 + 50),
      isCurrent: i === 1,
    });
  }
  return ladder.sort((a, b) => b.price - a.price);
}

export default function RunnerView() {
  const { markets, runners } = useApp();
  const [selectedMarket, setSelectedMarket] = useState(markets[0]?.id || '');
  const marketRunners = useMemo(() => runners.filter(r => r.marketId === selectedMarket), [runners, selectedMarket]);
  const [selectedRunner, setSelectedRunner] = useState(marketRunners[0]?.id || '');

  React.useEffect(() => {
    if (marketRunners.length > 0 && !marketRunners.find(r => r.id === selectedRunner)) {
      setSelectedRunner(marketRunners[0].id);
    }
  }, [marketRunners, selectedRunner]);

  const runner = runners.find(r => r.id === selectedRunner);
  const market = markets.find(m => m.id === selectedMarket);
  const priceHistory = useMemo(() => runner ? generatePriceHistory(runner.lastTradedPrice) : [], [runner?.id, runner?.lastTradedPrice]);
  const ladder = useMemo(() => runner ? generateLadder(runner.bestBackPrice, runner.bestLayPrice) : [], [runner?.id]);

  if (!runner) {
    return <Panel><div className="p-8 text-center text-muted-foreground text-sm">No runners available for this market.</div></Panel>;
  }

  const spread = runner.bestLayPrice - runner.bestBackPrice;
  const overround = market ? runners.filter(r => r.marketId === selectedMarket).reduce((sum, r) => sum + (1 / r.bestBackPrice), 0) * 100 - 100 : 0;

  // Momentum and volatility
  const momentum = priceHistory.length >= 2 ? priceHistory[priceHistory.length - 1].price - priceHistory[0].price : 0;
  const volatility = Math.sqrt(priceHistory.reduce((sum, p, i, arr) => i > 0 ? sum + Math.pow(p.price - arr[i-1].price, 2) : 0, 0) / priceHistory.length);

  return (
    <div className="space-y-5">
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

      {/* Price Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Best Back</span>
          <div className="text-2xl font-bold font-mono text-chart-3 mt-1">{runner.bestBackPrice.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">£{runner.bestBackSize.toLocaleString()}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Best Lay</span>
          <div className="text-2xl font-bold font-mono text-chart-5 mt-1">{runner.bestLayPrice.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">£{runner.bestLaySize.toLocaleString()}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Spread</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">{spread.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{((spread / runner.bestBackPrice) * 100).toFixed(2)}%</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Liquidity</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">£{(runner.bestBackSize + runner.bestLaySize).toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">Available</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Traded Vol</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">£{runner.tradedVolume.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">Total matched</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Last Traded</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">{runner.lastTradedPrice.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">Implied: {runner.impliedProbability.toFixed(1)}%</div>
        </div>
      </div>

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