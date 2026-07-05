import React from 'react';
import { cn } from '@/lib/utils';

const LIGHT_CONFIG = {
  green: { bg: 'bg-chart-1/10', text: 'text-chart-1', border: 'border-chart-1/30', dot: 'bg-chart-1', label: 'Live Approved' },
  yellow: { bg: 'bg-chart-4/10', text: 'text-chart-4', border: 'border-chart-4/30', dot: 'bg-chart-4', label: 'Paper Testing' },
  red: { bg: 'bg-chart-5/10', text: 'text-chart-5', border: 'border-chart-5/30', dot: 'bg-chart-5', label: 'Failing' },
  grey: { bg: 'bg-muted/30', text: 'text-muted-foreground', border: 'border-border', dot: 'bg-muted-foreground', label: 'Archived' },
};

export function StrategyStatusBadge({ light, label, size = 'sm' }) {
  const config = LIGHT_CONFIG[light] || LIGHT_CONFIG.grey;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded border font-bold',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
      config.bg, config.text, config.border
    )}>
      <span className={cn('rounded-full', config.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {label || config.label}
    </span>
  );
}

export function DataQualityBadge({ status, label }) {
  const styles = {
    clean: 'bg-chart-1/10 text-chart-1 border-chart-1/30',
    needs_audit: 'bg-chart-4/10 text-chart-4 border-chart-4/30',
    missing_clv: 'bg-chart-4/10 text-chart-4 border-chart-4/30',
    missing_settlement: 'bg-chart-5/10 text-chart-5 border-chart-5/30',
    commission_error: 'bg-chart-5/10 text-chart-5 border-chart-5/30',
    sample_too_small: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
    stale_data: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border', styles[status] || styles.stale_data)}>
      {label}
    </span>
  );
}

export function MetricWarningBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-chart-5/10 text-chart-5 border-chart-5/30">
      Metrics Require Audit
    </span>
  );
}