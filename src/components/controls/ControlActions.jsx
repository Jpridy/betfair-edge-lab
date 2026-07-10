import React, { useState } from 'react';
import { Play, Pause, Square, RefreshCw, AlertOctagon } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';

export default function ControlActions() {
  const { botState, startBot, pauseBot, stopBot, runManualScan, refreshBetfairData, emergencyStop, triggerEmergencyStop, clearEmergencyStop, apiConnected } = useApp();
  const [busy, setBusy] = useState(null);
  const run = async (name, action) => { setBusy(name); await Promise.resolve(action()); setBusy(null); };
  const running = botState.running && !botState.paused;
  return <Panel title="System Controls" subtitle="Operational actions for the paper-trading system">
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={startBot} disabled={running || emergencyStop}><Play />{botState.paused ? 'Resume Bot' : 'Start Bot'}</Button>
        <Button variant="outline" onClick={pauseBot} disabled={!running}><Pause />Pause</Button>
        <Button variant="outline" onClick={stopBot} disabled={!botState.running}><Square />Stop</Button>
        <Button variant="outline" onClick={() => run('scan', runManualScan)} disabled={busy || emergencyStop}><RefreshCw className={busy === 'scan' ? 'animate-spin' : ''} />Run Manual Scan</Button>
        <Button variant="outline" onClick={() => run('refresh', refreshBetfairData)} disabled={busy || !apiConnected}><RefreshCw className={busy === 'refresh' ? 'animate-spin' : ''} />Refresh Markets</Button>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <div><div className="font-medium">Emergency Stop</div><div className="text-sm text-muted-foreground">Stops scanning and cancels unmatched paper orders.</div></div>
        <Button variant={emergencyStop ? 'outline' : 'destructive'} onClick={emergencyStop ? clearEmergencyStop : triggerEmergencyStop}><AlertOctagon />{emergencyStop ? 'Clear Stop' : 'Emergency Stop'}</Button>
      </div>
    </div>
  </Panel>;
}