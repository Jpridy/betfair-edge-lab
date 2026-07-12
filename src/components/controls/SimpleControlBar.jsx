import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, RefreshCw, AlertOctagon, CheckCircle2 } from 'lucide-react';

export default function SimpleControlBar() {
  const { botState, startBot, pauseBot, stopBot, runManualScan, runSettlementCheckNow, settlementRunning, emergencyStop, triggerEmergencyStop, clearEmergencyStop } = useApp();
  const [scanBusy, setScanBusy] = useState(false);
  const running = botState.running && !botState.paused;

  const handleScan = async () => {
    setScanBusy(true);
    try { await runManualScan(); } finally { setScanBusy(false); }
  };

  return (
    <Panel title="Controls" subtitle="Start, stop, scan, or settle the paper bot">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Button
            size="lg"
            className="col-span-2 md:col-span-1"
            variant={running ? 'destructive' : 'default'}
            onClick={running ? stopBot : startBot}
            disabled={emergencyStop}
          >
            {running ? <><Square className="h-4 w-4" /> Stop Bot</> : <><Play className="h-4 w-4" /> Start Bot</>}
          </Button>
          <Button size="lg" variant="outline" onClick={botState.paused ? startBot : pauseBot} disabled={!botState.running || emergencyStop}>
            {botState.paused ? <><Play className="h-4 w-4" /> Resume</> : <><Pause className="h-4 w-4" /> Pause</>}
          </Button>
          <Button size="lg" variant="outline" onClick={handleScan} disabled={scanBusy || emergencyStop}>
            <RefreshCw className={`h-4 w-4 ${scanBusy ? 'animate-spin' : ''}`} /> Scan Now
          </Button>
          <Button size="lg" variant="outline" onClick={runSettlementCheckNow} disabled={settlementRunning}>
            <CheckCircle2 className={`h-4 w-4 ${settlementRunning ? 'animate-spin' : ''}`} /> Settle Now
          </Button>
          <Button size="lg" variant={emergencyStop ? 'outline' : 'destructive'} onClick={emergencyStop ? clearEmergencyStop : triggerEmergencyStop}>
            <AlertOctagon className="h-4 w-4" /> {emergencyStop ? 'Clear Stop' : 'Emergency Stop'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}