import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, Trash2, FileText, ListChecks } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { exportToCSV } from '@/lib/csvExport';

const CYCLE_EXPORT_COLUMNS = [
  { key: 'cycleId', label: 'CycleId' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'openMarketsScanned', label: 'OpenMarketsScanned' },
  { key: 'winMarketsFound', label: 'WinMarketsFound' },
  { key: 'placeMarketsFound', label: 'PlaceMarketsFound' },
  { key: 'h2hMarketsFound', label: 'H2HMarketsFound' },
  { key: 'unknownMarketsFound', label: 'UnknownMarketsFound' },
  { key: 'raceClustersCreated', label: 'RaceClustersCreated' },
  { key: 'opportunitiesGenerated', label: 'OpportunitiesGenerated' },
  { key: 'backOpportunities', label: 'BackOpportunities' },
  { key: 'layOpportunities', label: 'LayOpportunities' },
  { key: 'positiveEvOpportunities', label: 'PositiveEvOpportunities' },
  { key: 'rejectedOpportunities', label: 'RejectedOpportunities' },
  { key: 'selectedOpportunityId', label: 'SelectedOpportunityId' },
  { key: 'marketId', label: 'MarketId' },
  { key: 'eventName', label: 'EventName' },
  { key: 'marketName', label: 'MarketName' },
  { key: 'marketTypeCode', label: 'MarketTypeCode' },
  { key: 'detectedMarketType', label: 'DetectedMarketType' },
  { key: 'side', label: 'Side' },
  { key: 'runnerName', label: 'RunnerName' },
  { key: 'selectionId', label: 'SelectionId' },
  { key: 'opponentSelectionId', label: 'OpponentSelectionId' },
  { key: 'odds', label: 'Odds' },
  { key: 'availableSize', label: 'AvailableSize' },
  { key: 'modelProbability', label: 'ModelProbability' },
  { key: 'impliedProbability', label: 'ImpliedProbability' },
  { key: 'breakevenProbability', label: 'BreakevenProbability' },
  { key: 'fairOdds', label: 'FairOdds' },
  { key: 'edge', label: 'Edge' },
  { key: 'ev', label: 'EV' },
  { key: 'roi', label: 'ROI' },
  { key: 'commissionRate', label: 'CommissionRate' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'dataQuality', label: 'DataQuality' },
  { key: 'spreadTicks', label: 'SpreadTicks' },
  { key: 'delayRiskScore', label: 'DelayRiskScore' },
  { key: 'fillProbability', label: 'FillProbability' },
  { key: 'stake', label: 'Stake' },
  { key: 'liability', label: 'Liability' },
  { key: 'maxProfit', label: 'MaxProfit' },
  { key: 'maxLoss', label: 'MaxLoss' },
  { key: 'failedGate', label: 'FailedGate' },
  { key: 'blocker', label: 'Blocker' },
  { key: 'decision', label: 'Decision' },
  { key: 'aiCacheHit', label: 'AICacheHit' },
  { key: 'aiCacheMiss', label: 'AICacheMiss' },
  { key: 'aiCallsMade', label: 'AICallsMade' },
  { key: 'orderCreated', label: 'OrderCreated' },
  { key: 'settlementStatus', label: 'SettlementStatus' },
];

