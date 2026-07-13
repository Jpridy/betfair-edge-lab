import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { fmtAge, fmtMoney } from '@/lib/format';
import { hasEconomicSettlement, normalizedOrderResult, orderNetResult } from '@/lib/orderState';
import { ArrowRight, CheckCircle2, Ban, RefreshCw, AlertTriangle, ShoppingCart } from 'lucide-react';

function activityIcon(type) {
  switch (type) {
    case 'order': return ShoppingCart;
    case 'settlement': return RefreshCw;
    case 'warning': return AlertTriangle;
    case 'error': return Ban;
    default: return CheckCircle2;
  }
}

function activityTone(type) {
  switch (type) {
    case 'order':
    case 'decision': return 'text-info';
    case 'settlement': return 'text-success';
    case 'warning': return 'text-warning';
    case 'error': return 'text-danger';
    default: return 'text-muted-foreground';
  }
}

export default function RecentActivity() {
  const { botCycles, paperOrders, botActivity, auditLogs } = useApp();
  const items = [];

  if (botCycles[0]) {
    const cycle = botCycles[0];
    items.push({
      type: 'decision',
      title: `Cycle #${cycle.cycleNumber} — ${Number(cycle.ordersCreated || 0) > 0 ? 'Paper order created' : 'No bet'}`,
      desc: cycle.noBetReason || cycle.notes || 'Cycle completed',
      time: cycle.finishedAt || cycle.startedAt,
    });
  }

  if (paperOrders[0]) {
    const order = paperOrders[0];
    const odds = order.requestedOdds != null ? Number(order.requestedOdds).toFixed(2) : '—';
    items.push({
      type: 'order',
      title: `${order.side || '—'} ${order.runnerName || 'Unknown runner'} @ ${odds}`,
      desc: `${order.marketName || order.venue || 'Unknown market'} · ${fmtMoney(order.requestedStake)}`,
      time: order.placed_date || order.created_date,
    });
  }

  const settled = paperOrders.find(hasEconomicSettlement);
  if (settled) {
    items.push({
      type: 'settlement',
      title: `${settled.runnerName || 'Unknown runner'} — ${normalizedOrderResult(settled)}`,
      desc: `Net P/L: ${fmtMoney(orderNetResult(settled), { sign: true })}`,
      time: settled.settledAt || settled.settled_date,
    });
  }

  const warning = auditLogs.find(log => log.severity === 'warning' || log.severity === 'error');
  if (warning) {
    items.push({
      type: warning.severity === 'error' ? 'error' : 'warning',
      title: warning.action,
      desc: String(warning.details || '').slice(0, 100),
      time: warning.timestamp,
    });
  }

  if (botActivity[0]) {
    items.push({
      type: 'decision',
      title: botActivity[0].action,
      desc: String(botActivity[0].details || '').slice(0, 100),
      time: botActivity[0].timestamp,
    });
  }

  const sorted = items
    .filter(item => item.time && !Number.isNaN(new Date(item.time).getTime()))
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
    .slice(0, 5);

  return (
    <Panel title="Recent Activity" subtitle="Latest decisions, orders, settlements and warnings">
      {sorted.length > 0 ? (
        <div className="divide-y divide-border-subtle">
          {sorted.map((item, index) => {
            const Icon = activityIcon(item.type);
            return (
              <div key={`${item.type}-${item.time}-${index}`} className="flex items-start gap-3 px-4 py-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${activityTone(item.type)}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{item.desc}</div>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{fmtAge(item.time)}</span>
              </div>
            );
          })}
        </div>
      ) : <div className="p-8 text-center text-sm text-muted-foreground">No recent activity.</div>}
      <div className="border-t border-border-subtle p-3">
        <Button asChild size="sm" variant="ghost" className="w-full">
          <Link to="/analytics">View All Activity <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </div>
    </Panel>
  );
}
