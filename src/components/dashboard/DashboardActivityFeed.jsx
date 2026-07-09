import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import { getLiveAuditData } from '@/lib/liveAuditData';
import { computeTrafficLight, reconcileMetrics } from '@/lib/strategyValidation';
import { SideBadge, PLValue, StatusBadge } from '@/components/ui/Trading';
import { Zap, ArrowRight, AlertTriangle, ScrollText, FlaskConical } from 'lucide-react';

function PanelBox({ title, link, linkText, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3 hidden">
        <h3 className="text-sm font-bold text-foreground hidden">{title}</h3>
        {link &&
        <Link to={link} className="text-xs font-medium text-chart-3 hover:text-chart-3/80 flex items-center gap-1 transition-colors">
            {linkText} <ArrowRight className="h-3 w-3" />
          </Link>
        }
      </div>
      {children}
    </div>);

}

function EmptyState({ text }) {
  return <div className="py-6 text-center text-xs text-muted-foreground">{text}</div>;
}

function SignalRow({ s }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <Zap className="h-3.5 w-3.5 text-chart-3 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">{s.strategyName}</span>
            <SideBadge side={s.side} />
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{s.reason}</div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-mono font-bold text-chart-1">+{s.edgePercent?.toFixed(2)}%</div>
        <div className="text-[9px] text-muted-foreground">@ {s.odds?.toFixed(2)}</div>
      </div>
    </div>);

}

function OrderRow({ o }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <SideBadge side={o.side} />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{o.runnerName}</div>
          <div className="text-[10px] text-muted-foreground">{o.strategyName}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-mono text-muted-foreground">@ {o.matchedOdds?.toFixed(2)}</span>
        {o.result === 'pending' ?
        <StatusBadge status="info">Pending</StatusBadge> :
        <PLValue value={o.netProfit} />}
      </div>
    </div>);

}

function WarningRow({ s }) {
  return (
    <Link to={`/strategy/${s.id}`} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0 hover:opacity-80 hidden">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-3.5 w-3.5 text-chart-4 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground">{s.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{s.warningText}</div>
        </div>
      </div>
      <StatusBadge status={s.status.light === 'red' ? 'danger' : 'warning'}>{s.status.label}</StatusBadge>
    </Link>);

}

function LogRow({ l }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0">
      <div className="flex items-start gap-2 min-w-0">
        <ScrollText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground">{l.action}</div>
          <div className="text-[10px] text-muted-foreground truncate">{l.details}</div>
        </div>
      </div>
      <span className="text-[9px] font-mono text-muted-foreground shrink-0 mt-0.5">
        {new Date(l.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </span>
    </div>);

}

function BacktestRow({ r }) {
  return (
    <Link to="/backtesting" className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0 hover:opacity-80">
      <div className="flex items-center gap-2 min-w-0">
        <FlaskConical className="h-3.5 w-3.5 text-chart-2 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{r.name}</div>
          <div className="text-[10px] text-muted-foreground">{r.totalBets} bets · {r.strategyName}</div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <PLValue value={r.netProfit} />
        <div className={`text-[9px] font-mono ${r.roi >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{r.roi.toFixed(1)}% ROI</div>
      </div>
    </Link>);

}

export default function DashboardActivityFeed() {
  const { strategySignals, paperOrders, auditLogs, backtestRuns, settings, strategyStats, strategyLibrary } = useApp();

  // Compute strategy warnings — using live data
  const strategyWarnings = (strategyLibrary || []).map((s) => {
    const audit = getLiveAuditData(s.name, paperOrders, strategyStats);
    const status = computeTrafficLight(s, audit, settings);
    const recon = reconcileMetrics(audit);
    let warningText = null;
    if (status.light === 'red') {
      warningText = status.reasons[0] || 'Strategy is failing';
    } else if (!recon.valid) {
      warningText = recon.errors[0] || 'Metrics require audit';
    } else if (status.light === 'grey') {
      warningText = 'Strategy is archived';
    }
    return { ...s, audit, status, reconValid: recon.valid, warningText };
  }).filter((s) => s.warningText);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PanelBox title="Latest Signals" link="/strategy" linkText="View all">
        {strategySignals.length === 0 ?
        <EmptyState text="No signals yet. Start the bot to generate signals." /> :
        <div>{strategySignals.slice(0, 5).map((s) => <SignalRow key={s.id} s={s} />)}</div>}
      </PanelBox>

      <PanelBox title="Latest Orders" link="/orders" linkText="View all">
        {paperOrders.length === 0 ?
        <EmptyState text="No orders yet." /> :
        <div>{paperOrders.slice(0, 5).map((o) => <OrderRow key={o.id} o={o} />)}</div>}
      </PanelBox>

      <PanelBox title="Strategy Warnings" link="/strategy-library" linkText="View all">
        {strategyWarnings.length === 0 ?
        <EmptyState text="No warnings — all strategies healthy." /> :
        <div>{strategyWarnings.slice(0, 5).map((s) => <WarningRow key={s.id} s={s} />)}</div>}
      </PanelBox>

      <PanelBox title="Latest Audit Logs" link="/logs" linkText="View all">
        {auditLogs.length === 0 ?
        <EmptyState text="No log entries yet." /> :
        <div>{auditLogs.slice(0, 5).map((l) => <LogRow key={l.id} l={l} />)}</div>}
      </PanelBox>

      {backtestRuns.length > 0 &&
      <PanelBox title="Latest Backtest Results" link="/backtesting" linkText="View all">
          <div>{backtestRuns.slice(0, 3).map((r) => <BacktestRow key={r.id} r={r} />)}</div>
        </PanelBox>
      }
    </div>);

}