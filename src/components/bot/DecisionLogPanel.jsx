import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Download, Trash2, FileText, ListChecks, Globe, TableProperties } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { exportToCSV } from '@/lib/csvExport';
import { CYCLE_EXPORT_COLUMNS, OPPORTUNITY_EXPORT_COLUMNS, cycleToRow, opportunitiesToRows } from '@/lib/decisionLogExport';
export { CYCLE_EXPORT_COLUMNS, cycleToRow };

const LOADED_MARKETS_COLUMNS = [
  { key: 'marketId', label: 'MarketId' },
  { key: 'eventName', label: 'EventName' },
  { key: 'marketName', label: 'MarketName' },
  { key: 'marketTypeCode', label: 'MarketTypeCode' },
  { key: 'detectedMarketType', label: 'DetectedMarketType' },
  { key: 'status', label: 'Status' },
  { key: 'inPlay', label: 'InPlay' },
  { key: 'marketStartTime', label: 'MarketStartTime' },
  { key: 'secondsToJump', label: 'SecondsToJump' },
  { key: 'runnerCount', label: 'RunnerCount' },
  { key: 'hasPriceData', label: 'HasPriceData' },
  { key: 'totalMatched', label: 'TotalMatched' },
];

const NEAREST_MARKETS_COLUMNS = [
  { key: 'marketId', label: 'MarketId' },
  { key: 'eventName', label: 'EventName' },
  { key: 'marketName', label: 'MarketName' },
  { key: 'marketTypeCode', label: 'MarketTypeCode' },
  { key: 'status', label: 'Status' },
  { key: 'inPlay', label: 'InPlay' },
  { key: 'marketStartTime', label: 'MarketStartTime' },
  { key: 'secondsToJump', label: 'SecondsToJump' },
  { key: 'timeWindowCategory', label: 'TimeWindowCategory' },
];

