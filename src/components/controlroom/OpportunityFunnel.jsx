import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { cn } from '@/lib/utils';
import { Zap, Play } from 'lucide-react';

/**
 * Displays the opportunity-generation funnel from the last exchange engine run.
 * Shows exactly where the pipeline succeeds or fails after markets are loaded.
 */
export default function OpportunityFunnel() {
  const { lastExchangeDiagnostics, botCycles, runDebugScanCycle } = useApp();
  const lastCycle = botCycles[0];
  const diag = lastExchangeDiagnostics;

  // Try cycle's scanSummary first, then live diagnostics
  const funnel = lastCycle?.scanSummary?.opportunityFunnel || diag?.opportunityFunnel || null;

  if (!funnel && !diag) {
    return (
      <Panel title="Opportunity Funnel" subtitle="Step-by-step pipeline diagnostics">
        <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
          <Zap className="h-6 w-6 text-muted-foreground/40" />
          <span>No scan has run yet. Run a Debug Scan to see the full pipeline funnel.</span>
        </div>
      </Panel>
    );
  }

  // Build funnel from live diagnostics if no structured funnel
  const f = funnel || {
    currentMarketsInAppContext: diag?.totalMarketsLoaded ?? lastCycle?.marketsScanned ?? 0,
    currentRunnersInAppContext: diag?.marketFeedDiagnostics?.runnersInMemory ?? 0,
    currentPricedRunners: diag?.marketFeedDiagnostics?.runnersWithBackOrLay ?? 0,
    openPreRaceMarkets: diag?.openPreRaceMarkets ?? 0,
    marketsWithTwoActiveRunners: diag?.marketFilterFunnel?.marketsWithTwoActiveRunners ?? 0,
    marketsWithPriceData: diag?.marketFilterFunnel?.marketsWithPriceData ?? 0,
    eligibleMarkets: diag?.marketsSentToExchangeEngine ?? 0,
    eventClustersCreated: diag?.raceClustersCreated ?? 0,
    clustersWithPrimaryMarket: 0,
    clustersWithMatchedRunners: 0,
    aiResultsCreated: diag?.aiCallsMade ?? 0,
    marketOnlyResultsCreated: 0,
    opportunitiesGenerated: diag?.totalOpportunities ?? 0,
    backOpportunitiesGenerated: diag?.backOpportunities ?? 0,
    layOpportunitiesGenerated: diag?.layOpportunities ?? 0,
    proofModeDetectedInsideEngine: false,
    proofFallbackAttempted: false,
    proofFallbackCreated: false,
    proofFallbackBlockedReason: null,
  };

  const steps = [
    { label: 'Markets in App Context', value: f.currentMarketsInAppContext, ok: f.currentMarketsInAppContext > 0 },
    { label: 'Runners in App Context', value: f.currentRunnersInAppContext, ok: f.currentRunnersInAppContext > 0 },
    { label: 'Priced Runners', value: f.currentPricedRunners, ok: f.currentPricedRunners > 0 },
    { label: 'Open Pre-Race Markets', value: f.openPreRaceMarkets, ok: f.openPreRaceMarkets > 0 },
    { label: 'Markets with 2+ Active Runners', value: f.marketsWithTwoActiveRunners, ok: f.marketsWithTwoActiveRunners > 0 },
    { label: 'Markets with Price Data', value: f.marketsWithPriceData, ok: f.marketsWithPriceData > 0 },
    { label: 'Eligible Markets (passed all filters)', value: f.eligibleMarkets, ok: f.eligibleMarkets > 0 },
    { label: 'Event Clusters Created', value: f.eventClustersCreated, ok: f.eventClustersCreated > 0 },
    { label: 'Clusters with Primary Market', value: f.clustersWithPrimaryMarket, ok: f.clustersWithPrimaryMarket > 0 },
    { label: 'Clusters with Matched Runners', value: f.clustersWithMatchedRunners, ok: f.clustersWithMatchedRunners > 0 },
    { label: 'AI Results Created', value: f.aiResultsCreated, ok: true },
    { label: 'Market-Only Results Created', value: f.marketOnlyResultsCreated, ok: true },
    { label: 'Opportunities Generated', value: f.opportunitiesGenerated, ok: f.opportunitiesGenerated > 0, highlight: true },
    { label: 'BACK Opportunities', value: f.backOpportunitiesGenerated, ok: true },
    { label: 'LAY Opportunities', value: f.layOpportunitiesGenerated, ok: true },
  ];

  // Find the first break point
  const breakStep = steps.find(s => !s.ok && s.label !== 'AI Results Created' && s.label !== 'Market-Only Results Created' && s.label !== 'BACK Opportunities' && s.label !== 'LAY Opportunities');

  return (
    <Panel
      title="Opportunity Funnel"
      subtitle="Traces market data → opportunity generation pipeline"
      action={
        <div className="flex items-center gap-2">
          {f.proofModeDetectedInsideEngine && <StatusBadge status="ok">Proof Mode</StatusBadge>}
          {diag?.debugScanMode && <StatusBadge status="info">Debug</StatusBadge>}
        </div>
      }
    >
      <div className="divide-y divide-border-subtle">
        {steps.map((step, i) => (
          <div key={i} className={cn(
            'flex items-center justify-between px-4 py-2 text-xs',
            step.highlight && 'bg-primary/5',
            breakStep === step && 'bg-danger/5'
          )}>
            <div className="flex items-center gap-2">
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold',
                step.ok ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
              )}>
                {step.ok ? '✓' : '✗'}
              </span>
              <span className="font-body text-muted-foreground">{step.label}</span>
            </div>
            <span className={cn(
              'font-mono font-bold tabular-nums',
              step.highlight ? 'text-primary text-sm' : 'text-foreground'
            )}>
              {step.value}
            </span>
          </div>
        ))}
      </div>

      {/* Proof fallback section */}
      {(f.proofModeDetectedInsideEngine || f.proofFallbackAttempted) && (
        <div className="px-4 py-3 border-t border-border bg-muted/20">
          <div className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Paper Proof Fallback</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <FunnelItem label="Proof Mode (Engine)" value={f.proofModeDetectedInsideEngine ? 'YES' : 'NO'} ok={f.proofModeDetectedInsideEngine} />
            <FunnelItem label="Fallback Attempted" value={f.proofFallbackAttempted ? 'YES' : 'NO'} ok={true} />
            <FunnelItem label="Fallback Created" value={f.proofFallbackCreated ? 'YES' : 'NO'} ok={f.proofFallbackCreated} />
          </div>
          {f.proofFallbackBlockedReason && (
            <div className="mt-2 text-xs text-danger font-body">
              <span className="font-bold">Fallback blocked:</span> {f.proofFallbackBlockedReason}
            </div>
          )}
        </div>
      )}

      {/* Break point explanation */}
      {breakStep && (
        <div className="px-4 py-2.5 border-t border-border bg-danger/5 text-xs text-danger">
          <span className="font-bold">Pipeline stops at:</span> {breakStep.label} = {breakStep.value}.
          {' '}This is where opportunities stop being generated.
        </div>
      )}

      {/* No break but no opportunities */}
      {!breakStep && f.opportunitiesGenerated === 0 && f.eligibleMarkets > 0 && (
        <div className="px-4 py-2.5 border-t border-border bg-warning/5 text-xs text-warning">
          Markets are eligible but 0 opportunities were generated. Check AI/market-only probability generation or safety gate thresholds.
        </div>
      )}
    </Panel>
  );
}

function FunnelItem({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between bg-card rounded px-2 py-1">
      <span className="text-muted-foreground text-[10px]">{label}</span>
      <span className={cn('font-mono font-bold', ok ? 'text-success' : 'text-danger')}>{value}</span>
    </div>
  );
}