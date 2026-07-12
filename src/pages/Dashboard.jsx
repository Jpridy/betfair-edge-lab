import React from 'react';
import SafetyBanners from '@/components/controlroom/SafetyBanners';
import DashboardStatus from '@/components/dashboard/DashboardStatus';
import LatestDecision from '@/components/controlroom/LatestDecision';
import AIExecutionPanel from '@/components/controlroom/AIExecutionPanel';
import DashboardOpportunities from '@/components/dashboard/DashboardOpportunities';
import DashboardMarkets from '@/components/dashboard/DashboardMarkets';
import DashboardActivity from '@/components/dashboard/DashboardActivity';
import DashboardSummaryRow from '@/components/dashboard/DashboardSummaryRow';
import BotHealthPanel from '@/components/dashboard/BotHealthPanel';

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <SafetyBanners />
      <DashboardSummaryRow />
      <DashboardStatus />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <LatestDecision />
          <DashboardMarkets />
        </div>
        <div className="space-y-4">
          <BotHealthPanel />
          <AIExecutionPanel />
        </div>
      </div>
      <DashboardOpportunities />
      <DashboardActivity />
    </div>
  );
}