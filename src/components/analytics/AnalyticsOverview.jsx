import React from 'react';
import { useApp } from '@/lib/AppContext';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { Panel } from '@/components/ui/workstation';
import { MetricCard } from '@/components/ui/workstation';
import { fmtMoney, fmtPct, plClass, fmtAge } from '@/lib/format';
import { TrendingUp, Target, Percent, AlertTriangle, Activity, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function AnalyticsOverview() {
  const { paperOrders, plData, statisticalValidation, bankrollStats } = useApp();
  const accounting = usePortfolioAccountingDisplay();

  const settledOrders = paperOrders.filter(o => o.status === 'settled' && o.settlementStatus === 'settled' && (o.result === 'won' || o.result === 'lost') && !o.proofMode && !o.excludeFromPerformance && !o.invalidTestRecord);
  const wins = accounting.wonOrderCount || 0;
  const losses = accounting.lostOrderCount || 0;
  const totalBets = wins + losses;
  const strikeRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;
  const avgWin = wins > 0 ? settledOrders.filter(o => o.result === 'won').reduce((s, o) => s + (o.netProfit || 0), 0) / wins : 0;
  const avgLoss = losses > 0 ? settledOrders.filter(o => o.result === 'lost').reduce((s, o) => s + (o.netProfit || 0), 0) / losses : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin * wins / (avgLoss * losses)) : 0;
  const netROI = accounting.netROI != null ? accounting.netROI * 100 : 0;
  const maxDrawdown = bankrollStats.maxDrawdown || 0;

  const recentBets = settledOrders.slice(0, 10);
  const currentLosingStreak = settledOrders.length > 0 && settledOrders[0].result === 'lost'
    ? settledOrders.findIndex(o => o.result === 'won')
    : 0;

  const validationStatus = statisticalValidation?.overallStatus || 'INSUFFICIENT_DATA';
  const validationNextStep = {
    INSUFFICIENT_DATA: `Need ${statisticalValidation?.minBets || 500} settled bets for validation. Currently have ${totalBets}.`,
    LEARNING: 'Collecting more data to learn patterns.',
    PAPER_VALIDATION: 'Validating strategy on paper trades.',
    VALIDATED: 'Strategy validated out of sample.',
    FAILED_VALIDATION: 'Strategy failed validation. Review settings.',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Net Realised P/L" value={fmtMoney(accounting.netRealisedPL, { sign: true })} icon={TrendingUp} tone={plClass(accounting.netRealisedPL)} sublabel="After commission" />
        <MetricCard label="Net ROI" value={fmtPct(netROI)} icon={Percent} tone={plClass(netROI)} sublabel="Return on bankroll" />
        <MetricCard label="Strike Rate" value={fmtPct(strikeRate)} icon={Target} sublabel={`${wins}W / ${losses}L`} />
        <MetricCard label="Profit Factor" value={profitFactor > 0 ? profitFactor.toFixed(2) : '—'} icon={Activity} tone={profitFactor >= 1 ? 'success' : 'danger'} sublabel="Wins vs losses" />
        <MetricCard label="Max Drawdown" value={fmtMoney(maxDrawdown)} icon={AlertTriangle} tone="warning" sublabel="Largest equity drop" />
        <MetricCard label="Settled Bets" value={String(totalBets)} icon={CheckCircle2} sublabel={`${settledOrders.length} total settled`} />
      </div>

      <Panel title="Equity Curve" subtitle="Bankroll over time from settled paper bets">
        {plData.length > 1 ? (
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={plData}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v.toFixed(0)}`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={v => fmtMoney(v)} />
                <Area type="monotone" dataKey="bankroll" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#equityGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">Need at least 2 settled bets to show equity curve. Currently have {plData.length}.</div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent Performance" subtitle="Last 10 settled bets">
          {recentBets.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {recentBets.map((o, i) => (
                <div key={o.id || i} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                  <span className={`font-semibold ${o.result === 'won' ? 'text-success' : 'text-danger'}`}>{o.result === 'won' ? 'W' : 'L'}</span>
                  <span className="flex-1 truncate text-foreground">{o.runnerName || '—'}</span>
                  <span className="font-mono text-muted-foreground">{o.matchedOdds?.toFixed(2) || o.requestedOdds?.toFixed(2) || '—'}</span>
                  <span className={`font-mono tabular-nums font-semibold ${plClass(o.netProfit)}`}>{fmtMoney(o.netProfit, { sign: true })}</span>
                </div>
              ))}
              <div className="px-4 py-2.5 flex justify-between text-xs">
                <span className="text-muted-foreground">Losing streak: {currentLosingStreak > 0 ? currentLosingStreak : 0}</span>
                <span className={`font-mono font-semibold ${plClass(accounting.netRealisedPL)}`}>Total: {fmtMoney(accounting.netRealisedPL, { sign: true })}</span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No settled bets yet.</div>
          )}
        </Panel>

        <Panel title="Validation Status" subtitle="Statistical validation of the strategy">
          <div className="p-4 space-y-3">
            <div className={`rounded-lg p-3 border text-sm font-body ${validationStatus === 'VALIDATED' ? 'bg-success/8 text-success border-success/20' : validationStatus === 'FAILED_VALIDATION' ? 'bg-danger/8 text-danger border-danger/20' : 'bg-warning/8 text-warning border-warning/20'}`}>
              {validationStatus.replace(/_/g, ' ')}
            </div>
            <p className="text-xs text-muted-foreground">{validationNextStep[validationStatus] || 'Review calibration for details.'}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Settled bets:</span> <span className="font-semibold text-foreground">{totalBets}</span></div>
              <div><span className="text-muted-foreground">Required:</span> <span className="font-semibold text-foreground">{statisticalValidation?.minBets || 500}</span></div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}