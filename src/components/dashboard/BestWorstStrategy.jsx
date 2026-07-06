import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import { PLValue } from '@/components/ui/Trading';
import { Trophy, AlertTriangle, ArrowRight } from 'lucide-react';

export default function BestWorstStrategy() {
  const { strategyStats, strategyLibrary } = useApp();

  const withStats = strategyStats.map(stat => {
    const lib = strategyLibrary?.find(s => s.name === stat.strategyName);
    return { ...stat, category: lib?.category || '—', id: lib?.id || stat.strategyName };
  }).filter(s => s.totalPaperOrders > 0);

  const sorted = [...withStats].sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  if (!best || !worst) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
        No strategy performance data yet. Start paper trading to see best/worst strategies.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Link to={`/strategy/${best.id}`} className="group rounded-xl border border-chart-1/20 bg-chart-1/5 p-4 hover:border-chart-1/40 transition-all">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-chart-1" />
          <span className="text-xs font-bold text-chart-1 uppercase tracking-wider">Best Performing</span>
        </div>
        <div className="text-sm font-bold text-foreground">{best.strategyName}</div>
        <div className="text-[10px] text-muted-foreground mb-2">{best.category}</div>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] text-muted-foreground">Net P/L</div>
            <PLValue value={best.netProfit} />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">ROI</div>
            <div className={`text-sm font-bold font-mono ${(best.roi || 0) >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{(best.roi || 0).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">Strike</div>
            <div className="text-sm font-bold font-mono text-foreground">{(best.strikeRate || 0).toFixed(0)}%</div>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3 text-xs text-chart-1 opacity-0 group-hover:opacity-100 transition-opacity">
          View details <ArrowRight className="h-3 w-3" />
        </div>
      </Link>

      <Link to={`/strategy/${worst.id}`} className="group rounded-xl border border-chart-5/20 bg-chart-5/5 p-4 hover:border-chart-5/40 transition-all">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-chart-5" />
          <span className="text-xs font-bold text-chart-5 uppercase tracking-wider">Needs Attention</span>
        </div>
        <div className="text-sm font-bold text-foreground">{worst.strategyName}</div>
        <div className="text-[10px] text-muted-foreground mb-2">{worst.category}</div>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] text-muted-foreground">Net P/L</div>
            <PLValue value={worst.netProfit} />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">ROI</div>
            <div className={`text-sm font-bold font-mono ${(worst.roi || 0) >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{(worst.roi || 0).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">CLV</div>
            <div className={`text-sm font-bold font-mono ${(worst.closingLineValue || 0) >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{(worst.closingLineValue || 0).toFixed(1)}%</div>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3 text-xs text-chart-5 opacity-0 group-hover:opacity-100 transition-opacity">
          View details <ArrowRight className="h-3 w-3" />
        </div>
      </Link>
    </div>
  );
}