const OPPORTUNITY_EXPORT_COLUMNS = [
  { key: 'cycleId', label: 'CycleId' },
  { key: 'rank', label: 'Rank' },
  { key: 'opportunityId', label: 'OpportunityId' },
  { key: 'eventName', label: 'EventName' },
  { key: 'marketName', label: 'MarketName' },
  { key: 'marketTypeCode', label: 'MarketTypeCode' },
  { key: 'detectedMarketType', label: 'DetectedMarketType' },
  { key: 'marketStartTime', label: 'MarketStartTime' },
  { key: 'side', label: 'Side' },
  { key: 'runnerName', label: 'RunnerName' },
  { key: 'selectionId', label: 'SelectionId' },
  { key: 'opponentSelectionId', label: 'OpponentSelectionId' },
  { key: 'odds', label: 'Odds' },
  { key: 'availableSize', label: 'AvailableSize' },
  { key: 'bestBackPrice', label: 'BestBackPrice' },
  { key: 'bestLayPrice', label: 'BestLayPrice' },
  { key: 'bestBackSize', label: 'BestBackSize' },
  { key: 'bestLaySize', label: 'BestLaySize' },
  { key: 'spreadTicks', label: 'SpreadTicks' },
  { key: 'modelProbability', label: 'ModelProbability' },
  { key: 'impliedProbability', label: 'ImpliedProbability' },
  { key: 'breakevenProbability', label: 'BreakevenProbability' },
  { key: 'fairOdds', label: 'FairOdds' },
  { key: 'edge', label: 'Edge' },
  { key: 'ev', label: 'EV' },
  { key: 'roi', label: 'ROI' },
  { key: 'commissionRate', label: 'CommissionRate' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'dataQuality', label: 'DataQuality' },
  { key: 'dataSource', label: 'DataSource' },
  { key: 'delayRiskScore', label: 'DelayRiskScore' },
  { key: 'fillProbability', label: 'FillProbability' },
  { key: 'stake', label: 'Stake' },
  { key: 'liability', label: 'Liability' },
  { key: 'maxProfit', label: 'MaxProfit' },
  { key: 'maxLoss', label: 'MaxLoss' },
  { key: 'failedGate', label: 'FailedGate' },
  { key: 'blocker', label: 'Blocker' },
  { key: 'blockers', label: 'Blockers' },
  { key: 'decision', label: 'Decision' },
  { key: 'rejectionCategory', label: 'RejectionCategory' },
];

function num(v) {
  return v === null || v === undefined || v === '' ? '' : v;
}

function cycleToRow(c) {
  const ss = c.scanSummary || {};
  const bc = c.bestCandidate || {};

  return {
    cycleId: c.cycleNumber,
    timestamp: c.finishedAt || c.startedAt || '',
    openMarketsScanned: c.marketsScanned ?? ss.marketsScanned ?? 0,
    winMarketsFound: ss.winMarketsFound ?? 0,
    placeMarketsFound: ss.placeMarketsFound ?? 0,
    h2hMarketsFound: ss.h2hMarketsFound ?? 0,
    unknownMarketsFound: ss.unknownMarketsFound ?? 0,
    raceClustersCreated: ss.raceClustersCreated ?? ss.eventsScanned ?? 0,
    opportunitiesGenerated: ss.totalOpportunities ?? 0,
    backOpportunities: ss.backOpportunities ?? 0,
    layOpportunities: ss.layOpportunities ?? 0,
    positiveEvOpportunities: ss.positiveEVOpportunities ?? 0,
    rejectedOpportunities: ss.rejectedOpportunities ?? 0,
    selectedOpportunityId: bc.opportunityId || '',
    marketId: bc.betfairMarketId || bc.marketId || '',
    eventName: bc.eventName || '',
    marketName: bc.marketName || c.selectedMarketName || '',
    marketTypeCode: bc.marketTypeCode || '',
    detectedMarketType: bc.marketType || bc.detectedMarketType || '',
    side: bc.side || '',
    runnerName: bc.runnerName || '',
    selectionId: bc.selectionId || '',
    opponentSelectionId: bc.opponentSelectionId || '',
    odds: num(bc.odds),
    availableSize: num(bc.liquidity ?? bc.availableSize),
    modelProbability: num(bc.estimatedProbability ?? bc.modelProbability),
    impliedProbability: num(bc.impliedProbability),
    breakevenProbability: num(bc.breakevenProbability),
    fairOdds: num(bc.fairOdds),
    edge: num(bc.edge),
    ev: num(bc.ev),
    roi: num(bc.expectedROI ?? bc.roi),
    commissionRate: num(bc.commissionRate),
    confidence: num(bc.confidence),
    dataQuality: num(bc.dataQuality),
    spreadTicks: num(bc.spread ?? bc.spreadTicks),
    delayRiskScore: num(bc.delayRiskScore),
    fillProbability: num(bc.fillProbability),
    stake: num(bc.stake),
    liability: num(bc.liability),
    maxProfit: num(bc.maxProfit),
    maxLoss: num(bc.maxLoss),
    failedGate: bc.failedGate || bc.mainBlocker || '',
    blocker: bc.mainBlocker || bc.failedGate || c.noBetReason || '',
    decision: c.ordersCreated > 0 ? 'BET' : 'NO_BET',
    aiCacheHit: ss.aiCacheHits ?? ss.cacheHits ?? 0,
    aiCacheMiss: ss.aiCallsMade ?? ss.eventsWithAI ?? 0,
    aiCallsMade: ss.aiCallsMade ?? ss.eventsWithAI ?? 0,
    orderCreated: c.ordersCreated ?? 0,
    settlementStatus: c.status || '',
  };
}

