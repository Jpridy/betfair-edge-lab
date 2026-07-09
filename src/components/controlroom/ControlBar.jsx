import React, { useState } from 'react';
import { Play, Pause, Square, RefreshCw, Download, AlertOctagon, Zap, Clock, FileDown } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/csvExport';

export default function ControlBar() {
  const {
    botState, startBot, pauseBot, stopBot, runDebugScanCycle,
    emergencyStop, triggerEmergencyStop, clearEmergencyStop,
    refreshBetfairData, refreshMarketState, botCycles, exchangeOpportunities, lastExchangeDiagnostics, paperOrders, markets,
  } = useApp();

  const [exporting, setExporting] = useState(false);
  const isRunning = botState.running && !botState.paused && !emergencyStop;
  const isPaused = botState.paused && !emergencyStop;
  const lastCycle = botCycles[0];
  const lastDecision = lastCycle?.ordersCreated > 0 ? 'BET' : lastCycle?.noBetReason ? 'NO_BET' : lastCycle ? 'NO_BET' : '—';

  const handleExportDebugBundle = () => {
    setExporting(true);
    try {
      const cycle = botCycles[0];
      // 1. Latest cycle full row
      if (cycle) {
        exportToCSV(`latest-cycle.csv`, [{
          cycleNumber: cycle.cycleNumber, status: cycle.status, debugOnly: cycle.debugOnly || false,
          startedAt: cycle.startedAt, finishedAt: cycle.finishedAt,
          marketsScanned: cycle.marketsScanned, marketsPassedFilters: cycle.marketsPassedFilters,
          signalsCreated: cycle.signalsCreated, ordersCreated: cycle.ordersCreated, ordersBlocked: cycle.ordersBlocked,
          noBetReason: cycle.noBetReason || '', selectedMarket: cycle.selectedMarketName || '',
          bestCandidate: cycle.bestCandidate?.runnerName || '', bestCandidateSide: cycle.bestCandidate?.side || '',
          bestCandidateOdds: cycle.bestCandidate?.odds || '', bestCandidateEV: cycle.bestCandidate?.ev || '',
          bestCandidateROI: cycle.bestCandidate?.expectedROI || '', bestCandidateBlocker: cycle.bestCandidate?.failedGate || cycle.bestCandidate?.mainBlocker || '',
          notes: cycle.notes || '',
        }]);
      }
      // 2. Latest opportunities
      const opps = exchangeOpportunities?.length > 0 ? exchangeOpportunities : (lastCycle?.scanSummary?.topOpportunities || []);
      if (opps.length > 0) {
        exportToCSV('latest-opportunities.csv', opps.map(o => ({
          marketType: o.marketType || o.detectedMarketType || '', side: o.side || '', runner: o.runnerName || '',
          eventName: o.eventName || '', marketName: o.marketName || '', odds: o.odds || '',
          ev: o.ev || '', roi: o.roi || o.expectedROI || '', confidence: o.confidence || '',
          stake: o.stake || '', liability: o.liability || '', edge: o.edge || '',
          modelProbability: o.modelProbability || '', finalProbabilityUsedInEV: o.finalProbabilityUsedInEV || '',
          preSearchProbability: o.preSearchProbability || '', postSearchProbability: o.postSearchProbability || '',
          probabilityDelta: o.probabilityDelta || '', decisionImpact: o.decisionImpact || '',
          blocker: o.failedGate || o.mainBlocker || (o.blockers || []).join('; '), decision: o.decision || '',
        })));
      }
      // 3. Latest loaded markets
      const loadedMarkets = lastExchangeDiagnostics?.loadedMarketsTable || [];
      if (loadedMarkets.length > 0) {
        exportToCSV('latest-loaded-markets.csv', loadedMarkets);
      }
      // 4. Latest nearest markets (same as loaded but sorted by seconds to jump)
      const nearest = [...loadedMarkets].sort((a, b) => (a.secondsToJump ?? 99999) - (b.secondsToJump ?? 99999)).slice(0, 20);
      if (nearest.length > 0) {
        exportToCSV('latest-nearest-markets.csv', nearest);
      }
      // 5. Latest paper orders
      if (paperOrders.length > 0) {
        exportToCSV('latest-paper-orders.csv', paperOrders.slice(0, 50).map(o => ({
          created_date: o.created_date || '', runnerName: o.runnerName || '', side: o.side || '',
          status: o.status || '', requestedOdds: o.requestedOdds || '', requestedStake: o.requestedStake || '',
          liability: o.liability || '', marketType: o.marketType || '', result: o.result || '',
          netProfit: o.netProfit || '', rejection_reason: o.rejection_reason || '',
          persistenceType: o.persistenceType || '', strategyName: o.strategyName || '',
        })));
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="sticky top-16 z-20 bg-card/95 backdrop-blur border border-border rounded-xl p-3 flex flex-wrap items-center gap-2 shadow-lg">
      {/* Bot controls */}
      <div className="flex items-center gap-1.5">
        {!isRunning ? (
          <Button size="sm" onClick={startBot} disabled={emergencyStop} className="gap-1.5 bg-chart-1 hover:bg-chart-1/90 text-background font-bold">
            <Play className="h-4 w-4" /> START
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={isPaused ? startBot : pauseBot} className="gap-1.5">
            <Pause className="h-4 w-4" /> {isPaused ? 'RESUME' : 'PAUSE'}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={stopBot} disabled={!botState.running} className="gap-1.5">
          <Square className="h-4 w-4" /> STOP
        </Button>
      </div>

      {/* Mode badges */}
      <div className="flex items-center gap-1.5">
        <span className="px-2 py-1 rounded-md bg-chart-1/10 border border-chart-1/30 text-chart-1 text-[10px] font-bold">PAPER</span>
        <span className="px-2 py-1 rounded-md bg-muted border border-border text-muted-foreground text-[10px] font-bold">LIVE DISABLED</span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={runDebugScanCycle} disabled={emergencyStop} className="gap-1.5">
          <Zap className="h-4 w-4" /> Force Debug Scan
        </Button>
        <Button size="sm" variant="outline" onClick={refreshBetfairData} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh Betfair
        </Button>
        <Button size="sm" variant="outline" onClick={refreshMarketState} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh Local State
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportDebugBundle} disabled={!lastCycle || exporting} className="gap-1.5">
          <FileDown className="h-4 w-4" /> Export Debug Bundle
        </Button>
      </div>

      {/* Emergency stop */}
      <Button
        size="sm"
        onClick={emergencyStop ? clearEmergencyStop : triggerEmergencyStop}
        className={cn(
          'gap-1.5 font-bold ml-auto',
          emergencyStop
            ? 'bg-chart-1 hover:bg-chart-1/90 text-background'
            : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground border-2 border-destructive/50'
        )}
      >
        <AlertOctagon className="h-4 w-4" /> {emergencyStop ? 'CLEAR STOP' : 'EMERGENCY STOP'}
      </Button>

      {/* Status info */}
      <div className="w-full flex items-center gap-4 pt-2 border-t border-border text-xs">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Last cycle:</span>
          <span className="font-mono font-semibold text-foreground">
            {botState.lastCycleTime ? new Date(botState.lastCycleTime).toLocaleTimeString('en-AU') : 'Never'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Latest decision:</span>
          <span className={cn(
            'px-2 py-0.5 rounded text-[10px] font-bold',
            lastDecision === 'BET' ? 'bg-chart-1/10 text-chart-1' : 'bg-chart-4/10 text-chart-4'
          )}>
            {lastDecision}
          </span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-muted-foreground">Next scan in:</span>
            <span className="font-mono font-bold text-primary">{botState.nextScanCountdown}s</span>
          </div>
        )}
      </div>
    </div>
  );
}