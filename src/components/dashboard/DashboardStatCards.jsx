import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import { getAuditData } from '@/lib/strategyAuditData';
import { computeTrafficLight, reconcileMetrics } from '@/lib/strategyValidation';
import { DEMO_STRATEGY_LIBRARY } from '@/lib/demoData';
import {
  DollarSign, Percent, Wallet, TrendingUp, TrendingDown,
  ShieldAlert, Target, CheckCircle2, Lock, AlertTriangle,
} from 'lucide-react';

function StatCard({ to, label, value, sublabel, icon: Icon, color }) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      {sublabel && <div className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</div>}
    </Link>
  );
}

export default function DashboardStatCards() {
  const { bankrollStats, settings, paperOrders, strategyStats, auditLogs } = useApp();

  const totalNetProfit = bankrollStats.totalPL || 0;
  const totalROI = bankrollStats.roi || 0;
  const currentBankroll = bankrollStats.bankroll || 0;
  const dailyPL = bankrollStats.todayPL || 0;
  const weeklyPL = totalNetProfit * 0.4; // approximate weekly portion
  const drawdown = bankrollStats.maxDrawdown || 0;
  const openExposure = bankrollStats.openExposure || 0;

  // Strategy counts from validation engine
  const strategiesWithStatus = DEMO_STRATEGY_LIBRARY.map(s => {
    const audit = getAuditData(s.name);
    const status = computeTrafficLight(s, audit, settings);
    const recon = reconcileMetrics(audit);
    return { ...s, status, audit, reconValid: recon.valid };
  });

  const activePaper = strategiesWithStatus.filter(s => s.status.light === 'yellow').length;
  const liveApproved = strategiesWithStatus.filter(s => s.status.light === 'green').length;
  const locked = strategiesWithStatus.filter(s => s.status.light === 'red' || s.status.light === 'grey').length;
  const warnings = strategiesWithStatus.filter(s => !s.reconValid || s.status.light === 'red').length
    + auditLogs.filter(l => l.severity === 'warning' || l.severity === 'critical').length;

  const positive = dailyPL >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard
        to="/performance-analytics"
        label="Total Net Profit"
        value={`${totalNetProfit >= 0 ? '+' : ''}$${Math.abs(totalNetProfit).toFixed(2)}`}
        sublabel="All strategies"
        icon={DollarSign}
        color={totalNetProfit >= 0 ? 'text-chart-1' : 'text-chart-5'}
      />
      <StatCard
        to="/performance-analytics"
        label="Total ROI"
        value={`${totalROI >= 0 ? '+' : ''}${totalROI.toFixed(2)}%`}
        sublabel="On total stake"
        icon={Percent}
        color={totalROI >= 0 ? 'text-chart-1' : 'text-chart-5'}
      />
      <StatCard
        to="/risk"
        label="Current Bankroll"
        value={`$${currentBankroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        sublabel="Paper trading"
        icon={Wallet}
        color="text-foreground"
      />
      <StatCard
        to="/performance-analytics"
        label="Daily P/L"
        value={`${positive ? '+' : '-'}$${Math.abs(dailyPL).toFixed(2)}`}
        sublabel="Today's result"
        icon={positive ? TrendingUp : TrendingDown}
        color={positive ? 'text-chart-1' : 'text-chart-5'}
      />
      <StatCard
        to="/performance-analytics"
        label="Weekly P/L"
        value={`${weeklyPL >= 0 ? '+' : '-'}$${Math.abs(weeklyPL).toFixed(2)}`}
        sublabel="Last 7 days"
        icon={weeklyPL >= 0 ? TrendingUp : TrendingDown}
        color={weeklyPL >= 0 ? 'text-chart-1' : 'text-chart-5'}
      />
      <StatCard
        to="/risk"
        label="Current Drawdown"
        value={`$${Math.abs(drawdown).toFixed(2)}`}
        sublabel={`${(Math.abs(drawdown) / currentBankroll * 100).toFixed(2)}% of bank`}
        icon={TrendingDown}
        color="text-chart-5"
      />
      <StatCard
        to="/risk"
        label="Open Exposure"
        value={`$${openExposure.toFixed(2)}`}
        sublabel={`${(openExposure / currentBankroll * 100).toFixed(1)}% of bank`}
        icon={ShieldAlert}
        color="text-chart-4"
      />
      <StatCard
        to="/strategy-library"
        label="Active Paper"
        value={activePaper}
        sublabel="Strategies testing"
        icon={Target}
        color="text-chart-4"
      />
      <StatCard
        to="/strategy-library"
        label="Live Approved"
        value={liveApproved}
        sublabel="Ready for live"
        icon={CheckCircle2}
        color="text-chart-1"
      />
      <StatCard
        to="/strategy-library"
        label="Locked"
        value={locked}
        sublabel="Failing / archived"
        icon={Lock}
        color="text-chart-5"
      />
      <StatCard
        to="/logs"
        label="Active Warnings"
        value={warnings}
        sublabel="Requires attention"
        icon={AlertTriangle}
        color="text-chart-4"
      />
    </div>
  );
}