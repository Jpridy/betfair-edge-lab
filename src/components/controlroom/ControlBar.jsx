import React from 'react';
import { Play, Pause, Square, RefreshCw, Download, AlertOctagon, Zap, Clock } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/csvExport';

export default function ControlBar() {
  const {
    botState, startBot, pauseBot, stopBot, runManualScan,
    emergencyStop, triggerEmergencyStop, clearEmergencyStop,
    refreshMarketState, botCycles,
  } = useApp();

  const isRunning = botState.running && !botState.paused && !emergencyStop;
  const isPaused = botState.paused && !emergencyStop;
  const lastCycle = botCycles[0];
  const lastDecision = lastCycle?.ordersCreated > 0 ? 'BET' : lastCycle?.noBetReason ? 'NO_BET' : lastCycle ? 'NO_BET' : '—';

  const handleExportLogs = () => {
    const cycle = botCycles[0];
    if (!cycle) return;
    const row = {
      cycleNumber: cycle.cycleNumber,
      status: cycle.status,
      startedAt: cycle.startedAt,
      finishedAt: cycle.finishedAt,
      marketsScanned: cycle.marketsScanned,
      marketsPassedFilters: cycle.marketsPassedFilters,
      signalsCreated: cycle.signalsCreated,
      ordersCreated: cycle.ordersCreated,
      ordersBlocked: cycle.ordersBlocked,
      noBetReason: cycle.noBetReason || '',
      selectedMarket: cycle.selectedMarketName || '',
      bestCandidate: cycle.bestCandidate?.runnerName || '',
      notes: cycle.notes || '',
    };
    exportToCSV(`bot-cycle-${cycle.cycleNumber}.csv`, [row]);
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
        <Button size="sm" variant="outline" onClick={runManualScan} disabled={emergencyStop} className="gap-1.5">
          <Zap className="h-4 w-4" /> Force Scan
        </Button>
        <Button size="sm" variant="outline" onClick={refreshMarketState} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh Data
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportLogs} disabled={!lastCycle} className="gap-1.5">
          <Download className="h-4 w-4" /> Export Logs
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