function opportunitiesToRows(cycle) {
  const ss = cycle.scanSummary || {};
  const topOpps = ss.topOpportunities || [];
  const topRejected = ss.topRejected || [];
  const rows = [];

  topOpps.forEach((opp, i) => {
    rows.push({
      cycleId: cycle.cycleNumber,
      rank: i + 1,
      opportunityId: opp.opportunityId || '',
      eventName: opp.eventName || '',
      marketName: opp.marketName || '',
      marketTypeCode: opp.marketTypeCode || '',
      detectedMarketType: opp.detectedMarketType || opp.marketType || '',
      marketStartTime: opp.marketStartTime || '',
      side: opp.side || '',
      runnerName: opp.runnerName || '',
      selectionId: opp.selectionId || '',
      opponentSelectionId: opp.opponentSelectionId || '',
      odds: num(opp.odds),
      availableSize: num(opp.availableSize),
      bestBackPrice: num(opp.bestBackPrice),
      bestLayPrice: num(opp.bestLayPrice),
      bestBackSize: num(opp.bestBackSize),
      bestLaySize: num(opp.bestLaySize),
      spreadTicks: num(opp.spreadTicks),
      modelProbability: num(opp.modelProbability),
      impliedProbability: num(opp.impliedProbability),
      breakevenProbability: num(opp.breakevenProbability),
      fairOdds: num(opp.fairOdds),
      edge: num(opp.edge),
      ev: num(opp.ev),
      roi: num(opp.roi),
      commissionRate: num(opp.commissionRate),
      confidence: num(opp.confidence),
      dataQuality: num(opp.dataQuality),
      dataSource: opp.dataSource || '',
      delayRiskScore: num(opp.delayRiskScore),
      fillProbability: num(opp.fillProbability),
      stake: num(opp.stake),
      liability: num(opp.liability),
      maxProfit: num(opp.maxProfit),
      maxLoss: num(opp.maxLoss),
      failedGate: opp.failedGate || opp.blocker || '',
      blocker: opp.blocker || opp.failedGate || '',
      blockers: (opp.blockers || []).join('; '),
      decision: opp.decision || '',
      rejectionCategory: opp.decision === 'NO_BET' ? 'rejected' : 'accepted',
    });
  });

  topRejected.forEach((opp, i) => {
    if (rows.some(r => r.opportunityId === opp.opportunityId)) return;
    rows.push({
      cycleId: cycle.cycleNumber,
      rank: topOpps.length + i + 1,
      opportunityId: opp.opportunityId || `rejected_${i}`,
      eventName: opp.eventName || '',
      marketName: opp.marketName || '',
      marketTypeCode: opp.marketTypeCode || '',
      detectedMarketType: opp.detectedMarketType || opp.marketType || '',
      marketStartTime: opp.marketStartTime || '',
      side: opp.side || '',
      runnerName: opp.runnerName || '',
      selectionId: opp.selectionId || '',
      opponentSelectionId: opp.opponentSelectionId || '',
      odds: num(opp.odds),
      availableSize: num(opp.availableSize),
      bestBackPrice: num(opp.bestBackPrice),
      bestLayPrice: num(opp.bestLayPrice),
      bestBackSize: num(opp.bestBackSize),
      bestLaySize: num(opp.bestLaySize),
      spreadTicks: num(opp.spreadTicks),
      modelProbability: num(opp.modelProbability),
      impliedProbability: num(opp.impliedProbability),
      breakevenProbability: num(opp.breakevenProbability),
      fairOdds: num(opp.fairOdds),
      edge: num(opp.edge),
      ev: num(opp.ev),
      roi: num(opp.roi),
      commissionRate: num(opp.commissionRate),
      confidence: num(opp.confidence),
      dataQuality: num(opp.dataQuality),
      dataSource: opp.dataSource || '',
      delayRiskScore: num(opp.delayRiskScore),
      fillProbability: num(opp.fillProbability),
      stake: num(opp.stake),
      liability: num(opp.liability),
      maxProfit: num(opp.maxProfit),
      maxLoss: num(opp.maxLoss),
      failedGate: opp.failedGate || opp.blocker || '',
      blocker: opp.blocker || opp.failedGate || '',
      blockers: (opp.blockers || []).join('; '),
      decision: 'NO_BET',
      rejectionCategory: 'rejected',
    });
  });

  return rows;
}

