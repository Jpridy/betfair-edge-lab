import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, SideBadge, StatusBadge } from '@/components/ui/Trading';

export default function DashboardActivity() {
  const { strategySignals, paperOrders } = useApp();
  const signal = strategySignals[0];
  const order = paperOrders[0];
  return <div className="grid gap-4 lg:grid-cols-2">
    <Panel title="Latest Signal"><div className="p-4 text-sm">{signal ? <div className="space-y-2">
      <div className="flex items-center gap-2"><SideBadge side={signal.side || 'BACK'} /><span className="font-medium">{signal.runnerName || signal.runnerId}</span><StatusBadge status={signal.signalStatus === 'executed' ? 'ok' : 'warning'}>{signal.signalStatus}</StatusBadge></div>
      <div className="text-muted-foreground">{signal.reason || signal.blocker || 'Signal recorded'}</div>
    </div> : <div className="text-muted-foreground">No signals have been created.</div>}</div></Panel>
    <Panel title="Latest Paper Order"><div className="p-4 text-sm">{order ? <div className="space-y-2">
      <div className="flex items-center gap-2"><SideBadge side={order.side} /><span className="font-medium">{order.runnerName}</span><StatusBadge status={order.status === 'matched' || order.status === 'settled' ? 'ok' : 'warning'}>{order.status}</StatusBadge></div>
      <div className="text-muted-foreground">{order.marketName || order.venue} · {order.requestedOdds?.toFixed(2) || '—'} · ${Number(order.requestedStake || 0).toFixed(2)}</div>
    </div> : <div className="text-muted-foreground">No paper orders have been created.</div>}</div></Panel>
  </div>;
}