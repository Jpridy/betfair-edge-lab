import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { cn } from '@/lib/utils';
import { Search, Eye, Brain, ShieldCheck, Target, FileText, Clock } from 'lucide-react';

const STEPS = [
  { name: 'Scanning market', icon: Search },
  { name: 'Reading prices', icon: Eye },
  { name: 'Running model', icon: Brain },
  { name: 'Checking rules', icon: ShieldCheck },
  { name: 'Making decision', icon: Target },
  { name: 'Creating paper order', icon: FileText },
  { name: 'Waiting for result', icon: Clock },
];

export default function BotStatusProgress() {
  const { botCycles } = useApp();
  const lastCycle = botCycles[0];
  const cycleSteps = lastCycle?.cycleSteps || [];
  const lastCompletedStage = lastCycle?.lastCompletedStage || lastCycle?.scanStage || '';

  // Map cycle steps to the 7 simplified steps
  const stepStatuses = STEPS.map((step, idx) => {
    const matching = cycleSteps.find(s =>
      s.step?.toLowerCase().includes(step.name.toLowerCase().split(' ')[0]) ||
      (idx === 0 && s.step?.toLowerCase().includes('scan')) ||
      (idx === 1 && s.step?.toLowerCase().includes('price')) ||
      (idx === 2 && (s.step?.toLowerCase().includes('model') || s.step?.toLowerCase().includes('ai'))) ||
      (idx === 3 && s.step?.toLowerCase().includes('gate')) ||
      (idx === 4 && s.step?.toLowerCase().includes('rank')) ||
      (idx === 5 && s.step?.toLowerCase().includes('order')) ||
      (idx === 6 && s.step?.toLowerCase().includes('settl'))
    );
    if (matching) return matching.status;
    // Fallback: infer from stage
    const stageLower = lastCompletedStage.toLowerCase();
    if (idx === 0 && stageLower.includes('scan')) return 'passed';
    if (stageLower.includes('complete')) return idx <= 6 ? 'passed' : 'pending';
    return 'pending';
  });

  const currentStep = stepStatuses.findIndex(s => s === 'running' || s === 'in_progress' || s === 'pending');
  const activeIdx = currentStep === -1 ? STEPS.length - 1 : currentStep;

  return (
    <Panel title="Bot Status" subtitle="Current step in the cycle pipeline">
      <div className="p-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const status = stepStatuses[idx];
            const isPassed = status === 'passed' || status === 'completed' || status === 'success';
            const isRunning = status === 'running' || status === 'in_progress';
            const isFailed = status === 'failed' || status === 'error';
            const isActive = idx === activeIdx && !isPassed;

            return (
              <React.Fragment key={step.name}>
                <div className={cn(
                  'flex flex-col items-center gap-1.5 shrink-0 min-w-[80px]',
                )}>
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors',
                    isPassed && 'bg-success/15 border-success text-success',
                    isRunning && 'bg-info/15 border-info text-info animate-pulse-dot',
                    isFailed && 'bg-danger/15 border-danger text-danger',
                    !isPassed && !isRunning && !isFailed && 'bg-muted border-border text-muted-foreground',
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={cn(
                    'text-[9px] font-medium text-center leading-tight',
                    isPassed ? 'text-success' : isRunning ? 'text-info' : isFailed ? 'text-danger' : 'text-muted-foreground',
                  )}>{step.name}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn('h-0.5 flex-1 min-w-[12px] rounded-full', isPassed ? 'bg-success' : 'bg-border')} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}