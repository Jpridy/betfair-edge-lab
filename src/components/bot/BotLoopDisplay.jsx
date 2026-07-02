import React from 'react';
import { Panel } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_CONFIG = {
  waiting: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/20', border: 'border-border', label: 'Waiting' },
  running: { icon: Loader2, color: 'text-chart-4', bg: 'bg-chart-4/10', border: 'border-chart-4/30', label: 'Running' },
  passed: { icon: CheckCircle2, color: 'text-chart-1', bg: 'bg-chart-1/10', border: 'border-chart-1/30', label: 'Passed' },
  blocked: { icon: XCircle, color: 'text-chart-5', bg: 'bg-chart-5/10', border: 'border-chart-5/30', label: 'Blocked' },
  failed: { icon: AlertTriangle, color: 'text-chart-5', bg: 'bg-chart-5/10', border: 'border-chart-5/30', label: 'Failed' },
};

export default function BotLoopDisplay() {
  const { botState } = useApp();

  return (
    <Panel title="Bot Loop — Step by Step">
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-4">
          Each cycle, the bot follows these steps in order. If a step is blocked or fails, you'll see the reason here in plain English.
        </p>
        <div className="space-y-0.5">
          {botState.stepStatuses.map((step, i) => {
            const config = STEP_CONFIG[step.status] || STEP_CONFIG.waiting;
            const Icon = config.icon;
            const isLast = i === botState.stepStatuses.length - 1;
            return (
              <div key={i}>
                <div className={cn('flex items-center gap-3 p-2.5 rounded-lg border', config.border, config.bg)}>
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', config.bg, config.color)}>
                    <Icon className={cn('h-4 w-4', step.status === 'running' && 'animate-spin')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">{i + 1}</span>
                      <span className="text-xs font-medium text-foreground">{step.name}</span>
                    </div>
                    {step.reason && (step.status === 'blocked' || step.status === 'failed') && (
                      <div className="text-[11px] text-chart-5 mt-0.5 font-medium">
                        {step.reason}
                      </div>
                    )}
                  </div>
                  <span className={cn('text-[10px] font-bold uppercase', config.color)}>{config.label}</span>
                </div>
                {!isLast && (
                  <div className="flex justify-center py-0.5">
                    <ChevronDown className="h-3 w-3 text-muted-foreground/30" />
                  </div>
                )}
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