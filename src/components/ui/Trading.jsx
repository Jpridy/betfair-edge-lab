import React from 'react';
import { cn } from '@/lib/utils';

export function Panel({ children, className, title, action }) {
  return (
    <div className={cn('bg-card border border-border rounded-lg', className)}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, sublabel, trend, icon: Icon, accent }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && <Icon className={cn('h-4 w-4', accent || 'text-muted-foreground')} />}
      </div>
      <div className={cn('text-2xl font-bold font-mono', trend === 'up' && 'text-chart-1', trend === 'down' && 'text-chart-5', (!trend || trend === 'neutral') && 'text-foreground')}>
        {value}
      </div>
      {sublabel && <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>}
    </div>
  );
}

export function StatusBadge({ status, children }) {
  const styles = {
    ok: 'bg-chart-1/10 text-chart-1 border-chart-1/30',
    warning: 'bg-chart-4/10 text-chart-4 border-chart-4/30',
    danger: 'bg-chart-5/10 text-chart-5 border-chart-5/30',
    info: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
    neutral: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border', styles[status] || styles.neutral)}>
      {children}
    </span>
  );
}

export function SideBadge({ side }) {
  return side === 'BACK' 
    ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-chart-3/10 text-chart-3 border border-chart-3/30">BACK</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-chart-5/10 text-chart-5 border border-chart-5/30">LAY</span>;
}

export function PLValue({ value }) {
  const positive = value > 0;
  const zero = value === 0;
  return (
    <span className={cn('font-mono font-semibold', zero ? 'text-muted-foreground' : positive ? 'text-chart-1' : 'text-chart-5')}>
      {zero ? '$0.00' : `${positive ? '+' : '-'}$${Math.abs(value).toFixed(2)}`}
    </span>
  );
}