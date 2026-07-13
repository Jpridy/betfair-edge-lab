import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { fmtAge } from '@/lib/format';

function DebugMetric({ label, value, mono = true }) {
  return (
    <div className="rounded-md border border-border-subtle bg-muted/20 p-2.5">
      <div className="text-[10px] uppercase tracking-label text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${mono ? 'font-mono tabular-nums' : ''} text-foreground`}>{value ?? '—'}</div>
    </div>
  );
}

export default function DebugSystem() {
  const { apiConnected, betfairConnection, botState, botCycles, schedulerDiagnostics, auditLogs } = useApp();
  const lastCycle = botCycles[0];
  const lastError = auditLogs.find(log => log.severity === 'error' || log.severity === 'critical');
  const errorCount = auditLogs.filter(log => log.severity === 'error' || log.severity === 'critical').length;
  const schedulerState = schedulerDiagnostics?.runInProgress
    ? 'Cycle running'
    : botState.running
      ? 'Waiting for next scan'
      : 'Stopped';

  return (
    <div className="space-y-4">
      <Panel title="System" subtitle="Application, scheduler and connection status">
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 lg:grid-cols-5">
          <DebugMetric label="App Version" value="v1.0" />
          <DebugMetric label="Mode" value="Paper only" />
          <DebugMetric label="API Status" value={apiConnected ? 'Connected' : 'Disconnected'} />
          <DebugMetric label="Stream Status" value={betfairConnection?.streamConnectionStatus || '—'} />
          <DebugMetric label="Scheduler" value={schedulerState} />
          <DebugMetric label="Scheduler Instance" value={schedulerDiagnostics?.schedulerInstanceId || '—'} />
          <DebugMetric label="Browser Tab" value={schedulerDiagnostics?.browserTabId || '—'} />
          <DebugMetric label="Active Run Key" value={schedulerDiagnostics?.activeCycleRunKey || '—'} />
          <DebugMetric label="Last Cycle" value={lastCycle ? `#${lastCycle.cycleNumber}` : '—'} />
          <DebugMetric label="Last Error" value={lastError ? String(lastError.action).slice(0, 40) : 'None'} mono={false} />
          <DebugMetric label="Error Count" value={String(errorCount)} />
          <DebugMetric label="Price Data Age" value={fmtAge(betfairConnection?.lastActualPriceUpdateAt)} />
        </div>
      </Panel>
    </div>
  );
}
