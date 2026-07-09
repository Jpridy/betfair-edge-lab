import React from 'react';
import { cn } from '@/lib/utils';

export function Panel({ children, className, title, action, subtitle }) {
  return (
    <div className={cn('bg-card border border-border-subtle rounded-lg shadow-premium', className)}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div>
            {title && <h3 className="text-sm font-heading font-semibold text-foreground tracking-tight-brand">{title}</h3>}
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, sublabel, trend, icon: Icon, accent }) {
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-foreground';
  return (
    <div className="bg-card border border-border-subtle rounded-lg p-4 hover:border-border transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">{label}</span>
        {Icon && <Icon className={cn('h-4 w-4', accent || 'text-muted-foreground')} />}
      </div>
      <div className={cn('text-2xl font-heading font-semibold tabular-nums tracking-tight-brand', trendColor)}>
        {value}
      </div>
      {sublabel && <div className="text-[11px] text-muted-foreground mt-1">{sublabel}</div>}
    </div>
  );
}

const badgeStyles = {
  ok: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/10 text-warning border-warning/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  info: 'bg-info/10 text-info border-info/25',
  neutral: 'bg-muted text-muted-foreground border-border',
  proof: 'bg-primary/10 text-primary border-primary/25',
  debug: 'bg-primary/10 text-primary border-primary/25',
};

export function StatusBadge({ status, children }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-body font-semibold border tracking-label', badgeStyles[status] || badgeStyles.neutral)}>
      {children}
    </span>
  );
}

export function SideBadge({ side }) {
  return side === 'BACK'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-body font-semibold bg-info/10 text-info border border-info/25">BACK</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-body font-semibold bg-danger/10 text-danger border border-danger/25">LAY</span>;
}

export function PLValue({ value }) {
  const positive = value > 0;
  const zero = value === 0;
  return (
    <span className={cn('font-mono tabular-nums font-semibold', zero ? 'text-muted-foreground' : positive ? 'text-success' : 'text-danger')}>
      {zero ? '$0.00' : `${positive ? '+' : '-'}$${Math.abs(value).toFixed(2)}`}
    </span>
  );
}