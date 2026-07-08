import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, Trash2, FileText } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { exportToCSV } from '@/lib/csvExport';
import { fmtPct } from '@/lib/candidateScoring';

const EXPORT_COLUMNS = [
  { key: 'cycle', label: 'Cycle' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'status', label: 'Status' },
  { key: 'decision', label: 'Decision' },
  { key: 'market', label: 'Market' },
  { key: 'runner', label: 'Runner' },
  { key: 'odds', label: 'Odds' },
  { key: 'edge', label: 'Edge' },
  { key: 'expectedROI', label: 'ExpectedROI' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'impliedProb', label: 'ImpliedProb' },
  { key: 'estProb', label: 'EstProb' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'spread', label: 'Spread' },
  { key: 'score', label: 'Score' },
  { key: 'dataSource', label: 'DataSource' },
  { key: 'blocker', label: 'Blocker' },
  { key: 'marketsScanned', label: 'MarketsScanned' },
  { key: 'marketsPassed', label: 'MarketsPassed' },
  { key: 'runnersAssessed', label: 'RunnersAssessed' },
  { key: 'passedLiquidity', label: 'PassedLiquidity' },
  { key: 'passedOdds', label: 'PassedOdds' },
  { key: 'passedEdge', label: 'PassedEdge' },
  { key: 'passedROI', label: 'PassedROI' },
  { key: 'passedConfidence', label: 'PassedConfidence' },
  { key: 'signalsCreated', label: 'SignalsCreated' },
  { key: 'ordersCreated', label: 'OrdersCreated' },
  { key: 'notes', label: 'Notes' },
];

function cycleToRow(c) {
  const bc = c.bestCandidate || {};
  const ss = c.scanSummary || {};
  return {
    cycle: c.cycleNumber,
    timestamp: c.finishedAt || c.startedAt || '',
    status: c.status || '',
    decision: c.ordersCreated > 0 ? 'BET' : 'NO_BET',
    market: c.selectedMarketName || bc.marketName || '',
    runner: bc.runnerName || '',
    odds: bc.odds ?? '',
    edge: bc.edge ?? '',
    expectedROI: bc.expectedROI ?? '',
    confidence: bc.confidence ?? '',
    impliedProb: bc.impliedProbability ?? '',
    estProb: bc.estimatedProbability ?? '',
    liquidity: bc.liquidity ?? '',
    spread: bc.spread ?? '',
    score: bc.overallScore ?? '',
    dataSource: bc.dataSource || '',
    blocker: bc.mainBlocker || c.noBetReason || '',
    marketsScanned: c.marketsScanned ?? 0,
    marketsPassed: c.marketsPassedFilters ?? 0,
    runnersAssessed: ss.runnersAssessed ?? c.runnersAssessed ?? 0,
    passedLiquidity: ss.candidatesPassedLiquidity ?? c.candidatesPassedLiquidity ?? 0,
    passedOdds: ss.candidatesPassedOddsRange ?? c.candidatesPassedOddsRange ?? 0,
    passedEdge: ss.candidatesPassedEdge ?? c.candidatesPassedEdge ?? 0,
    passedROI: ss.candidatesPassedROI ?? c.candidatesPassedROI ?? 0,
    passedConfidence: ss.candidatesPassedConfidence ?? c.candidatesPassedConfidence ?? 0,
    signalsCreated: c.signalsCreated ?? 0,
    ordersCreated: c.ordersCreated ?? 0,
    notes: c.notes || '',
  };
}

export default function DecisionLogPanel() {
  const { botCycles, clearBotCycles } = useApp();

  const handleExport = () => {
    if (botCycles.length === 0) return;
    exportToCSV(`decision-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`, botCycles.map(cycleToRow), EXPORT_COLUMNS);
  };

  return (
    <Panel
      title={`Decision Log (${botCycles.length})`}
      action={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={botCycles.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button size="sm" variant="destructive" onClick={clearBotCycles} disabled={botCycles.length === 0}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear Log
          </Button>
        </div>
      }
    >
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
                <TableHead className="text-[10px] h-8 px-2">Market</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Decision</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Runner</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">Odds</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">Edge</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">ROI</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">Conf</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Blocker / Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {botCycles.map((c) => {
                const bc = c.bestCandidate || {};
                const isBet = c.ordersCreated > 0;
                const time = c.finishedAt || c.startedAt;
                return (
                  <TableRow key={c.id || c.cycleNumber}>
                    <TableCell className="text-xs px-2 py-1.5 font-mono font-bold">{c.cycleNumber}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {time ? new Date(time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 truncate max-w-[140px]">{c.selectedMarketName || bc.marketName || '—'}</TableCell>
                    <TableCell className="text-xs px-2 py-1.5">
                      <StatusBadge status={isBet ? 'ok' : 'danger'}>{isBet ? 'BET' : 'NO BET'}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 truncate max-w-[120px] font-medium">{bc.runnerName || '—'}</TableCell>
                    <TableCell className="text-xs px-2 py-1.5 text-right font-mono">{bc.odds != null ? bc.odds.toFixed(2) : '—'}</TableCell>
                    <TableCell className={`text-xs px-2 py-1.5 text-right font-mono ${bc.edge > 0 ? 'text-chart-1' : 'text-chart-5'}`}>{bc.edge != null ? fmtPct(bc.edge) : '—'}</TableCell>
                    <TableCell className={`text-xs px-2 py-1.5 text-right font-mono ${bc.expectedROI > 0 ? 'text-chart-1' : 'text-chart-5'}`}>{bc.expectedROI != null ? fmtPct(bc.expectedROI) : '—'}</TableCell>
                    <TableCell className="text-xs px-2 py-1.5 text-right font-mono">{bc.confidence != null ? fmtPct(bc.confidence) : '—'}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-muted-foreground truncate max-w-[180px]">{bc.mainBlocker || c.noBetReason || (isBet ? 'Bet placed' : '—')}</TableCell>
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