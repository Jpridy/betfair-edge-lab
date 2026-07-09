import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToCSV } from '@/lib/csvExport';

export default function MarketFeedPanel() {
  const { lastExchangeDiagnostics, botCycles, markets } = useApp();
  const [showAll, setShowAll] = useState(false);

  const diag = lastExchangeDiagnostics;
  const feedDiag = diag?.marketFeedDiagnostics;
  const funnel = diag?.timeWindowFunnel;
  const loadedTable = diag?.loadedMarketsTable;
  const scanSummary = botCycles[0]?.scanSummary;

  const totalLoaded = feedDiag?.totalMarketsLoaded ?? diag?.totalMarketsLoaded ?? scanSummary?.totalMarketsLoaded ?? markets.length ?? 0;
  const openPreRace = feedDiag?.openPreRaceMarkets ?? diag?.openPreRaceMarkets ?? scanSummary?.openPreRaceMarkets ?? 0;
  const insideWindow = feedDiag?.marketsInsideTimeWindow ?? diag?.marketsInsideTimeWindow ?? scanSummary?.marketsInsideTimeWindow ?? 0;

  const winMarkets = diag?.winMarketsFound ?? scanSummary?.winMarketsFound ?? 0;
  const placeMarkets = diag?.placeMarketsFound ?? scanSummary?.placeMarketsFound ?? 0;
  const h2hMarkets = diag?.h2hMarketsFound ?? scanSummary?.h2hMarketsFound ?? 0;
  const unknownMarkets = diag?.unknownMarketsFound ?? scanSummary?.unknownMarketsFound ?? 0;

  const withPriceData = feedDiag?.marketsWithPriceData ?? 0;
  const missingPriceData = feedDiag?.marketsMissingPriceData ?? 0;

  // Nearest markets table from loaded table or from markets array
  const nearestMarkets = (loadedTable || []).slice(0, showAll ? 50 : 20);
  const displayMarkets = nearestMarkets.length > 0 ? nearestMarkets : markets.slice(0, showAll ? 50 : 20).map(m => ({
    eventName: m.eventName || '',
    marketName: m.marketName || '',
    marketTypeCode: m.marketTypeCode || '',
    detectedMarketType: m.marketType || '',
    status: m.status || '',
    inPlay: m.inPlay,
    startTime: m.startTime || m.marketStartTime || '',
    secondsToJump: m.startTime ? Math.round((new Date(m.startTime).getTime() - Date.now()) / 1000) : null,
    runnerCount: m.numberOfRunners || 0,
    hasPriceData: !!(m.runners?.some(r => r.bestBackPrice)),
    totalMatched: m.totalMatched || 0,
  }));

  const handleExport = () => {
    if (displayMarkets.length === 0) return;
    exportToCSV('nearest-markets.csv', displayMarkets, [
      { key: 'eventName', label: 'Event' },
      { key: 'marketName', label: 'Market' },
      { key: 'marketTypeCode', label: 'Type Code' },
      { key: 'detectedMarketType', label: 'Detected Type' },
      { key: 'status', label: 'Status' },
      { key: 'inPlay', label: 'In Play' },
      { key: 'startTime', label: 'Start Time' },
      { key: 'secondsToJump', label: 'Sec to Jump' },
      { key: 'runnerCount', label: 'Runners' },
      { key: 'hasPriceData', label: 'Price Data' },
      { key: 'totalMatched', label: 'Total Matched' },
    ]);
  };

  return (
    <Panel
      title="Market Feed"
      action={
        <Button size="sm" variant="ghost" onClick={handleExport} disabled={displayMarkets.length === 0}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      }
    >
      {/* Summary stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-border">
        {[
          { label: 'Total Loaded', value: totalLoaded, color: 'text-foreground' },
          { label: 'Open Pre-Race', value: openPreRace, color: 'text-info' },
          { label: 'In Time Window', value: insideWindow, color: 'text-success' },
          { label: 'WIN', value: winMarkets, color: 'text-success' },
          { label: 'PLACE', value: placeMarkets, color: 'text-primary' },
          { label: 'H2H', value: h2hMarkets, color: 'text-info' },
        ].map(s => (
          <div key={s.label} className="bg-card p-2 text-center">
            <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Price data status */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border text-xs">
        <span className="text-muted-foreground">Price Data:</span>
        <span className="text-success font-semibold">{withPriceData} with prices</span>
        <span className="text-danger font-semibold">{missingPriceData} missing</span>
        {unknownMarkets > 0 && <span className="text-warning font-semibold">{unknownMarkets} unknown type</span>}
      </div>

      {/* Market type detection note */}
      {totalLoaded > 0 && placeMarkets === 0 && h2hMarkets === 0 && (
        <div className="px-4 py-1.5 border-b border-border text-[10px] text-muted-foreground">
          {unknownMarkets > 0
            ? `${unknownMarkets} market(s) could not be classified as WIN/PLACE/H2H — marketTypeCode missing from Betfair feed. Detection uses market name + marketTypeCode.`
            : winMarkets > 0
              ? 'Only WIN markets detected. Betfair did not return PLACE/H2H markets for current events (common outside AU/NZ racing).'
              : 'No WIN/PLACE/H2H markets detected. Market type detection failed or no qualifying racing events.'
          }
        </div>
      )}

      {/* Nearest markets table */}
      <div className="max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[9px] h-7 px-2">Event</TableHead>
              <TableHead className="text-[9px] h-7 px-2">Market</TableHead>
              <TableHead className="text-[9px] h-7 px-2">Type</TableHead>
              <TableHead className="text-[9px] h-7 px-2">Status</TableHead>
              <TableHead className="text-[9px] h-7 px-2 text-right">Sec to Jump</TableHead>
              <TableHead className="text-[9px] h-7 px-2 text-right">Runners</TableHead>
              <TableHead className="text-[9px] h-7 px-2">Prices</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayMarkets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">
                  No markets loaded. Connect Betfair to stream live market data.
                </TableCell>
              </TableRow>
            ) : displayMarkets.map((m, i) => (
              <TableRow key={i}>
                <TableCell className="text-[10px] px-2 py-1 truncate max-w-[140px]">{m.eventName || '—'}</TableCell>
                <TableCell className="text-[10px] px-2 py-1 truncate max-w-[120px]">{m.marketName || '—'}</TableCell>
                <TableCell className="text-[10px] px-2 py-1">{m.detectedMarketType || m.marketTypeCode || '—'}</TableCell>
                <TableCell className="text-[10px] px-2 py-1">
                  <StatusBadge status={m.status === 'OPEN' ? 'ok' : m.status === 'SUSPENDED' ? 'warning' : 'neutral'}>
                    {m.status || '—'}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-[10px] px-2 py-1 text-right font-mono">
                  {m.secondsToJump != null ? `${m.secondsToJump}s` : '—'}
                </TableCell>
                <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{m.runnerCount || '—'}</TableCell>
                <TableCell className="text-[10px] px-2 py-1">
                  {m.hasPriceData ? <span className="text-success">✓</span> : <span className="text-danger">✗</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {displayMarkets.length > 20 && (
        <div className="px-4 py-2 border-t border-border">
          <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)} className="text-xs">
            {showAll ? 'Show 20' : `Show all (${displayMarkets.length})`}
          </Button>
        </div>
      )}
    </Panel>
  );
}