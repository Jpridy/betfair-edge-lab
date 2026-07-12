import React from 'react';
import NextAction from '@/components/shared/NextAction';
import SafetyBanners from '@/components/controlroom/SafetyBanners';
import SystemStatusStrip from '@/components/dashboard/SystemStatusStrip';
import MainMoneyRow from '@/components/dashboard/MainMoneyRow';
import CurrentRaceCard from '@/components/dashboard/CurrentRaceCard';
import LatestDecisionCard from '@/components/dashboard/LatestDecisionCard';
import BotActionCard from '@/components/dashboard/BotActionCard';
import RecentActivity from '@/components/dashboard/RecentActivity';

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <SafetyBanners />
      <NextAction />
      <SystemStatusStrip />
      <MainMoneyRow />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <CurrentRaceCard />
          <LatestDecisionCard />
        </div>
        <div className="space-y-4">
          <BotActionCard />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}