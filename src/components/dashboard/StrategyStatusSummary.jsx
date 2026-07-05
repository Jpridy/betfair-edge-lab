import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import { getAuditData } from '@/lib/strategyAuditData';
import { computeTrafficLight, getPaperProgress } from '@/lib/strategyValidation';
import { DEMO_STRATEGY_LIBRARY } from '@/lib/demoData';
import { ArrowRight } from 'lucide-react';

const LIGHT_CONFIG = {
  green: { label: 'Live Approved', color: 'text-chart-1', bg: 'bg-chart-1/10', border: 'border-chart-1/30', dot: 'bg-chart-1' },
  yellow: { label: 'Paper Testing', color: 'text-chart-4', bg: 'bg-chart-4/10', border: 'border-chart-4/30', dot: 'bg-chart-4' },
  red: { label: 'Failing / Locked', color: 'text-chart-5', bg: 'bg-chart-5/10', border: 'border-chart-5/30', dot: 'bg-chart-5' },
  grey: { label: 'Archived', color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', dot: 'bg-muted-foreground' },
};

export default function StrategyStatusSummary() {
  const { settings } = useApp();

  const strategies = DEMO_STRATEGY_LIBRARY.map(s => {
    const audit = getAuditData(s.name);
    const status = computeTrafficLight(s, audit, settings);
    const progress = getPaperProgress(audit);
    return { ...s, audit, status, progress };
  });

  const counts = {
    green: strategies.filter(s => s.status.light === 'green').length,
    yellow: strategies.filter(s => s.status.light === 'yellow').length,
    red: strategies.filter(s => s.status.light === 'red').length,
    grey: strategies.filter(s => s.status.light === 'grey').length,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">Strategy Status Summary</h3>
        <Link to="/strategy-library" className="text-xs font-medium text-chart-3 hover:text-chart-3/80 flex items-center gap-1">
          View Library <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Summary bars */}
      <div className="flex gap-1 h-2 rounded-full overflow-hidden mb-4">
        {counts.green > 0 && <div className="bg-chart-1" style={{ width: `${(counts.green / strategies.length) * 100}%` }} />}
        {counts.yellow > 0 && <div className="bg-chart-4" style={{ width: `${(counts.yellow / strategies.length) * 100}%` }} />}
        {counts.red > 0 && <div className="bg-chart-5" style={{ width: `${(counts.red / strategies.length) * 100}%` }} />}
        {counts.grey > 0 && <div className="bg-muted-foreground/40" style={{ width: `${(counts.grey / strategies.length) * 100}%` }} />}
      </div>

      {/* Strategy list */}
      <div className="space-y-1.5">
        {strategies.map(s => {
          const cfg = LIGHT_CONFIG[s.status.light];
          return (
            <Link
              key={s.id}
              to={`/strategy/${s.id}`}
              className={`flex items-center justify-between gap-3 rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2 hover:opacity-80 transition-opacity`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">{s.category}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {s.status.light === 'yellow' && s.audit && (
                  <span className="text-[10px] font-mono text-muted-foreground">{s.progress.current}/{s.progress.target}</span>
                )}
                <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}