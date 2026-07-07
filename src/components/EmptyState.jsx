import React from 'react';
import { cn } from '@/lib/utils';

export default function EmptyState({ icon: Icon, title, message, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/50 mb-3" />}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {message && <p className="text-xs text-muted-foreground mt-1 max-w-md">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}