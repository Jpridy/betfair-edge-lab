import React, { useState } from 'react';
import { Play, Pause, Square, RefreshCw, AlertOctagon, Database } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';

export default function ControlActions() {
  const { botState, startBot, pauseBot, stopBot, runManualScan, refreshBetfairData, emergencyStop, triggerEmergencyStop, clearEmergencyStop, apiConnected } = useApp();
  const [busy, setBusy] = useState(null);
  const run = async (name, action) => { setBusy(name); await Promise.resolve(action()); setBusy(null); };
  const running = botState.running && !botState.paused;
  const botLabel = emergencyStop ? 'Emergency stopped' : running ? 'Running' : botState.paused ? 'Paused' : 'Stopped';
  const botTone = emergencyStop ? 'danger' : running ? 'ok' : botState.paused ? 'warning' : 'neutral';
  return <Panel title="System Controls" subtitle="Run the bot, refresh its data, or stop activity safely" action={<div className="flex gap-2"><StatusBadge status={apiConnected ? 'ok' : 'warning'}>{apiConnected ? 'Data connected' : 'Data offline'}</StatusBadge><StatusBadge status={botTone}>{botLabel}</StatusBadge></div>}>
    <div className="space-y-5 p-4">
      <section aria-labelledby="bot-lifecycle-heading">
        <div className="mb-2"><h4 id="bot-lifecycle-heading" className="text-sm font-semibold text-foreground">Bot lifecycle</h4><p className="text-xs text-muted-foreground">Start with the primary action, then pause or stop when needed.</p></div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button className="w-full" onClick={startBot} disabled={running || emergencyStop}><Play />{botState.paused ? 'Resume Bot' : 'Start Bot'}</Button>
          <Button className="w-full" variant="outline" onClick={pauseBot} disabled={!running}><Pause />Pause Bot</Button>
          <Button className="w-full" variant="outline" onClick={stopBot} disabled={!botState.running}><Square />Stop Bot</Button>
        </div>
      </section>
      <section aria-labelledby="data-actions-heading" className="border-t border-border-subtle pt-4">
        <div className="mb-2"><h4 id="data-actions-heading" className="text-sm font-semibold text-foreground">Market workflow</h4><p className="text-xs text-muted-foreground">Refresh Betfair data before running a new manual scan.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="w-full" variant="outline" onClick={() => run('refresh', refreshBetfairData)} disabled={busy || !apiConnected}><Database className={busy === 'refresh' ? 'animate-pulse' : ''} />{busy === 'refresh' ? 'Refreshing Markets...' : '1. Refresh Markets'}</Button>
          <Button className="w-full" variant="outline" onClick={() => run('scan', runManualScan)} disabled={busy || emergencyStop}><RefreshCw className={busy === 'scan' ? 'animate-spin' : ''} />{busy === 'scan' ? 'Scanning...' : '2. Run Manual Scan'}</Button>
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-danger/20 bg-danger/5 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h4 className="text-sm font-semibold text-foreground">Emergency control</h4><p className="text-xs text-muted-foreground">Stops scanning and cancels unmatched paper orders.</p></div>
        <Button className="sm:min-w-40" variant={emergencyStop ? 'outline' : 'destructive'} onClick={emergencyStop ? clearEmergencyStop : triggerEmergencyStop}><AlertOctagon />{emergencyStop ? 'Clear Emergency Stop' : 'Emergency Stop'}</Button>
      </section>
    </div>
  </Panel>;
}