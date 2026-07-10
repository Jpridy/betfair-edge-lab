import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Link as LinkIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { exportToCSV } from '@/lib/csvExport';
import { getMarketDataSourceLabel } from '@/lib/betfairMarketMerge';
import { Link } from 'react-router-dom';

const SOURCE_LABELS = {
  stream_live: { label: 'Stream live', status: 'ok' },
  rest_catalogue: { label: 'REST catalogue/book', status: 'info' },
  merged: { label: 'Merged stream + catalogue', status: 'ok' },
  cached_stale: { label: 'Cached/stale', status: 'warning' },
  none: { label: 'None', status: 'danger' },
};

export default function MarketFeedPanel() {
  const { lastExchangeDiagnostics, botCycles, markets, runners, apiConnected, betfairConnection, refreshBetfairData } = useApp();
  const [showAll, setShowAll] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [fetching, setFetching] = useState(false);

  const diag = lastExchangeDiagnostics;
  const feedDiag = diag?.marketFeedDiagnostics;
  const funnel = diag?.timeWindowFunnel;
  const loadedTable = diag?.loadedMarketsTable;
  const scanSummary = botCycles[0]?.scanSummary;
  const connDiag = diag?.connectionDiagnostics;

  const streamStatus = betfairConnection?.streamConnectionStatus || 'disconnected';
  const lastUpdate = betfairConnection?.lastMarketSyncTime;
  const lastCatalogue = betfairConnection?.lastCatalogueRefreshAt;
  const streamConnected = streamStatus === 'connected' || streamStatus === 'polling';
  const notConnected = !apiConnected;

  const totalLoaded = markets.length;
  const openPreRace = markets.filter(m => m.status === 'OPEN' && !m.inPlay).length;
  const insideWindow = funnel?.insideWindowMarkets ?? scanSummary?.marketsInsideTimeWindow ?? 0;

  // Source-based counts
  const sourceLabel = getMarketDataSourceLabel(markets, streamStatus);
  const sourceInfo = SOURCE_LABELS[sourceLabel] || SOURCE_LABELS.none;
  const streamCount = markets.filter(m => m.source === 'stream' || m.source === 'merged').length;
  const catalogueCount = markets.filter(m => m.source === 'catalogue' || m.source === 'merged').length;
  const mergedCount = markets.filter(m => m.source === 'merged').length;

  // Live market type counts
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

  // Live price data counts
  const marketsWithPrices = new Set();
  for (const r of runners) {
    if (r.bestBackPrice > 0 || r.bestLayPrice > 0) {
      marketsWithPrices.add(r.marketId);
    }
  }
  const withPriceData = marketsWithPrices.size;
  const missingPriceData = Math.max(0, totalLoaded - withPriceData);

  const displayMarkets = markets.slice(0, showAll ? 50 : 20).map(m => {
    const marketRunners = runners.filter(r => String(r.marketId || '') === String(m.id || '') || String(r.marketId || '') === String(m.betfairMarketId || ''));
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
      source: m.source || 'cached',
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
      { key: 'source', label: 'Source' },
    ]);
  };

  const handleFetchMarkets = async () => {
    setFetching(true);
    try {
      await refreshBetfairData();
    } finally {
      setFetching(false);
    }
  };

  // ── Empty state ──
  if (totalLoaded === 0) {
    return (
      <Panel title="Market Feed">
        <div className="p-8 text-center space-y-4">
          <div className="text-2xl font-bold text-foreground">No Betfair markets loaded</div>
          <div className="text-sm text-muted-foreground">
            {notConnected
              ? 'Connect a Betfair session to stream live market data.'
              : 'Connected but no markets in memory. Fetch the catalogue to load market data.'}
          </div>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <Link to="/setup-wizard">
              <Button variant="outline" size="sm" className="gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" /> Open Setup
              </Button>
            </Link>
            <Button variant="default" size="sm" onClick={handleFetchMarkets} disabled={fetching || notConnected} className="gap-1.5">
              {fetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Fetch Betfair Markets Now
            </Button>
          </div>
          {feedDiag && (
            <div className="pt-4">
              <button onClick={() => setShowDetails(!showDetails)} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                {showDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Details
              </button>
              {showDetails && (
                <pre className="mt-2 text-[10px] font-mono text-muted-foreground bg-muted/20 rounded p-2 overflow-auto max-h-48 text-left">{JSON.stringify(feedDiag, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Market Feed"
      action={
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={handleFetchMarkets} disabled={fetching || notConnected}>
            {fetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={handleExport} disabled={displayMarkets.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      }
    >
      {/* Connection + source status strip */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border text-[11px] flex-wrap">
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
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground uppercase tracking-wider">Source:</span>
        <StatusBadge status={sourceInfo.status}>{sourceInfo.label}</StatusBadge>
        {lastUpdate && (
          <span className="text-muted-foreground">Last stream: {new Date(lastUpdate).toLocaleTimeString()}</span>
        )}
        {lastCatalogue && (
          <span className="text-muted-foreground">Last REST: {new Date(lastCatalogue).toLocaleTimeString()}</span>
        )}
      </div>

      {/* Summary stats — source-separated */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-border">
        {[
          { label: 'In Memory', value: totalLoaded, color: 'text-foreground' },
          { label: 'Stream', value: streamCount, color: 'text-info' },
          { label: 'Catalogue', value: catalogueCount, color: 'text-primary' },
          { label: 'Open Pre-Race', value: openPreRace, color: 'text-success' },
          { label: 'In Window', value: insideWindow, color: 'text-success' },
          { label: 'Merged', value: mergedCount, color: 'text-warning' },
        ].map(s => (
          <div key={s.label} className="bg-card p-2 text-center">
            <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Market type + price data status */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border text-xs flex-wrap">
        <span className="text-muted-foreground">Types:</span>
        <span className="text-success font-semibold">WIN: {winMarkets}</span>
        <span className="text-primary font-semibold">PLACE: {placeMarkets}</span>
        <span className="text-info font-semibold">H2H: {h2hMarkets}</span>
        {unknownMarkets > 0 && <span className="text-warning font-semibold">Unknown: {unknownMarkets}</span>}
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">Prices:</span>
        <span className="text-success font-semibold">{withPriceData} with prices</span>
        <span className="text-danger font-semibold">{missingPriceData} missing</span>
      </div>

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
              <TableHead className="text-[9px] h-7 px-2">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayMarkets.map((m, i) => (
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
                <TableCell className="text-[10px] px-2 py-1">
                  <span className="text-muted-foreground">{m.source}</span>
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

      {/* Technical diagnostics behind expander */}
      {feedDiag && (
        <div className="border-t border-border">
          <button onClick={() => setShowDetails(!showDetails)} className="w-full px-4 py-2 text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            {showDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Technical Diagnostics
          </button>
          {showDetails && (
            <pre className="px-4 pb-2 text-[10px] font-mono text-muted-foreground bg-muted/20 overflow-auto max-h-48">{JSON.stringify(feedDiag, null, 2)}</pre>
          )}
        </div>
      )}
    </Panel>
  );
}