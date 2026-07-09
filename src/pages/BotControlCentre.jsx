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
import PaperProofPanel from '@/components/controlroom/PaperProofPanel';
import { isPaperProofModeActive } from '@/lib/paperProofDefaults';
import { FlaskConical } from 'lucide-react';

export default function BotControlCentre() {
  const { dataLoading, settings, botSettings, featherlessSettings, botCycles, exchangeOpportunities, paperOrders, markets } = useApp();

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-7 h-7 border-[3px] border-border-subtle border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const proofActive = isPaperProofModeActive(settings, botSettings, featherlessSettings);
  const lastCycle = botCycles[0];
  const openOrders = paperOrders.filter(o => ['pending', 'matched', 'partially_matched', 'executable'].includes(o.status)).length;
  const awaitingSettlement = paperOrders.filter(o => o.status === 'awaiting_result').length;
  const bestEV = exchangeOpportunities?.length > 0
    ? Math.max(...exchangeOpportunities.map(o => o.ev || 0))
    : lastCycle?.bestCandidate?.ev || 0;
  const bestROI = exchangeOpportunities?.length > 0
    ? Math.max(...exchangeOpportunities.map(o => (o.roi || o.expectedROI || 0) * 100))
    : (lastCycle?.bestCandidate?.expectedROI || 0) * 100;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Critical safety banners only */}
      <SafetyBanners />

      {/* Paper Proof Mode pill */}
      {proofActive && (
        <div className="inline-flex items-center gap-2 bg-warning/10 text-warning px-3 py-1.5 rounded-md text-[11px] font-body font-semibold border border-warning/25 tracking-label">
          <FlaskConical className="h-3.5 w-3.5" />
          PAPER PROOF MODE — filters relaxed for pipeline testing
        </div>
      )}

      {/* Sticky control bar */}
      <ControlBar />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryMetric label="Markets" value={markets.length || 0} />
        <SummaryMetric label="Opportunities" value={exchangeOpportunities?.length || lastCycle?.scanSummary?.totalOpportunities || 0} />
        <SummaryMetric label="Best EV" value={`$${(bestEV || 0).toFixed(2)}`} accent="text-success" />
        <SummaryMetric label="Best ROI" value={`${(bestROI || 0).toFixed(1)}%`} accent="text-success" />
        <SummaryMetric label="Open Orders" value={openOrders} accent={openOrders > 0 ? 'text-info' : ''} />
        <SummaryMetric label="Awaiting" value={awaitingSettlement} accent={awaitingSettlement > 0 ? 'text-warning' : ''} />
      </div>

      {/* Tabbed sections */}
      <Tabs defaultValue="control">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="control">Control</TabsTrigger>
          <TabsTrigger value="markets">Markets & Opportunities</TabsTrigger>
          <TabsTrigger value="ai">AI Research</TabsTrigger>
          <TabsTrigger value="settings">Settings Impact</TabsTrigger>
          <TabsTrigger value="risk">Risk & Orders</TabsTrigger>
          <TabsTrigger value="proof">Paper Proof</TabsTrigger>
          <TabsTrigger value="debug">Debug & Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-5">
          <SystemHealthRow />
          <LatestDecision />
          <DecisionTimeline />
        </TabsContent>

        <TabsContent value="markets" className="space-y-5">
          <MarketFeedPanel />
          <OpportunitiesPanel />
        </TabsContent>

        <TabsContent value="ai" className="space-y-5">
          <AIResearchPanel />
        </TabsContent>

        <TabsContent value="settings" className="space-y-5">
          <SettingsImpactPanel />
        </TabsContent>

        <TabsContent value="risk" className="space-y-5">
          <RiskOrdersPanel />
          <SettlementPanel />
        </TabsContent>

        <TabsContent value="proof" className="space-y-5">
          <PaperProofPanel />
        </TabsContent>

        <TabsContent value="debug" className="space-y-5">
          <DecisionLogPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryMetric({ label, value, accent }) {
  return (
    <div className="bg-card border border-border-subtle rounded-lg p-3.5 hover:border-border transition-colors">
      <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label mb-1">{label}</div>
      <div className={`text-xl font-heading font-semibold tabular-nums tracking-tight-brand ${accent || 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}