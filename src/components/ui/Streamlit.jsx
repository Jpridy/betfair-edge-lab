import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

/**
 * Streamlit-style metric card.
 * Large value, small label above, optional delta below.
 */
export function Metric({ label, value, delta, deltaPositive, icon: Icon }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="text-2xl font-bold font-mono text-foreground">{value}</div>
      {delta !== undefined && (
        <div className={cn('text-xs font-medium', deltaPositive === true && 'text-chart-1', deltaPositive === false && 'text-chart-5', deltaPositive === null && 'text-muted-foreground')}>
          {delta}
        </div>
      )}
    </div>
  );
}

/**
 * Streamlit-style section with title and horizontal divider.
 * Optional collapsible.
 */
export function Section({ title, children, collapsible = false, defaultOpen = true, action }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!title) {
    return <div className="space-y-3">{children}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => collapsible && setOpen(!open)}
          className={cn('flex items-center gap-2', collapsible && 'cursor-pointer')}
          disabled={!collapsible}
        >
          {collapsible && <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !open && '-rotate-90')} />}
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
        </button>
        {action}
      </div>
      <div className="h-px bg-border" />
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}

/**
 * Streamlit-style divider.
 */
export function Divider({ label }) {
  if (label) {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="h-px bg-border flex-1" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className="h-px bg-border flex-1" />
      </div>
    );
  }
  return <div className="h-px bg-border" />;
}

/**
 * Streamlit-style info box.
 */
export function InfoBox({ type = 'info', children }) {
  const styles = {
    info: 'bg-chart-3/5 border-chart-3/20 text-chart-3',
    success: 'bg-chart-1/5 border-chart-1/20 text-chart-1',
    warning: 'bg-chart-4/5 border-chart-4/20 text-chart-4',
    error: 'bg-chart-5/5 border-chart-5/20 text-chart-5',
  };
  return (
    <div className={cn('border rounded-lg p-3 text-xs', styles[type])}>
      {children}
    </div>
  );
}