import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToCSV } from '@/lib/csvExport';

export default function MarketFeedPanel() {
  const { lastExchangeDiagnostics, botCycles, markets, runners, apiConnected, betfairConnection } = useApp();
  const [showAll, setShowAll] = useState(false);

  const diag = lastExchangeDiagnostics;
  const feedDiag = diag?.marketFeedDiagnostics;
  const funnel = diag?.timeWindowFunnel;
  const loadedTable = diag?.loadedMarketsTable;
  const scanSummary = botCycles[0]?.scanSummary;
  const connDiag = diag?.connectionDiagnostics;

  // Connection status strip
  const streamStatus = betfairConnection?.streamConnectionStatus || 'disconnected';
  const lastUpdate = betfairConnection?.lastMarketSyncTime;
  const streamConnected = streamStatus === 'connected' || streamStatus === 'polling';
  const notConnected = !apiConnected;

  // Live market count is the source of truth — diagnostics may be stale
  // (captured during a scan before the stream connected)
  const totalLoaded = markets.length;
  const openPreRace = markets.filter(m => m.status === 'OPEN' && !m.inPlay).length;
  const insideWindow = funnel?.insideWindowMarkets ?? scanSummary?.marketsInsideTimeWindow ?? 0;

  // Live market type counts from current markets
  const getMarketType = (m) => (m.marketType || m.marketTypeCode || m.marketName || '').toUpperCase();
  const winMarkets = markets.filter(m => getMarketType(m).includes('WIN')).length;
  const placeMarkets = markets.filter(m => {
    const t = getMarketType(m);
    return t.includes('PLACE') || t.includes('TO BE PLACED');
  }).length;
  const h2hMarkets = markets.filter(m => {
    const t = getMarketType(m);
    return t.includes('HEAD') || t.includes('H2H') || t.includes('MATCH');
  }).length;
  const unknownMarkets = Math.max(0, markets.length - winMarkets - placeMarkets - h2hMarkets);

  // Live price data counts — runners are stored separately from markets
  const marketsWithPrices = new Set();
  for (const r of runners) {
    if (r.bestBackPrice > 0 || r.bestLayPrice > 0) {
      marketsWithPrices.add(r.marketId);
    }
  }
  const withPriceData = marketsWithPrices.size;
  const missingPriceData = Math.max(0, totalLoaded - withPriceData);

  // Live markets table — always use current markets in memory
  const displayMarkets = markets.slice(0, showAll ? 50 : 20).map(m => {
    const marketRunners = runners.filter(r => r.marketId === m.id || r.marketId === m.betfairMarketId);
    return {
      eventName: m.eventName || '',
      marketName: m.marketName || '',
      marketTypeCode: m.marketTypeCode || m.marketType || '',
      detectedMarketType: m.marketType || '',
      status: m.status || '',
      inPlay: m.inPlay,
      startTime: m.startTime || m.marketStartTime || '',
      secondsToJump: m.startTime ? Math.round((new Date(m.startTime).getTime() - Date.now()) / 1000) : null,
      runnerCount: Math.max(m.numberOfRunners || 0, m.numberOfActiveRunners || 0, marketRunners.length),
      hasPriceData: marketRunners.some(r => r.bestBackPrice > 0 || r.bestLayPrice > 0),
      totalMatched: m.totalMatched || 0,
    };
  });

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
      {/* Connection status strip */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border-subtle text-[11px] flex-wrap">
        <span className="text-muted-foreground uppercase tracking-wider">Connection:</span>
        {notConnected ? (
          <StatusBadge status="danger">Not connected</StatusBadge>
        ) : streamConnected ? (
          <StatusBadge status="ok">Stream live</StatusBadge>
        ) : streamStatus === 'error' ? (
          <StatusBadge status="danger">Stream error</StatusBadge>
        ) : (
          <StatusBadge status="warning">{streamStatus}</StatusBadge>
        )}
        {lastUpdate && (
          <span className="text-muted-foreground">
            Last update: {new Date(lastUpdate).toLocaleTimeString()}
          </span>
        )}
        {connDiag?.streamError && (
          <span className="text-danger">{connDiag.streamError}</span>
        )}
        {notConnected && (
          <span className="text-muted-foreground">Go to Setup → connect Betfair session to stream live market data</span>
        )}
      </div>

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