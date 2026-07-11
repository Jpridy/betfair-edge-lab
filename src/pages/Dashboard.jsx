import React from 'react';
import SafetyBanners from '@/components/controlroom/SafetyBanners';
import DashboardStatus from '@/components/dashboard/DashboardStatus';
import LatestDecision from '@/components/controlroom/LatestDecision';
import AIExecutionPanel from '@/components/controlroom/AIExecutionPanel';
import DashboardOpportunities from '@/components/dashboard/DashboardOpportunities';
import DashboardMarkets from '@/components/dashboard/DashboardMarkets';
import DashboardActivity from '@/components/dashboard/DashboardActivity';

export default function Dashboard() {
  return <div className="space-y-5">
    <SafetyBanners />
    <DashboardStatus />
    <LatestDecision />
    <AIExecutionPanel />
    <DashboardOpportunities />
    <div className="grid gap-5 xl:grid-cols-2"><DashboardMarkets /><DashboardActivity /></div>
  </div>;
}