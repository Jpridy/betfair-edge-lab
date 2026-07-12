import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { CompactMetric } from '@/components/ui/workstation';
import { fmtAge } from '@/lib/format';

export default function BotHealthPanel() {
  const { botState, botCycles, schedulerDiagnostics, settlementRunning, calibration } = useApp();
  const lastCycle = botCycles[0];
  const lastSuccessful = botCycles.find(c => c.status === 'completed');
  const duplicateSkips = schedulerDiagnostics?.duplicateSkips || 0;
  const calibrationState = calibration?.state || 'NOT_ENOUGH_DATA';

  return (
    <Panel title="Bot Health" subtitle="Scheduler, settlement, and calibration">
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
        <CompactMetric label="Current Cycle" value={botState.cycleNumber > 0 ? `#${botState.cycleNumber}` : '—'} />
        <CompactMetric label="Bot State" value={botState.running ? (botState.paused ? 'Paused' : 'Running') : 'Stopped'} tone={botState.running && !botState.paused ? 'success' : undefined} />
        <CompactMetric label="Next Scan" value={botState.running ? `${botState.nextScanCountdown}s` : '—'} />
        <CompactMetric label="Last Successful" value={lastSuccessful ? `#${lastSuccessful.cycleNumber}` : '—'} />
        <CompactMetric label="Last Cycle" value={lastCycle ? fmtAge(lastCycle.finishedAt || lastCycle.startedAt) : '—'} />
        <CompactMetric label="Duplicate Skips" value={String(duplicateSkips)} />
        <CompactMetric label="Settlement Worker" value={settlementRunning ? 'Running' : 'Idle'} tone={settlementRunning ? 'warning' : undefined} />
        <CompactMetric label="Calibration" value={calibrationState.replace(/_/g, ' ')} />
        <CompactMetric label="Last Error" value={lastCycle?.status === 'failed' ? 'See cycle' : 'None'} tone={lastCycle?.status === 'failed' ? 'danger' : undefined} />
      </div>
    </Panel>
  );
}