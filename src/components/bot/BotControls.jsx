import React from 'react';
import { Panel } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Play, Pause, Square, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';

const colorMap = {
  'success': { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  'warning': { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  'foreground': { bg: '', text: 'text-foreground', border: 'border-border' },
  'danger': { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20' },
};

export default function BotControls() {
  const { botState, startBot, pauseBot, stopBot, triggerEmergencyStop, emergencyStop } = useApp();
  const isRunning = botState.running && !botState.paused;

  const buttons = [
    {
      label: 'Start Paper Bot',
      helper: 'Starts automatic scanning and simulated paper trading.',
      icon: Play,
      onClick: startBot,
      disabled: emergencyStop || (botState.running && !botState.paused),
      color: 'success',
    },
    {
      label: 'Pause Paper Bot',
      helper: 'Stops new paper trades but keeps the dashboard running.',
      icon: Pause,
      onClick: pauseBot,
      disabled: emergencyStop || !botState.running || botState.paused,
      color: 'warning',
    },
    {
      label: 'Stop Paper Bot',
      helper: 'Stops scanning, signals, and paper trading.',
      icon: Square,
      onClick: stopBot,
      disabled: emergencyStop || !botState.running,
      color: 'foreground',
    },
    {
      label: 'Emergency Stop',
      helper: 'Immediately stops all bot activity.',
      icon: AlertOctagon,
      onClick: triggerEmergencyStop,
      disabled: emergencyStop,
      color: 'danger',
    },
  ];

  return (
    <Panel title="Bot Controls">
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {buttons.map(btn => {
          const Icon = btn.icon;
          const c = colorMap[btn.color];
          return (
            <button
              key={btn.label}
              onClick={btn.onClick}
              disabled={btn.disabled}
              className={cn(
                'flex flex-col items-start p-4 rounded-lg border transition-all text-left',
                c.bg, c.border,
                btn.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02] cursor-pointer'
              )}
            >
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', c.bg, c.text)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className={cn('text-sm font-bold mb-1', c.text)}>{btn.label}</div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">{btn.helper}</div>
            </button>
          );
        })}
      </div>
      <div className="px-4 pb-4">
        <div className={cn(
          'text-xs font-medium px-3 py-2 rounded-md border',
          emergencyStop ? 'bg-danger/10 border-danger/30 text-danger'
          : isRunning ? 'bg-success/10 border-success/30 text-success'
          : botState.paused ? 'bg-warning/10 border-warning/30 text-warning'
          : 'bg-muted border-border text-muted-foreground'
        )}>
          {emergencyStop && '⚠ Emergency stop is active. All bot activity halted. Clear the emergency stop to resume.'}
          {!emergencyStop && isRunning && '✓ Bot is running — automatically scanning markets, detecting signals, and creating paper orders.'}
          {!emergencyStop && botState.paused && '⏸ Bot is paused — no new paper orders will be created. Markets are still being scanned.'}
          {!emergencyStop && !botState.running && 'Bot is stopped. Press "Start Paper Bot" to begin automated paper trading.'}
        </div>
      </div>
    </Panel>
  );
}