import React from 'react';
import { cn } from '@/lib/utils';

const LIGHT_CONFIG = {
  green: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30', dot: 'bg-success', label: 'Paper Validated' },
  yellow: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30', dot: 'bg-warning', label: 'Paper Testing' },
  red: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/30', dot: 'bg-danger', label: 'Failing / Locked' },
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
    clean: 'bg-success/10 text-success border-success/30',
    needs_audit: 'bg-warning/10 text-warning border-warning/30',
    missing_clv: 'bg-warning/10 text-warning border-warning/30',
    missing_settlement: 'bg-danger/10 text-danger border-danger/30',
    commission_error: 'bg-danger/10 text-danger border-danger/30',
    sample_too_small: 'bg-info/10 text-info border-info/30',
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
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-danger/10 text-danger border-danger/30">
      Metrics Require Audit
    </span>
  );
}