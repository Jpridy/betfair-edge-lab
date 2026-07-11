import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';

export default function SettlementWorkerPanel() {
  const { runSettlementCheckNow, settlementReport, settlementRunning } = useApp();
  const report = settlementReport || {};
  const metrics = [['Orders checked', report.ordersChecked], ['Markets checked', report.marketsChecked], ['Still open', report.marketsStillOpen], ['Markets closed', report.marketsClosed], ['Orders settled', report.ordersSettled], ['Orders voided', report.ordersVoided], ['Unresolved', report.ordersUnresolved], ['Errors', report.errors]];
  return <Panel title="Orders & Settlement" subtitle="Independent database settlement worker" action={<Button size="sm" onClick={runSettlementCheckNow} disabled={settlementRunning}><RefreshCw className={settlementRunning ? 'animate-spin' : ''} />Settle Now</Button>}>
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">{metrics.map(([label,value]) => <div key={label} className="rounded-md border border-border-subtle bg-muted/30 p-2"><div className="text-[10px] text-muted-foreground">{label}</div><div className="font-mono font-semibold">{value ?? 0}</div></div>)}</div>
      <div className="text-xs text-muted-foreground">Latest check: {report.checkedAt ? new Date(report.checkedAt).toLocaleString('en-AU') : 'Not run'}</div>
      {report.unresolved?.length > 0 && <div className="space-y-1">{report.unresolved.map(item => <div key={`${item.orderId}-${item.reason}`} className="rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">{item.runnerName || item.orderId}: {item.reason}</div>)}</div>}
      {report.errorMessages?.length > 0 && <div className="space-y-1">{report.errorMessages.map((message,index) => <div key={index} className="text-xs text-danger">{message}</div>)}</div>}
    </div>
  </Panel>;
}