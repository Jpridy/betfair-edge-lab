import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/lib/AppContext';
import ControlBar from '@/components/controlroom/ControlBar';
import SafetyBanners from '@/components/controlroom/SafetyBanners';
import SystemHealthRow from '@/components/controlroom/SystemHealthRow';
import LatestDecision from '@/components/controlroom/LatestDecision';
import DecisionTimeline from '@/components/controlroom/DecisionTimeline';
import MarketFeedPanel from '@/components/controlroom/MarketFeedPanel';
import OpportunitiesPanel from '@/components/controlroom/OpportunitiesPanel';
import AIResearchPanel from '@/components/controlroom/AIResearchPanel';
import SettingsImpactPanel from '@/components/controlroom/SettingsImpactPanel';
import RiskOrdersPanel from '@/components/controlroom/RiskOrdersPanel';
import SettlementPanel from '@/components/controlroom/SettlementPanel';
import DecisionLogPanel from '@/components/bot/DecisionLogPanel';

export default function BotControlCentre() {
  const { dataLoading } = useApp();

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Safety banners — always at top */}
      <SafetyBanners />

      {/* Sticky control bar */}
      <ControlBar />

      {/* Tabbed sections */}
      <Tabs defaultValue="control">
        <TabsList className="bg-card border border-border flex-wrap h-auto">
          <TabsTrigger value="control" className="text-xs">Control</TabsTrigger>
          <TabsTrigger value="markets" className="text-xs">Markets & Opportunities</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">AI Research</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">Settings Impact</TabsTrigger>
          <TabsTrigger value="risk" className="text-xs">Risk & Orders</TabsTrigger>
          <TabsTrigger value="debug" className="text-xs">Debug & Logs</TabsTrigger>
        </TabsList>

        {/* Tab 1: Control — system health, latest decision, timeline */}
        <TabsContent value="control" className="space-y-4 mt-4">
          <SystemHealthRow />
          <LatestDecision />
          <DecisionTimeline />
        </TabsContent>

        {/* Tab 2: Markets & Opportunities */}
        <TabsContent value="markets" className="space-y-4 mt-4">
          <MarketFeedPanel />
          <OpportunitiesPanel />
        </TabsContent>

        {/* Tab 3: AI Research */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <AIResearchPanel />
        </TabsContent>

        {/* Tab 4: Settings Impact */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <SettingsImpactPanel />
        </TabsContent>

        {/* Tab 5: Risk & Orders */}
        <TabsContent value="risk" className="space-y-4 mt-4">
          <RiskOrdersPanel />
          <SettlementPanel />
        </TabsContent>

        {/* Tab 6: Debug & Logs */}
        <TabsContent value="debug" className="space-y-4 mt-4">
          <DecisionLogPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}