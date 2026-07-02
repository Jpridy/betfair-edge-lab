import React from 'react';
import { Panel } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_ICONS = {
  waiting: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/20' },
  running: { icon: Loader2, color: 'text-chart-4', bg: 'bg-chart-4/10' },
  passed: { icon: CheckCircle2, color: 'text-chart-1', bg: 'bg-chart-1/10' },
  blocked: { icon: XCircle, color: 'text-chart-5', bg: 'bg-chart-5/10' },
  failed: { icon: AlertTriangle, color: 'text-chart-5', bg: 'bg-chart-5/10' },
};

export default function BotLoopDisplay() {
  const { botState } = useApp();

  return (
    <Panel title="Bot Loop Display">
      <div className="p-4">
        <div className="flex flex-wrap gap-3">
          {botState.stepStatuses.map((step, i) => {
            const config = STEP_ICONS[step.status] || STEP_ICONS.waiting;
            const Icon = config.icon;
            return (
              <div key={i} className="flex flex-col items-center" style={{ width: '80px' }}>
                <div className={cn('w-11 h-11 rounded-full flex items-center justify-center border-2', config.bg, config.color)}>
                  <Icon className={cn('h-5 w-5', step.status === 'running' && 'animate-spin')} />
                </div>
                <div className={cn('text-[10px] font-medium text-center mt-1.5 leading-tight', config.color)}>
                  {step.name}
                </div>
                <div className={cn('text-[9px] font-bold uppercase mt-0.5', config.color)}>
                  {step.status}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Cycle #{botState.cycleNumber}</span>
          <span className="text-muted-foreground">
            {botState.lastCycleTime ? `Last: ${new Date(botState.lastCycleTime).toLocaleTimeString('en-AU', { hour12: false })}` : 'No cycles yet'}
          </span>
        </div>
      </div>
    </Panel>
  );
}