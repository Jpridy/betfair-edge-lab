import React, { useState } from 'react';
import { Play, Pause, Square, RefreshCw, Download, AlertOctagon, Zap, Clock, FileDown, CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/csvExport';

export default function ControlBar() {
  const {
    botState, startBot, pauseBot, stopBot, runDebugScanCycle,
    emergencyStop, triggerEmergencyStop, clearEmergencyStop,
    refreshBetfairData, refreshMarketState, botCycles, exchangeOpportunities, lastExchangeDiagnostics, paperOrders, markets,
    apiConnected,
  } = useApp();

  const [exporting, setExporting] = useState(false);
  const [debugRunning, setDebugRunning] = useState(false);
  const [refreshRunning, setRefreshRunning] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const isRunning = botState.running && !botState.paused && !emergencyStop;
  const isPaused = botState.paused && !emergencyStop;
  const lastCycle = botCycles[0];
  const lastDecision = lastCycle?.ordersCreated > 0 ? 'Bet' : lastCycle ? 'No bet' : 'No cycle yet';

  const handleDebugScan = async () => {
    setDebugRunning(true);
    setLastAction(null);
    try {
      await runDebugScanCycle();
      setLastAction({ type: 'debug', success: true, message: 'Debug scan completed — no orders placed', time: new Date().toISOString() });
    } catch (err) {
      setLastAction({ type: 'debug', success: false, message: err.message, time: new Date().toISOString() });
    } finally {
      setDebugRunning(false);
    }
  };

  const handleRefreshBetfair = async () => {
    setRefreshRunning(true);
    setLastAction(null);
    try {
      await refreshBetfairData();
      setLastAction({ type: 'refresh', success: true, message: 'Betfair catalogue refreshed', time: new Date().toISOString() });
    } catch (err) {
      setLastAction({ type: 'refresh', success: false, message: err.message, time: new Date().toISOString() });
    } finally {
      setRefreshRunning(false);
    }
  };

  const handleExportDebugBundle = () => {
    setExporting(true);
    try {
      const cycle = botCycles[0];
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
      const loadedMarkets = lastExchangeDiagnostics?.loadedMarketsTable || [];
      if (loadedMarkets.length > 0) {
        exportToCSV('latest-loaded-markets.csv', loadedMarkets);
      }
      const nearest = [...loadedMarkets].sort((a, b) => (a.secondsToJump ?? 99999) - (b.secondsToJump ?? 99999)).slice(0, 20);
      if (nearest.length > 0) {
        exportToCSV('latest-nearest-markets.csv', nearest);
      }
      if (paperOrders.length > 0) {
        exportToCSV('latest-paper-orders.csv', paperOrders.slice(0, 50).map(o => ({
          created_date: o.created_date || '', runnerName: o.runnerName || '', side: o.side || '',
          status: o.status || '', settlementStatus: o.settlementStatus || '', requestedOdds: o.requestedOdds || '', requestedStake: o.requestedStake || '',
          liability: o.liability || '', marketType: o.marketType || '', result: o.result || '',
          netProfit: o.netProfit || '', rejection_reason: o.rejection_reason || '',
          persistenceType: o.persistenceType || '', strategyName: o.strategyName || '',
          proofMode: o.proofMode || false, dataSource: o.dataSource || '',
          resultSource: o.resultSource || '', resultConfidence: o.resultConfidence || '',
        })));
      }
      const settledOrAwaiting = paperOrders.filter(o => o.status === 'settled' || o.status === 'awaiting_result' || o.settlementStatus);
      if (settledOrAwaiting.length > 0) {
        exportToCSV('latest-settlement.csv', settledOrAwaiting.slice(0, 50).map(o => ({
          orderId: o.id || o.customerRef || '', runnerName: o.runnerName || '', marketName: o.marketName || '',
          side: o.side || '', status: o.status || '', settlementStatus: o.settlementStatus || '',
          result: o.result || '', resultSource: o.resultSource || '', resultConfidence: o.resultConfidence || '',
          netProfit: o.netProfit ?? '', commission: o.commission ?? '',
          settledDate: o.settled_date || o.settledAt || '', placedDate: o.placed_date || o.created_date || '',
        })));
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="sticky top-14 z-20 glass-strong border border-border-subtle rounded-lg p-3 flex flex-wrap items-center gap-2 shadow-elevated">
      {/* Bot controls */}
      <div className="flex items-center gap-1.5">
        {!isRunning ? (
          <Button size="sm" variant="success" onClick={startBot} disabled={emergencyStop} className="gap-1.5 font-body font-semibold">
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

      {/* Divider */}
      <div className="h-6 w-px bg-border-subtle hidden md:block" />

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={handleDebugScan} disabled={emergencyStop || debugRunning} className="gap-1.5" title="Read-only diagnostic — does NOT create orders">
          {debugRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {debugRunning ? 'Scanning...' : 'Debug Scan'}
        </Button>
        <Button size="sm" variant="outline" onClick={handleRefreshBetfair} disabled={!apiConnected || refreshRunning} className="gap-1.5" title={apiConnected ? 'Fetch latest market catalogue from Betfair' : 'Betfair not connected'}>
          {refreshRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {refreshRunning ? 'Refreshing...' : 'Refresh Markets'}
        </Button>
        <Button size="sm" variant="outline" onClick={refreshMarketState} className="gap-1.5" title="Refresh local state timestamps only — does not call Betfair API">
          <RefreshCw className="h-4 w-4" /> Sync State
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportDebugBundle} disabled={!lastCycle || exporting} className="gap-1.5">
          {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Export
        </Button>
      </div>

      {/* Emergency stop */}
      <Button
        size="sm"
        variant={emergencyStop ? "outline" : "destructive"}
        onClick={emergencyStop ? clearEmergencyStop : triggerEmergencyStop}
        className={cn('gap-1.5 font-body font-semibold ml-auto', !emergencyStop && 'border border-danger/40 hover:glow-red')}
      >
        <AlertOctagon className="h-4 w-4" /> {emergencyStop ? 'CLEAR STOP' : 'EMERGENCY STOP'}
      </Button>

      {/* Status info row */}
      <div className="w-full flex items-center gap-4 pt-2.5 border-t border-border-subtle text-xs">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Last cycle:</span>
          {botState.lastCycleTime ? (
            <span className="font-mono tabular-nums font-semibold text-foreground">
              {new Date(botState.lastCycleTime).toLocaleTimeString('en-AU')}
            </span>
          ) : markets.length > 0 ? (
            <span className="text-[10px] text-info font-body">
              Markets loaded but not scanned yet — click Debug Scan or Run Proof Scan Now
            </span>
          ) : (
            <span className="font-mono tabular-nums font-semibold text-muted-foreground">Never</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Decision:</span>
          <span className={cn(
            'px-2 py-0.5 rounded-md text-[10px] font-body font-semibold border',
            lastDecision === 'Bet' ? 'bg-success/10 text-success border-success/25' : lastDecision === 'No bet' ? 'bg-warning/10 text-warning border-warning/25' : 'bg-muted text-muted-foreground border-border'
          )}>
            {lastDecision}
          </span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-muted-foreground">Next scan in:</span>
            <span className="font-mono tabular-nums font-bold text-primary">{botState.nextScanCountdown}s</span>
          </div>
        )}
        {lastAction && (
          <div className={cn(
            'flex items-center gap-1.5 ml-auto',
            lastAction.success ? 'text-success' : 'text-danger'
          )}>
            {lastAction.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            <span className="text-[10px]">{lastAction.message}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{new Date(lastAction.time).toLocaleTimeString('en-AU')}</span>
          </div>
        )}
      </div>
    </div>
  );
}