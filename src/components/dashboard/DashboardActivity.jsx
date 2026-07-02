import React from 'react';
import { useApp } from '@/lib/AppContext';
import { SideBadge, PLValue, StatusBadge } from '@/components/ui/Trading';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight } from 'lucide-react';

function PanelHeader({ title, link, linkText }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {link && (
        <Link to={link} className="text-xs font-medium text-chart-3 hover:text-chart-3/80 flex items-center gap-1 transition-colors">
          {linkText} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function SignalRow({ s }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-7 w-7 rounded-lg bg-chart-3/10 flex items-center justify-center shrink-0">
          <Zap className="h-3.5 w-3.5 text-chart-3" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{s.strategyName}</span>
            <SideBadge side={s.side} />
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{s.reason}</div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-mono font-bold text-chart-1">+{s.edgePercent?.toFixed(2)}%</div>
        <div className="text-[10px] text-muted-foreground">@ {s.odds?.toFixed(2)}</div>
      </div>
    </div>
  );
}

function OrderRow({ o }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <SideBadge side={o.side} />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{o.runnerName}</div>
          <div className="text-[11px] text-muted-foreground">{o.strategyName}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[11px] font-mono text-muted-foreground">@ {o.matchedOdds?.toFixed(2)}</span>
        {o.result === 'pending'
          ? <StatusBadge status="info">Pending</StatusBadge>
          : <PLValue value={o.netProfit} />}
      </div>
    </div>
  );
}

function ActivityRow({ a, isLast }) {
  return (
    <div className="relative pl-5 pb-3 last:pb-0">
      {!isLast && <div className="absolute left-[5px] top-3 bottom-0 w-px bg-border" />}
      <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-chart-2 ring-2 ring-card" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-foreground">{a.action}</span>
          <div className="text-[11px] text-muted-foreground mt-0.5">{a.details}</div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">
          {new Date(a.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="py-8 text-center text-xs text-muted-foreground">{text}</div>;
}

export default function DashboardActivity() {
  const { strategySignals, paperOrders, botActivity } = useApp();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left column: Signals + Orders */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <PanelHeader title="Recent Signals" link="/strategy" linkText="View all" />
          {strategySignals.length === 0
            ? <EmptyState text="No signals yet. Start the bot to generate signals." />
            : <div>{strategySignals.slice(0, 4).map(s => <SignalRow key={s.id} s={s} />)}</div>}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <PanelHeader title="Recent Paper Orders" link="/paper-trading" linkText="View all" />
          {paperOrders.length === 0
            ? <EmptyState text="No paper orders yet." />
            : <div>{paperOrders.slice(0, 4).map(o => <OrderRow key={o.id} o={o} />)}</div>}
        </div>
      </div>

      {/* Right column: Activity Feed */}
      <div className="rounded-xl border border-border bg-card p-4">
        <PanelHeader title="Activity Feed" link="/bot-control" linkText="Bot Control" />
        {botActivity.length === 0
          ? <EmptyState text="No activity yet. Start the bot to see real-time updates." />
          : <div className="max-h-96 overflow-y-auto pr-1">
              {botActivity.slice(0, 12).map((a, i) => (
                <ActivityRow key={a.id} a={a} isLast={i === Math.min(botActivity.length, 12) - 1} />
              ))}
            </div>}
      </div>
    </div>
  );
}