export default function DecisionLogPanel() {
  const { botCycles, clearBotCycles } = useApp();

  const handleExportCycles = () => {
    if (botCycles.length === 0) return;
    exportToCSV(
      `decision-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      botCycles.map(cycleToRow),
      CYCLE_EXPORT_COLUMNS
    );
  };

  const handleExportOpportunities = () => {
    if (botCycles.length === 0) return;
    const rows = botCycles.flatMap(opportunitiesToRows);
    if (rows.length === 0) return;
    exportToCSV(
      `opportunities-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      rows,
      OPPORTUNITY_EXPORT_COLUMNS
    );
  };

  return (
    <Panel
      title={`Decision Log (${botCycles.length})`}
      action={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportOpportunities} disabled={botCycles.length === 0}>
            <ListChecks className="h-3.5 w-3.5" />
            Export Opportunities
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCycles} disabled={botCycles.length === 0}>
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
                <TableHead className="text-[10px] h-8 px-2 text-right">Mkts</TableHead>
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
                const bc = c.bestCandidate || {};
                const isBet = c.ordersCreated > 0;
                const time = c.finishedAt || c.startedAt;
                const aiHits = ss.aiCacheHits ?? ss.cacheHits ?? 0;
                const aiCalls = ss.aiCallsMade ?? ss.eventsWithAI ?? 0;
                const aiLabel = ss.aiDisabled ? 'OFF' : (aiHits > 0 ? `${aiHits}H` : `${aiCalls}C`);
                return (
                  <TableRow key={c.id || c.cycleNumber}>
                    <TableCell className="text-xs px-2 py-1.5 font-mono font-bold">{c.cycleNumber}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {time ? new Date(time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 text-right font-mono">{c.marketsScanned ?? ss.marketsScanned ?? 0}</TableCell>
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
                    <TableCell className={`text-xs px-2 py-1.5 text-right font-mono ${bc.ev > 0 ? 'text-chart-1' : 'text-chart-5'}`}>
                      {bc.ev != null ? `$${bc.ev.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-right font-mono text-muted-foreground">{aiLabel}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-muted-foreground truncate max-w-[180px]">
                      {bc.mainBlocker || c.noBetReason || (isBet ? 'Bet placed' : '—')}
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