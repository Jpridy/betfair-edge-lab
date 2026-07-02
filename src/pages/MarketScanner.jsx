import React, { useState, useMemo } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Filter } from 'lucide-react';

export default function MarketScanner() {
  const { markets, runners, toggleWatchMarket } = useApp();
  const [filters, setFilters] = useState({
    eventType: 'Horse Racing',
    country: 'all',
    venue: 'all',
    marketType: 'all',
    winOnly: true,
    placeOnly: false,
    preRaceOnly: true,
    timeToStart: 300,
    minVolume: 0,
    minLiquidity: 0,
    maxSpread: 100,
    numRunners: 0,
    exactlyTwo: false,
  });

  const venues = [...new Set(markets.map(m => m.venue))];

  const filtered = useMemo(() => {
    return markets.filter(m => {
      if (filters.country !== 'all' && m.country !== filters.country) return false;
      if (filters.venue !== 'all' && m.venue !== filters.venue) return false;
      if (filters.marketType !== 'all' && m.marketType !== filters.marketType) return false;
      if (filters.winOnly && m.marketType !== 'WIN') return false;
      if (filters.placeOnly && m.marketType !== 'PLACE') return false;
      if (filters.preRaceOnly && m.inPlay) return false;
      if (filters.minVolume > 0 && m.totalMatched < filters.minVolume) return false;
      if (filters.exactlyTwo && m.numberOfRunners !== 2) return false;
      if (filters.numRunners > 0 && m.numberOfRunners !== filters.numRunners) return false;
      const now = new Date();
      const start = new Date(m.startTime);
      const secsToStart = Math.floor((start - now) / 1000);
      if (secsToStart > filters.timeToStart) return false;
      return true;
    });
  }, [markets, filters]);

  const getRunnerData = (marketId) => {
    const marketRunners = runners.filter(r => r.marketId === marketId);
    if (marketRunners.length === 0) return { bestBack: null, bestLay: null, spread: null };
    const bestBack = Math.min(...marketRunners.map(r => r.bestBackPrice));
    const bestLay = Math.max(...marketRunners.map(r => r.bestLayPrice));
    return { bestBack, bestLay, spread: bestLay - bestBack };
  };

  const getTimeToStart = (startTime) => {
    const diff = Math.floor((new Date(startTime) - new Date()) / 1000);
    if (diff < 0) return 'In Play';
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-5">
      <Panel title="Scanner Filters" action={<Filter className="h-4 w-4 text-muted-foreground" />}>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div>
            <Label className="text-xs">Sport / Event Type</Label>
            <Select value={filters.eventType} onValueChange={v => setFilters({...filters, eventType: v})}>
              <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Horse Racing">Horse Racing</SelectItem>
                <SelectItem value="Greyhounds">Greyhounds</SelectItem>
                <SelectItem value="all">All Sports</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Country</Label>
            <Select value={filters.country} onValueChange={v => setFilters({...filters, country: v})}>
              <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
                <SelectItem value="UK">United Kingdom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Venue</Label>
            <Select value={filters.venue} onValueChange={v => setFilters({...filters, venue: v})}>
              <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Venues</SelectItem>
                {venues.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Market Type</Label>
            <Select value={filters.marketType} onValueChange={v => setFilters({...filters, marketType: v})}>
              <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="WIN">Win</SelectItem>
                <SelectItem value="PLACE">Place</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Time to Start (sec)</Label>
            <Input type="number" value={filters.timeToStart} onChange={e => setFilters({...filters, timeToStart: +e.target.value})} className="h-8 mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Min Traded Volume</Label>
            <Input type="number" value={filters.minVolume} onChange={e => setFilters({...filters, minVolume: +e.target.value})} className="h-8 mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Min Liquidity</Label>
            <Input type="number" value={filters.minLiquidity} onChange={e => setFilters({...filters, minLiquidity: +e.target.value})} className="h-8 mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Max Spread</Label>
            <Input type="number" step="0.1" value={filters.maxSpread} onChange={e => setFilters({...filters, maxSpread: +e.target.value})} className="h-8 mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Num Runners (=)</Label>
            <Input type="number" value={filters.numRunners} onChange={e => setFilters({...filters, numRunners: +e.target.value})} className="h-8 mt-1 text-xs" />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={filters.winOnly} onCheckedChange={v => setFilters({...filters, winOnly: v, placeOnly: v ? false : filters.placeOnly})} />
            <Label className="text-xs">Win Markets</Label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={filters.preRaceOnly} onCheckedChange={v => setFilters({...filters, preRaceOnly: v})} />
            <Label className="text-xs">Pre-Race Only</Label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={filters.exactlyTwo} onCheckedChange={v => setFilters({...filters, exactlyTwo: v})} />
            <Label className="text-xs">Exactly 2 Runners</Label>
          </div>
        </div>
      </Panel>

      <Panel title={`Scanned Markets (${filtered.length})`}>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">Start Time</TableHead>
              <TableHead className="text-xs">Venue / Event</TableHead>
              <TableHead className="text-xs">Market Name</TableHead>
              <TableHead className="text-xs text-right">Runners</TableHead>
              <TableHead className="text-xs text-right">Best Back</TableHead>
              <TableHead className="text-xs text-right">Best Lay</TableHead>
              <TableHead className="text-xs text-right">Spread</TableHead>
              <TableHead className="text-xs text-right">Traded Vol</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">In-Play</TableHead>
              <TableHead className="text-xs text-right">Time to Start</TableHead>
              <TableHead className="text-xs">Watch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(m => {
              const rd = getRunnerData(m.id);
              return (
                <TableRow key={m.id} className="border-border">
                  <TableCell className="text-xs text-muted-foreground">{new Date(m.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell className="text-xs font-medium">{m.venue} — {m.eventName}</TableCell>
                  <TableCell className="text-xs">{m.marketName}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{m.numberOfRunners}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-chart-3">{rd.bestBack?.toFixed(2) || '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-chart-5">{rd.bestLay?.toFixed(2) || '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{rd.spread?.toFixed(2) || '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono">${(m.totalMatched / 1000).toFixed(1)}k</TableCell>
                  <TableCell><StatusBadge status="ok">{m.status}</StatusBadge></TableCell>
                  <TableCell className="text-xs">{m.inPlay ? <span className="text-chart-5 font-bold">YES</span> : <span className="text-muted-foreground">No</span>}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{getTimeToStart(m.startTime)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toggleWatchMarket(m.id)}>
                      {m.watched ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}