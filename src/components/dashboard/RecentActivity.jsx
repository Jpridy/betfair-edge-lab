import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { fmtAge, fmtMoney } from '@/lib/format';
import { SideBadge, StatusBadge } from '@/components/ui/Trading';
import { ArrowRight, CheckCircle2, Ban, RefreshCw, AlertTriangle, ShoppingCart } from 'lucide-react';

function activityIcon(type) {
  switch (type) {
    case 'decision': return CheckCircle2;
    case 'order': return ShoppingCart;
    case 'settlement': return RefreshCw;
    case 'warning': return AlertTriangle;
    case 'error': return Ban;
    default: return CheckCircle2;
  }
}

function activityTone(type) {
  switch (type) {
    case 'decision': return 'text-info';
    case 'order': return 'text-info';
    case 'settlement': return 'text-success';
    case 'warning': return 'text-warning';
    case 'error': return 'text-danger';
    default: return 'text-muted-foreground';
  }
}

export default function RecentActivity() {
  const { botCycles, paperOrders, botActivity, auditLogs } = useApp();

  const items = [];

  // Latest decision
  if (botCycles[0]) {
    const c = botCycles[0];
    items.push({
      type: 'decision',
      title: `Cycle #${c.cycleNumber} — ${c.ordersCreated > 0 ? 'Bet placed' : 'No bet'}`,
      desc: c.noBetReason || c.notes || 'Cycle completed',
      time: c.finishedAt || c.startedAt,
    });
  }

  // Latest order
  if (paperOrders[0]) {
    const o = paperOrders[0];
    items.push({
      type: 'order',
      title: `${o.side} ${o.runnerName} @ ${o.requestedOdds?.toFixed(2) || '—'}`,
      desc: `${o.marketName || o.venue || ''} · ${fmtMoney(o.requestedStake)}`,
      time: o.placed_date || o.created_date,
    });
  }

  // Latest settlement (settled order)
  const settled = paperOrders.find(o => o.status === 'settled');
  if (settled) {
    items.push({
      type: 'settlement',
      title: `${settled.runnerName} — ${settled.result || 'settled'}`,
      desc: `Net P/L: ${fmtMoney(settled.netProfit, { sign: true })}`,
      time: settled.settled_date || settled.settledAt,
    });
  }

  // Latest warning from audit logs
  const warning = auditLogs.find(l => l.severity === 'warning' || l.severity === 'error');
  if (warning) {
    items.push({
      type: warning.severity === 'error' ? 'error' : 'warning',
      title: warning.action,
      desc: warning.details?.slice(0, 80) || '',
      time: warning.timestamp,
    });
  }

  // Latest bot activity
  if (botActivity[0]) {
    items.push({
      type: 'decision',
      title: botActivity[0].action,
      desc: botActivity[0].details?.slice(0, 80) || '',
      time: botActivity[0].timestamp,
    });
  }

  // Sort by time, take 5
  const sorted = items
    .filter(i => i.time)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  return (
    <Panel title="Recent Activity" subtitle="Latest 5 events across decisions, orders, and warnings">
      {sorted.length > 0 ? (
        <div className="divide-y divide-border-subtle">
          {sorted.map((item, i) => {
            const Icon = activityIcon(item.type);
            const tone = activityTone(item.type);
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${tone}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.desc}</div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{fmtAge(item.time)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground">No recent activity.</div>
      )}
      <div className="border-t border-border-subtle p-3">
        <Button asChild size="sm" variant="ghost" className="w-full">
          <Link to="/analytics">View All Activity <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </div>
    </Panel>
  );
}