export default function DecisionLogPanel() {
  const { botCycles, clearBotCycles, featherlessSettings, updateFeatherlessSettings } = useApp();
  const [showDebugTable, setShowDebugTable] = useState(false);

  const handleExportCycles = () => {
    const validCycles = botCycles.filter(cycle => (cycle.cycleId || cycle.id) && (cycle.finishedAt || cycle.startedAt));
    if (validCycles.length === 0) return;
    exportToCSV(
      `decision-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      validCycles.map(cycleToRow),
      CYCLE_EXPORT_COLUMNS
    );
  };

  const handleExportOpportunities = () => {
    if (botCycles.length === 0) return;
    const rows = opportunitiesToRows(botCycles);
    if (rows.length === 0) return;
    exportToCSV(
      'opportunity-log.csv',
      rows,
      OPPORTUNITY_EXPORT_COLUMNS
    );
  };

  const handleExportLoadedMarkets = () => {
    if (botCycles.length === 0) return;
    const latest = botCycles[0];
    const table = latest.scanSummary?.loadedMarketsTable || [];
    if (table.length === 0) return;
    exportToCSV(
      `loaded-markets-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      table,
      LOADED_MARKETS_COLUMNS
    );
  };

  const handleExportNearestMarkets = () => {
    if (botCycles.length === 0) return;
    const latest = botCycles[0];
    const funnel = latest.scanSummary?.timeWindowFunnel || {};
    const nearest = funnel.nearestMarkets || [];
    if (nearest.length === 0) return;
    exportToCSV(
      `nearest-markets-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      nearest,
      NEAREST_MARKETS_COLUMNS
    );
  };

  const debugScanMode = featherlessSettings?.debugScanMode === true;
  const latestCycle = botCycles[0];
  const latestSS = latestCycle?.scanSummary || {};
  const loadedMarkets = latestSS.loadedMarketsTable || [];
  const nearestMarkets = latestSS.timeWindowFunnel?.nearestMarkets || [];

  return (
    <Panel
      title={`Decision Log (${botCycles.length})`}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
            <Switch
              checked={debugScanMode}
              onCheckedChange={(checked) => updateFeatherlessSettings({ debugScanMode: checked })}
              className="scale-75"
            />
            <span className="text-[10px] font-medium text-muted-foreground">Debug Scan</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowDebugTable(!showDebugTable)} disabled={botCycles.length === 0}>
            <TableProperties className="h-3.5 w-3.5" />
            {showDebugTable ? 'Hide' : 'Show'} Markets
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportNearestMarkets} disabled={botCycles.length === 0}>
            <Globe className="h-3.5 w-3.5" />
            Nearest
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportLoadedMarkets} disabled={botCycles.length === 0}>
            <TableProperties className="h-3.5 w-3.5" />
            Loaded
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportOpportunities} disabled={botCycles.length === 0}>
            <ListChecks className="h-3.5 w-3.5" />
            Opportunities
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCycles} disabled={botCycles.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button size="sm" variant="destructive" onClick={clearBotCycles} disabled={botCycles.length === 0}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      }
    >
      {debugScanMode && (
        <div className="px-4 py-2 bg-warning/10 border-b border-warning/30 text-[10px] text-warning font-medium">
          DEBUG SCAN MODE ACTIVE — Time window ignored, NO orders will be placed. Diagnostic opportunities only.
        </div>
      )}
      {latestSS.selectedRaceKey && <div className="px-4 py-2 border-b border-border-subtle bg-muted/20 text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">{latestSS.selectedRaceName || latestSS.selectedRaceKey}</span> · {latestSS.raceMonitoringStatus?.replaceAll('_', ' ')} · cycle {latestSS.cyclesScannedOnThisRace || 1} on this race. {latestSS.reasonStillScanningRace}</div>}
      {showDebugTable && loadedMarkets.length > 0 && (
        <div className="border-b border-border">
          <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
            Loaded Markets ({loadedMarkets.length} shown · nearest first)
          </div>
          <div className="max-h-48 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px] h-7 px-2">Market</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Type</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Status</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Secs</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Runners</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Prices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadedMarkets.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[10px] px-2 py-1 truncate max-w-[160px]">{m.marketName || m.eventName || m.marketId}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1">{m.detectedMarketType || '—'}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1">{m.status}{m.inPlay ? ' (IP)' : ''}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{m.secondsToJump ?? '—'}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{m.runnerCount}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1">{m.hasPriceData ? '✓' : '✗'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {showDebugTable && nearestMarkets.length > 0 && (
        <div className="border-b border-border">
          <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
            Time-Window Funnel — Nearest 20 Markets
          </div>
          <div className="max-h-48 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px] h-7 px-2">Market</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Secs</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Window</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nearestMarkets.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[10px] px-2 py-1 truncate max-w-[200px]">{m.marketName || m.eventName || m.marketId}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{m.secondsToJump ?? '—'}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1">
                      <StatusBadge status={
                        m.timeWindowCategory === 'inside_window' ? 'ok' :
                        m.timeWindowCategory === 'too_early' ? 'info' :
                        m.timeWindowCategory === 'too_late' ? 'warning' : 'neutral'
                      }>
                        {m.timeWindowCategory?.replace('_', ' ')}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {botCycles.length === 0 ? (
        <div className="p-8 flex flex-col items-center justify-center text-center">
          <FileText className="h-8 w-8 text-muted-foreground mb-2" />
          <div className="text-sm font-medium text-muted-foreground">No decisions logged yet</div>
          <div className="text-xs text-muted-foreground mt-1">Run the bot to start logging every cycle decision.</div>
        </div>
      ) : (
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8 px-2">#</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Time</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">Loaded</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">W/P/H</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">Opps</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Decision</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Market</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Runner</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">Odds</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">EV</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">AI</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Blocker / Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {botCycles.map((c) => {
                const ss = c.scanSummary || {};
                const finalCandidate = ss.finalSelectedOpportunity || null;
                const rejectedCandidate = ss.bestRejectedCandidate || null;
                const bc = finalCandidate || rejectedCandidate || {};
                const isBet = c.ordersCreated > 0;
                const time = c.finishedAt || c.startedAt;
                const aiHits = ss.aiCacheHits ?? ss.cacheHits ?? 0;
                const aiCalls = ss.aiCallsMade ?? ss.eventsWithAI ?? 0;
                const aiLabel = ss.aiDisabled ? 'OFF' : (aiHits > 0 ? `${aiHits}H` : `${aiCalls}C`);
                const loaded = ss.totalMarketsLoaded ?? c.marketsScanned ?? 0;
                return (
                  <TableRow key={c.id || c.cycleNumber}>
                    <TableCell className="text-xs px-2 py-1.5 font-mono font-bold">{c.cycleNumber}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {time ? new Date(time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 text-right font-mono">{loaded}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-right font-mono text-muted-foreground">
                      {ss.winMarketsFound ?? 0}/{ss.placeMarketsFound ?? 0}/{ss.h2hMarketsFound ?? 0}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 text-right font-mono">{ss.totalOpportunities ?? 0}</TableCell>
                    <TableCell className="text-xs px-2 py-1.5">
                      <StatusBadge status={isBet ? 'ok' : 'danger'}>{isBet ? 'BET' : 'NO BET'}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 truncate max-w-[140px]">
                      {bc.marketName || c.selectedMarketName || '—'}
                      {bc.marketType && <span className="text-muted-foreground ml-1">({bc.marketType})</span>}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 truncate max-w-[120px] font-medium">
                      {bc.side && <span className="text-muted-foreground mr-1">{bc.side}</span>}
                      {bc.runnerName || '—'}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 text-right font-mono">{bc.odds != null ? bc.odds.toFixed(2) : '—'}</TableCell>
                    <TableCell className={`text-xs px-2 py-1.5 text-right font-mono ${bc.ev > 0 ? 'text-success' : 'text-danger'}`}>
                      {bc.ev != null ? `$${bc.ev.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-right font-mono text-muted-foreground">{aiLabel}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-muted-foreground truncate max-w-[180px]">
                      {bc.blocker || bc.failedGate || c.noBetReason || (isBet ? 'Bet placed' : '—')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}