import React from 'react';
import { Panel } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, AlertOctagon } from 'lucide-react';

export default function BotControls() {
  const { botState, startBot, pauseBot, stopBot, triggerEmergencyStop, emergencyStop, mode } = useApp();

  return (
    <Panel title="Bot Start / Stop Controls">
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          onClick={startBot}
          disabled={emergencyStop || (botState.running && !botState.paused)}
          className="bg-chart-1 hover:bg-chart-1/90 text-background font-bold h-12"
        >
          <Play className="h-4 w-4" /> Start Paper Bot
        </Button>
        <Button
          onClick={pauseBot}
          disabled={emergencyStop || !botState.running || botState.paused}
          variant="outline"
          className="font-bold h-12 border-chart-4/50 text-chart-4 hover:bg-chart-4/10"
        >
          <Pause className="h-4 w-4" /> Pause Bot
        </Button>
        <Button
          onClick={stopBot}
          disabled={emergencyStop || !botState.running}
          variant="outline"
          className="font-bold h-12"
        >
          <Square className="h-4 w-4" /> Stop Bot
        </Button>
        <Button
          onClick={triggerEmergencyStop}
          disabled={emergencyStop}
          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold h-12 border-2 border-destructive/50"
        >
          <AlertOctagon className="h-4 w-4" /> Emergency Stop
        </Button>
      </div>
      <div className="px-4 pb-4 text-xs text-muted-foreground">
        {botState.running && !botState.paused && mode === 'paper' && 'Bot is running — automatically scanning markets, detecting signals, and creating paper orders.'}
        {botState.paused && 'Bot is paused — no new paper orders will be created. Markets are still being scanned.'}
        {!botState.running && !emergencyStop && 'Bot is stopped. Click "Start Paper Bot" to begin automated trading.'}
        {emergencyStop && '⚠ Emergency stop is active. All bot activity halted. Clear the emergency stop to resume.'}
      </div>
    </Panel>
  );
}