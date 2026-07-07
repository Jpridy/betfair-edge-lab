import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Filter, ExternalLink, AlertTriangle, WifiOff } from 'lucide-react';
import { ENRICHED_STRATEGY_LIBRARY } from '@/lib/strategyLibrary';
import { calculateSpreadTicks } from '@/lib/tickLadder';
import EmptyState from '@/components/EmptyState';
import { Link } from 'react-router-dom';

export default function MarketScanner() {
  const { markets, runners, toggleWatchMarket, apiConnected, dataLoading } = useApp();
  const navigate = useNavigate();
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

  const venues = [...new Set(markets.map(m => m.venue).filter(v => v && v.trim()))];

  const filtered = useMemo(() => {
    return markets.filter(m => {
      // eventType filter — matches market.eventType or eventTypeName
      if (filters.eventType !== 'all') {
        const et = (m.eventType || m.eventTypeName || '').toLowerCase();
        if (filters.eventType === 'Horse Racing' && !et.includes('horse') && !et.includes('race')) return false;
        if (filters.eventType === 'Greyhounds' && !et.includes('greyhound') && !et.includes('dog') && !et.includes('grey')) return false;
      }
      if (filters.country !== 'all' && m.country !== filters.country) return false;
      if (filters.venue !== 'all' && m.venue !== filters.venue) return false;
      if (filters.marketType !== 'all' && m.marketType !== filters.marketType) return false;
      if (filters.winOnly && m.marketType !== 'WIN') return false;
      if (filters.placeOnly && m.marketType !== 'PLACE') return false;
      if (filters.preRaceOnly && m.inPlay) return false;
      if (filters.minVolume > 0 && m.totalMatched < filters.minVolume) return false;
      // minLiquidity filter — uses totalMatched as liquidity proxy
      if (filters.minLiquidity > 0 && m.totalMatched < filters.minLiquidity) return false;
      // maxSpread filter — checks best back/lay spread across runners
      if (filters.maxSpread < 100) {
        const marketRunners = runners.filter(r => r.marketId === m.id || r.marketId === m.betfairMarketId);
        if (marketRunners.length > 0) {
          const bestBack = Math.min(...marketRunners.map(r => r.bestBackPrice || 999));
          const bestLay = Math.max(...marketRunners.map(r => r.bestLayPrice || 0));
          const spread = bestLay - bestBack;
          if (spread > filters.maxSpread) return false;
        }
      }
      if (filters.exactlyTwo && m.numberOfRunners !== 2) return false;
      if (filters.numRunners > 0 && m.numberOfRunners !== filters.numRunners) return false;
      const now = new Date();
      const start = new Date(m.startTime);
      const secsToStart = Math.floor((start - now) / 1000);
      if (secsToStart > filters.timeToStart) return false;
      return true;
    });
  }, [markets, filters, runners]);

  const getRunnerData = (marketId) => {
    const marketRunners = runners.filter(r => r.marketId === marketId);
    if (marketRunners.length === 0) return { bestBack: null, bestLay: null, spread: null, spreadTicks: 0 };
    const bestBackRange = marketRunners.map(r => r.bestBackPrice).filter(p => p > 0);
    const bestLayRange = marketRunners.map(r => r.bestLayPrice).filter(p => p > 0);
    const bestBack = bestBackRange.length > 0 ? Math.min(...bestBackRange) : null;
    const bestLay = bestLayRange.length > 0 ? Math.max(...bestLayRange) : null;
    const spreadTicks = bestBack && bestLay ? calculateSpreadTicks(bestBack, bestLay) : 0;
    const favourite = marketRunners.sort((a, b) => (a.bestBackPrice || 999) - (b.bestBackPrice || 999))[0];
    return { bestBack, bestLay, spread: bestBack && bestLay ? bestLay - bestBack : null, spreadTicks, favourite, runnerCount: marketRunners.length };
  };

  const getTimeToStart = (startTime) => {
    const diff = Math.floor((new Date(startTime) - new Date()) / 1000);
    if (diff < 0) return 'In Play';
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}m ${secs}s`;
  };

  const getRaceNumber = (marketName) => {
    const match = marketName?.match(/R(\d+)/i);
    return match ? `R${match[1]}` : '—';
  };

  const getLiquidityStatus = (totalMatched, minLiquidity) => {
    if (totalMatched >= 100000) return { label: 'High', status: 'ok' };
    if (totalMatched >= 20000) return { label: 'Medium', status: 'warning' };
    return { label: 'Low', status: 'danger' };
  };

  const getEligibleStrategies = (market) => {
    return ENRICHED_STRATEGY_LIBRARY.filter(s => {
      if (s.status === 'archived' || s.validationStatus === 'archived') return false;
      if (s.validationStatus === 'failing') return false; // Fav/Outsider is failing
      if (market.inPlay && !s.allowInPlay) return false;
      if (market.totalMatched < s.minLiquidity) return false;
      if (!s.marketTypes?.includes(market.marketType)) return false;
      return true;
    }).map(s => s.name);
  };

  const getMarketWarnings = (market) => {
    const warnings = [];
    if (market.status === 'SUSPENDED') warnings.push('Market SUSPENDED');
    if (market.status === 'CLOSED') warnings.push('Market CLOSED');
    if (market.inPlay) warnings.push('Market is in-play');
    if (market.marketBaseRate == null) warnings.push('Market Base Rate missing');
    if (market.totalMatched < (filters.minLiquidity || 5000)) warnings.push('Low liquidity');
    if (market.numberOfActiveRunners < 2) warnings.push('Insufficient active runners');
    return warnings;
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
            <Label className="text-xs">Show races starting within (sec)</Label>
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

      <Panel title={`Market Catalogue — Scanned Markets (${filtered.length})`}>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">Start Time</TableHead>
              <TableHead className="text-xs">Venue</TableHead>
              <TableHead className="text-xs">Race</TableHead>
              <TableHead className="text-xs">Market ID</TableHead>
              <TableHead className="text-xs">Market Name</TableHead>
              <TableHead className="text-xs text-right">Runners</TableHead>
              <TableHead className="text-xs text-right">Active</TableHead>
              <TableHead className="text-xs text-right">Back Range</TableHead>
              <TableHead className="text-xs text-right">Lay Range</TableHead>
              <TableHead className="text-xs text-right">Fav Price</TableHead>
              <TableHead className="text-xs text-right">Spread (ticks)</TableHead>
              <TableHead className="text-xs text-right">Traded Vol</TableHead>
              <TableHead className="text-xs text-right">MBR %</TableHead>
              <TableHead className="text-xs text-right">Bet Delay</TableHead>
              <TableHead className="text-xs">BSP</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">In-Play</TableHead>
              <TableHead className="text-xs text-right">Time to Start</TableHead>
              <TableHead className="text-xs">Eligible Strategies</TableHead>
              <TableHead className="text-xs">Warnings</TableHead>
              <TableHead className="text-xs">Watch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={21} className="py-0">
                  {markets.length === 0 && !dataLoading ? (
                    <EmptyState
                      icon={apiConnected ? Filter : WifiOff}
                      title={apiConnected ? 'No markets found' : 'Betfair API not connected'}
                      message={apiConnected
                        ? 'No open racing markets are available right now. Markets appear here when the Betfair stream delivers live data.'
                        : 'Connect your Betfair account in Settings to stream live racing markets, runners, and prices.'}
                      action={!apiConnected && (
                        <Link to="/settings" className="inline-flex items-center h-8 px-4 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                          Go to Settings
                        </Link>
                      )}
                    />
                  ) : (
                    <EmptyState icon={Filter} title="No markets match your filters" message="Try widening your filter criteria — reduce minimum volume, increase time-to-start, or clear the venue filter." />
                  )}
                </TableCell>
              </TableRow>
            ) : filtered.map(m => {
              const rd = getRunnerData(m.id);
              const liq = getLiquidityStatus(m.totalMatched, filters.minLiquidity);
              const eligible = getEligibleStrategies(m);
              const warnings = getMarketWarnings(m);
              return (
                <TableRow key={m.id} className="border-border cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/runner?market=${m.id}`)}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(m.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell className="text-xs font-medium">{m.venue}</TableCell>
                  <TableCell className="text-xs font-mono">{getRaceNumber(m.marketName)}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{m.betfairMarketId}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{m.marketName}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{m.numberOfRunners}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-muted-foreground">{m.numberOfActiveRunners || m.numberOfRunners}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-chart-3">{rd.bestBack?.toFixed(2) || '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-chart-5">{rd.bestLay?.toFixed(2) || '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-chart-2">{rd.favourite?.bestBackPrice?.toFixed(2) || '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{rd.spreadTicks || 0}</TableCell>
                  <TableCell className="text-xs text-right font-mono">${(m.totalMatched / 1000).toFixed(1)}k</TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {m.marketBaseRate != null ? `${(m.marketBaseRate * 100).toFixed(1)}%` : <span className="text-chart-5">Missing</span>}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">{m.betDelay || 0}s</TableCell>
                  <TableCell className="text-xs">{m.bspMarket ? <StatusBadge status="ok">BSP</StatusBadge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><StatusBadge status={m.status === 'OPEN' ? 'ok' : m.status === 'SUSPENDED' ? 'warning' : 'danger'}>{m.status}</StatusBadge></TableCell>
                  <TableCell className="text-xs">{m.inPlay ? <span className="text-chart-5 font-bold">YES</span> : <span className="text-muted-foreground">No</span>}</TableCell>
                  <TableCell className="text-xs text-right font-mono whitespace-nowrap">{getTimeToStart(m.startTime)}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      {eligible.length === 0 ? <span className="text-muted-foreground">—</span> : eligible.map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-chart-2/10 text-chart-2 border border-chart-2/20">{s}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {warnings.length === 0 ? (
                      <span className="text-chart-1">✓</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {warnings.map((w, i) => (
                          <span key={i} className="text-[9px] text-chart-4 flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />{w}</span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toggleWatchMarket(m.id)}>
                      {m.watched ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => navigate(`/runner?market=${m.id}`)}>
                      <ExternalLink className="h-3.5 w-3.5 text-chart-3" />
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