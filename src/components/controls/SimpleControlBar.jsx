import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import useAuthoritativeTradingState from '@/hooks/useAuthoritativeTradingState';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Play, Pause, Square, RefreshCw, AlertOctagon, CheckCircle2, ShieldCheck } from 'lucide-react';

function ActionButton({ title, desc, icon: Icon, primary, danger, disabled, loading, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'group flex min-h-[76px] items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        primary && !danger && 'border-primary/35 bg-primary/10 hover:bg-primary/15',
        danger && 'border-danger/35 bg-danger/10 text-danger hover:bg-danger/15',
        !primary && !danger && 'border-border-subtle bg-muted/15 hover:bg-hover/70',
      )}
    >
      <span className={cn(
        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
        primary && !danger ? 'border-primary/25 bg-primary/12 text-primary' : danger ? 'border-danger/25 bg-danger/12 text-danger' : 'border-border bg-card text-muted-foreground',
      )}>
        <Icon className={cn('h-4 w-4', loading && 'animate-spin')} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{children || title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

export default function SimpleControlBar() {
  const { botState, startBot, pauseBot, stopBot, runManualScan, runSettlementCheckNow, settlementRunning, emergencyStop, triggerEmergencyStop, clearEmergencyStop } = useApp();
  const state = useAuthoritativeTradingState();
  const [scanBusy, setScanBusy] = useState(false);
  const running = botState.running && !botState.paused;
  const ready = state.apiConnectionStatus === 'CONNECTED' && state.priceFeedStatus === 'LIVE' && !emergencyStop;

  const handleScan = async () => {
    setScanBusy(true);
    try { await runManualScan(); } finally { setScanBusy(false); }
  };

  return (
    <Panel title="Paper Bot Controls" subtitle="One main action, then small safe actions. Nothing here places real Betfair bets.">
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/6 px-3 py-2 text-xs text-success">
          <ShieldCheck className="h-4 w-4" />
          <span className="font-semibold">Paper-only mode is locked.</span>
          <span className="text-muted-foreground">All actions are simulator actions.</span>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <ActionButton
            title={running ? 'Stop Paper Bot' : 'Start Paper Bot'}
            desc={running ? 'Stops automatic scanning after the current safe step finishes.' : ready ? 'Starts scanning live markets for paper-only candidates.' : 'Connect Betfair and wait for LIVE prices first.'}
            icon={running ? Square : Play}
            primary
            danger={running}
            onClick={running ? stopBot : startBot}
            disabled={emergencyStop || (!running && !ready)}
          />
          <ActionButton
            title={botState.paused ? 'Resume' : 'Pause'}
            desc={botState.paused ? 'Continue scanning.' : 'Temporarily stop new scans without clearing state.'}
            icon={botState.paused ? Play : Pause}
            onClick={botState.paused ? startBot : pauseBot}
            disabled={!botState.running || emergencyStop}
          />
          <ActionButton title="Run Scan Now" desc="Manually scan the current race once." icon={RefreshCw} onClick={handleScan} disabled={scanBusy || emergencyStop} loading={scanBusy} />
          <ActionButton title="Settle Now" desc="Check due paper orders. Future races are skipped." icon={CheckCircle2} onClick={runSettlementCheckNow} disabled={settlementRunning} loading={settlementRunning} />
          <ActionButton
            title={emergencyStop ? 'Clear Stop' : 'Emergency Stop'}
            desc={emergencyStop ? 'Re-enable paper controls after checking the issue.' : 'Immediately stop scanning and cancel unsafe actions.'}
            icon={AlertOctagon}
            danger={!emergencyStop}
            onClick={emergencyStop ? clearEmergencyStop : triggerEmergencyStop}
          />
        </div>
      </div>
    </Panel>
  );
}
