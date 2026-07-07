import React from 'react';
import BotStatusCard from '@/components/bot/BotStatusCard';
import BotControls from '@/components/bot/BotControls';
import BotLoopDisplay from '@/components/bot/BotLoopDisplay';
import BotRulesPanel from '@/components/bot/BotRulesPanel';
import LiveBotLockPanel from '@/components/bot/LiveBotLockPanel';
import BotScanStats from '@/components/bot/BotScanStats';
import BotSyncControls from '@/components/bot/BotSyncControls';
import StrategyControlPanel from '@/components/bot/StrategyControlPanel';

export default function BotControlCentre() {
  return (
    <div className="space-y-5">
      <BotControls />
      <StrategyControlPanel />
      <BotSyncControls />
      <BotScanStats />
      <BotStatusCard />
      <BotLoopDisplay />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BotRulesPanel />
        <LiveBotLockPanel />
      </div>
    </div>
  );
}