import React from 'react';
import { useApp } from '@/lib/AppContext';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { Panel } from '@/components/ui/workstation';
import { fmtMoney, fmtAge } from '@/lib/format';

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
  const lastError = auditLogs.find(l => l.severity === 'error' || l.severity === 'critical');
  const errorCount = auditLogs.filter(l => l.severity === 'error' || l.severity === 'critical').length;

  return (
    <div className="space-y-4">
      <Panel title="System" subtitle="Application and connection status">
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <DebugMetric label="App Version" value="v1.0" />
          <DebugMetric label="Build" value="edge-lab" />
          <DebugMetric label="API Status" value={apiConnected ? 'Connected' : 'Disconnected'} />
          <DebugMetric label="Stream Status" value={betfairConnection?.streamConnectionStatus || '—'} />
          <DebugMetric label="Scheduler" value={schedulerDiagnostics?.active ? 'Active' : 'Idle'} />
          <DebugMetric label="Tab Lease" value={schedulerDiagnostics?.browserTabId || '—'} />
          <DebugMetric label="Last Cycle" value={lastCycle ? `#${lastCycle.cycleNumber}` : '—'} />
          <DebugMetric label="Last Error" value={lastError ? lastError.action.slice(0, 20) : 'None'} />
          <DebugMetric label="Error Count" value={String(errorCount)} />
          <DebugMetric label="Data Age" value={fmtAge(betfairConnection?.lastActualPriceUpdateAt)} />
        </div>
      </Panel>
    </div>
  );
}