import React from 'react';
import { cn } from '@/lib/utils';

export function MetricCard({ label, value, sublabel, icon: Icon, tone, mono = true }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border-subtle bg-card p-4 hover:border-border transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className={cn('text-xl font-heading font-semibold tracking-tight-brand', mono && 'tabular-nums', toneClass)}>
        {value}
      </div>
      {sublabel && <div className="text-[11px] text-muted-foreground mt-1">{sublabel}</div>}
    </div>
  );
}

export function CompactMetric({ label, value, tone }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-foreground';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-label">{label}</span>
      <span className={cn('text-sm font-heading font-semibold tabular-nums', toneClass)}>{value}</span>
    </div>
  );
}

const liveStatusStyles = {
  LIVE: 'bg-success/10 text-success border-success/25',
  CACHED: 'bg-warning/10 text-warning border-warning/25',
  STALE: 'bg-warning/10 text-warning border-warning/25',
  ERROR: 'bg-danger/10 text-danger border-danger/25',
  OFFLINE: 'bg-muted text-muted-foreground border-border',
  UNAVAILABLE: 'bg-muted text-muted-foreground border-border',
};

export function LiveStatusBadge({ status, age, source }) {
  const style = liveStatusStyles[status] || liveStatusStyles.UNAVAILABLE;
  const isLive = status === 'LIVE';
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-body font-semibold tracking-label', style)} title={source ? `Source: ${source}` : undefined}>
      <span className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'bg-success animate-pulse-dot' : 'bg-current opacity-50')} />
      <span>{status}</span>
      {age && <span className="opacity-70 font-normal">· {age}</span>}
    </div>
  );
}

export function FreshnessIndicator({ timestamp, staleLimitSeconds = 30 }) {
  if (!timestamp) return <LiveStatusBadge status="UNAVAILABLE" />;
  const ageSec = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  const status = ageSec <= staleLimitSeconds ? 'LIVE' : 'STALE';
  return <LiveStatusBadge status={status} age={`${ageSec}s`} />;
}

export function StatusBlock({ label, value, status = 'neutral', icon: Icon }) {
  const statusTone = status === 'ok' || status === 'live' ? 'text-success' : status === 'warning' || status === 'stale' ? 'text-warning' : status === 'danger' || status === 'error' ? 'text-danger' : 'text-muted-foreground';
  const dotTone = status === 'ok' || status === 'live' ? 'bg-success' : status === 'warning' || status === 'stale' ? 'bg-warning' : status === 'danger' || status === 'error' ? 'bg-danger' : 'bg-muted-foreground';
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-card px-3 py-2.5">
      {Icon && <Icon className={cn('h-4 w-4 shrink-0', statusTone)} />}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-muted-foreground uppercase tracking-label">{label}</div>
        <div className={cn('text-sm font-heading font-semibold truncate', statusTone)}>{value}</div>
      </div>
      <span className={cn('h-2 w-2 rounded-full shrink-0', dotTone, (status === 'ok' || status === 'live') && 'animate-pulse-dot')} />
    </div>
  );
}

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