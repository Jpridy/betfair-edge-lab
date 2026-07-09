import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge, SideBadge } from '@/components/ui/Trading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/csvExport';

export default function OpportunitiesPanel() {
  const { exchangeOpportunities, lastExchangeDiagnostics, botCycles } = useApp();
  const [marketTypeFilter, setMarketTypeFilter] = useState('all');
  const [sideFilter, setSideFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [sortBy, setSortBy] = useState('ev');

  // Merge exchangeOpportunities from state with latest cycle's top opps
  const allOpps = useMemo(() => {
    const state = exchangeOpportunities || [];
    const cycleOpps = botCycles[0]?.scanSummary?.topOpportunities || [];
    const cycleRej = botCycles[0]?.scanSummary?.topRejected || [];
    return [...state, ...cycleOpps, ...cycleRej];
  }, [exchangeOpportunities, botCycles]);

  // Best by category
  const bestByCategory = useMemo(() => {
    const cats = {};
    for (const opp of allOpps) {
      const key = `${opp.side}_${opp.marketType || opp.detectedMarketType || 'UNKNOWN'}`;
      if (!cats[key] || (opp.ev || 0) > (cats[key].ev || 0)) {
        cats[key] = opp;
      }
    }
    return cats;
  }, [allOpps]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = allOpps;
    if (marketTypeFilter !== 'all') result = result.filter(o => (o.marketType || o.detectedMarketType || '').toUpperCase() === marketTypeFilter);
    if (sideFilter !== 'all') result = result.filter(o => o.side === sideFilter);
    if (resultFilter === 'passed') result = result.filter(o => o.decision === 'BET' || o.passed);
    if (resultFilter === 'failed') result = result.filter(o => o.decision !== 'BET' && !o.passed);

    return result.sort((a, b) => {
      if (sortBy === 'ev') return (b.ev || 0) - (a.ev || 0);
      if (sortBy === 'roi') return (b.roi || b.expectedROI || 0) - (a.roi || a.expectedROI || 0);
      if (sortBy === 'confidence') return (b.confidence || 0) - (a.confidence || 0);
      if (sortBy === 'liquidity') return (b.availableSize || b.liquidity || 0) - (a.availableSize || a.liquidity || 0);
      return 0;
    });
  }, [allOpps, marketTypeFilter, sideFilter, resultFilter, sortBy]);

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCSV('exchange-opportunities.csv', filtered.map(o => ({
      marketType: o.marketType || o.detectedMarketType || '',
      side: o.side || '',
      runner: o.runnerName || '',
      eventName: o.eventName || '',
      marketName: o.marketName || '',
      odds: o.odds || '',
      bestBack: o.bestBackPrice || '',
      bestLay: o.bestLayPrice || '',
      spread: o.spreadTicks || o.spread || '',
      availableSize: o.availableSize || o.liquidity || '',
      modelProbability: o.modelProbability || '',
      fairOdds: o.fairOdds || '',
      ev: o.ev || '',
      roi: o.roi || o.expectedROI || '',
      confidence: o.confidence || '',
      stake: o.stake || '',
      liability: o.liability || '',
      blocker: o.failedGate || o.mainBlocker || (o.blockers || []).join('; '),
      decision: o.decision || '',
    })));
  };

  const bestCards = [
    { label: 'Best BACK WIN', key: 'BACK_WIN' },
    { label: 'Best LAY WIN', key: 'LAY_WIN' },
    { label: 'Best BACK PLACE', key: 'BACK_PLACE' },
    { label: 'Best LAY PLACE', key: 'LAY_PLACE' },
    { label: 'Best BACK H2H', key: 'BACK_H2H' },
    { label: 'Best LAY H2H', key: 'LAY_H2H' },
  ];

  return (
    <Panel
      title="Exchange Opportunities"
      action={
        <Button size="sm" variant="ghost" onClick={handleExport} disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      }
    >
      {/* Best by category cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-3 border-b border-border">
        {bestCards.map(card => {
          const opp = bestByCategory[card.key];
          return (
            <div key={card.key} className={cn(
              'rounded-lg border p-2',
              opp ? 'border-chart-1/30 bg-chart-1/5' : 'border-border bg-muted/20'
            )}>
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider truncate">{card.label}</div>
              {opp ? (
                <>
                  <div className="text-xs font-bold text-foreground truncate mt-0.5">{opp.runnerName || '—'}</div>
                  <div className="text-[10px] font-mono text-chart-1">EV ${opp.ev?.toFixed(2) || '0'}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">@ {opp.odds?.toFixed(2) || '—'}</div>
                </>
              ) : (
                <div className="text-[10px] text-muted-foreground mt-1">None found</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select value={marketTypeFilter} onChange={e => setMarketTypeFilter(e.target.value)} className="bg-muted border border-border rounded px-2 py-1 text-xs">
          <option value="all">All Types</option>
          <option value="WIN">WIN</option>
          <option value="PLACE">PLACE</option>
          <option value="H2H">H2H</option>
        </select>
        <select value={sideFilter} onChange={e => setSideFilter(e.target.value)} className="bg-muted border border-border rounded px-2 py-1 text-xs">
          <option value="all">All Sides</option>
          <option value="BACK">BACK</option>
          <option value="LAY">LAY</option>
        </select>
        <select value={resultFilter} onChange={e => setResultFilter(e.target.value)} className="bg-muted border border-border rounded px-2 py-1 text-xs">
          <option value="all">All Results</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-muted border border-border rounded px-2 py-1 text-xs">
          <option value="ev">Sort: EV</option>
          <option value="roi">Sort: ROI</option>
          <option value="confidence">Sort: Confidence</option>
          <option value="liquidity">Sort: Liquidity</option>
        </select>
        <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} opportunities</span>
      </div>

      {/* Opportunities table */}
      <div className="max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[9px] h-7 px-2">Type</TableHead>
              <TableHead className="text-[9px] h-7 px-2">Side</TableHead>
              <TableHead className="text-[9px] h-7 px-2">Runner</TableHead>
              <TableHead className="text-[9px] h-7 px-2 text-right">Odds</TableHead>
              <TableHead className="text-[9px] h-7 px-2 text-right">EV</TableHead>
              <TableHead className="text-[9px] h-7 px-2 text-right">ROI</TableHead>
              <TableHead className="text-[9px] h-7 px-2 text-right">Conf</TableHead>
              <TableHead className="text-[9px] h-7 px-2 text-right">Liability</TableHead>
              <TableHead className="text-[9px] h-7 px-2">Blocker</TableHead>
              <TableHead className="text-[9px] h-7 px-2">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-xs text-muted-foreground py-6">
                  No opportunities yet. Run a scan cycle to generate opportunities.
                </TableCell>
              </TableRow>
            ) : filtered.slice(0, 50).map((opp, i) => (
              <TableRow key={i}>
                <TableCell className="text-[10px] px-2 py-1">{opp.marketType || opp.detectedMarketType || '—'}</TableCell>
                <TableCell className="text-[10px] px-2 py-1"><SideBadge side={opp.side || 'BACK'} /></TableCell>
                <TableCell className="text-[10px] px-2 py-1 truncate max-w-[100px]">{opp.runnerName || '—'}</TableCell>
                <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{opp.odds?.toFixed(2) || '—'}</TableCell>
                <TableCell className={cn('text-[10px] px-2 py-1 text-right font-mono', (opp.ev || 0) > 0 ? 'text-chart-1' : 'text-chart-5')}>${opp.ev?.toFixed(2) || '0'}</TableCell>
                <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{((opp.roi || opp.expectedROI || 0) * 100).toFixed(1)}%</TableCell>
                <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{opp.confidence?.toFixed(0) || '—'}</TableCell>
                <TableCell className="text-[10px] px-2 py-1 text-right font-mono">${opp.liability?.toFixed(0) || '0'}</TableCell>
                <TableCell className="text-[10px] px-2 py-1 truncate max-w-[120px] text-chart-5">{opp.failedGate || opp.mainBlocker || (opp.blockers || [])[0] || '—'}</TableCell>
                <TableCell className="text-[10px] px-2 py-1">
                  <StatusBadge status={opp.decision === 'BET' || opp.passed ? 'ok' : 'danger'}>
                    {opp.decision || (opp.passed ? 'BET' : 'NO_BET')}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}