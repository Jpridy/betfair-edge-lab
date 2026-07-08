import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import { getLiveAuditData } from '@/lib/liveAuditData';
import { computeTrafficLight, getPaperProgress } from '@/lib/strategyValidation';
import { STRATEGY_LIBRARY } from '@/lib/strategyLibrary';
import { StrategyStatusBadge } from '@/components/strategy/StrategyStatusBadge';
import { ArrowRight } from 'lucide-react';

export default function PaperProgress() {
  const { settings, paperOrders, strategyStats } = useApp();

  const strategies = STRATEGY_LIBRARY
    .filter(s => s.status !== 'archived')
    .map(s => {
      const audit = getLiveAuditData(s.name, paperOrders, strategyStats);
      const status = computeTrafficLight(s, audit, settings);
      const progress = getPaperProgress(audit);
      return { ...s, audit, status, progress };
    });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">Paper Testing Progress</h3>
        <Link to="/strategy-library" className="text-xs font-medium text-chart-3 hover:underline flex items-center gap-1">
          View Library <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {strategies.map(s => (
          <div key={s.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <Link to={`/strategy/${s.id}`} className="text-xs font-semibold text-foreground hover:text-primary">
                {s.name}
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {s.progress.current} / {s.progress.target} settled
                </span>
                <StrategyStatusBadge light={s.status.light} label={s.status.label} />
              </div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${s.progress.percent >= 100 ? 'bg-chart-1' : 'bg-chart-4'}`}
                style={{ width: `${s.progress.percent}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">
              {s.progress.percent >= 100
                ? 'Minimum sample reached — Research Passed'
                : `${(s.progress.target - s.progress.current)} more settled trades required for validation`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}