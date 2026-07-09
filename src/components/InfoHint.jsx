import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * InfoHint — small, consistent inline hint for field help, explanations, and minor warnings.
 * - muted by default (not visually loud)
 * - optional expandable for longer text
 * - use `tone` for warning/danger/info emphasis
 */
export default function InfoHint({ text, expandable, children, tone, className }) {
  const [expanded, setExpanded] = useState(false);
  const toneClass = {
    warning: 'text-warning',
    danger: 'text-danger',
    info: 'text-info',
    default: 'text-muted-foreground',
  }[tone || 'default'];

  if (expandable) {
    return (
      <div className={cn('text-[10px] font-body leading-relaxed', toneClass, className)}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 hover:underline"
        >
          <Info className="h-3 w-3 shrink-0" />
          <span>{text}</span>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {expanded && (
          <div className="mt-1 opacity-90">
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-start gap-1 text-[10px] font-body leading-relaxed', toneClass, className)}>
      <Info className="h-3 w-3 shrink-0 mt-0.5" />
      <span>{text || children}</span>
    </div>
  );
}