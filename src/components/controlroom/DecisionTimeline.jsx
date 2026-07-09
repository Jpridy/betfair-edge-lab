import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/Trading';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, ChevronDown, ChevronRight, MinusCircle } from 'lucide-react';

export default function DecisionTimeline() {
  const { botCycles, lastExchangeDiagnostics } = useApp();
  const [expanded, setExpanded] = useState(null);
  const lastCycle = botCycles[0];
  const diag = lastExchangeDiagnostics;

  if (!lastCycle) {
    return (
      <Panel title="Decision Timeline">
        <div className="p-6 text-center text-sm text-muted-foreground">
          No cycles yet. Run a scan to see the step-by-step decision timeline.
        </div>
      </Panel>
    );
  }

  const scan = lastCycle.scanSummary || {};
  const extDiag = scan.externalSearchDiagnostics || diag?.externalSearchDiagnostics || {};
  const marketsLoaded = scan.totalMarketsLoaded ?? diag?.totalMarketsLoaded ?? lastCycle.marketsScanned ?? 0;
  const marketsSent = scan.marketsSentToExchangeEngine ?? diag?.marketsSentToExchangeEngine ?? lastCycle.marketsPassedFilters ?? 0;
  const totalOpps = scan.totalOpportunities ?? diag?.totalOpportunities ?? 0;
  const best = lastCycle.bestCandidate;

  const steps = [
    {
      id: 1,
      name: 'Markets Loaded',
      status: marketsLoaded > 0 ? 'passed' : 'failed',
      count: marketsLoaded,
      reason: `${marketsLoaded} markets loaded from Betfair stream`,
      detail: scan.marketFeedDiagnostics ? JSON.stringify(scan.marketFeedDiagnostics, null, 2) : null,
    },
    {
      id: 2,
      name: 'Markets Filtered',
      status: marketsSent > 0 ? 'passed' : 'failed',
      count: marketsSent,
      reason: `${scan.openPreRaceMarkets ?? diag?.openPreRaceMarkets ?? 0} open pre-race, ${scan.marketsInsideTimeWindow ?? diag?.marketsInsideTimeWindow ?? 0} inside time window`,
      detail: scan.timeWindowFunnel ? JSON.stringify(scan.timeWindowFunnel, null, 2) : null,
    },
    {
      id: 3,
      name: 'Opportunities Generated',
      status: totalOpps > 0 ? 'passed' : 'failed',
      count: totalOpps,
      reason: `${totalOpps} opportunities (${scan.backOpportunities ?? 0} BACK, ${scan.layOpportunities ?? 0} LAY), ${scan.positiveEVOpportunities ?? 0} positive EV`,
      detail: scan.topOpportunities ? JSON.stringify(scan.topOpportunities.slice(0, 5), null, 2) : null,
    },
    {
      id: 4,
      name: 'OpenAI Web Search',
      status: !extDiag.enabled ? 'skipped' : extDiag.errors > 0 ? 'failed' : extDiag.callsThisCycle > 0 ? 'passed' : 'skipped',
      count: extDiag.callsThisCycle || 0,
      reason: extDiag.enabled
        ? `${extDiag.callsThisCycle || 0} calls, ${extDiag.totalSourcesFound || 0} sources, ${extDiag.cacheHits || 0} cache hits`
        : 'External search disabled',
      detail: extDiag.perEventResults ? JSON.stringify(extDiag.perEventResults, null, 2) : null,
    },
    {
      id: 5,
      name: 'Featherless AI',
      status: !diag?.aiCallsMade && !scan.aiCallsMade && !scan.aiStatusLog?.length ? 'skipped' : (scan.eventsWithAI ?? diag?.eventsWithAI) > 0 ? 'passed' : 'failed',
      count: scan.eventsWithAI ?? diag?.eventsWithAI ?? 0,
      reason: `${scan.aiCallsMade ?? diag?.aiCallsMade ?? 0} AI calls, ${scan.aiCacheHits ?? diag?.aiCacheHits ?? 0} cache hits, ${scan.eventsWithAI ?? 0} events with probabilities`,
      detail: diag?.aiStatusLog || scan.aiStatusLog ? JSON.stringify(diag?.aiStatusLog || scan.aiStatusLog, null, 2) : null,
    },
    {
      id: 6,
      name: 'Probability Finalised',
      status: best && (best.finalProbabilityUsedInEV != null || best.modelProbability != null || best.estimatedProbability != null) ? 'passed' : 'failed',
      count: best ? 1 : 0,
      reason: best
        ? `${best.runnerName}: ${((best.finalProbabilityUsedInEV ?? best.modelProbability ?? best.estimatedProbability ?? 0) * 100).toFixed(1)}% probability used in EV`
        : 'No probability finalised — no best candidate selected',
      detail: null,
    },
    {
      id: 7,
      name: 'EV Calculated',
      status: best && best.ev != null ? 'passed' : 'failed',
      count: best ? 1 : 0,
      reason: best
        ? `EV: $${(best.ev || 0).toFixed(2)}, ROI: ${((best.expectedROI || best.roi || 0) * 100).toFixed(1)}%`
        : 'No EV calculated — no opportunity selected',
      detail: null,
    },
    {
      id: 8,
      name: 'Safety Gates Checked',
      status: best ? (best.blockers?.length > 0 || best.failedGate ? 'failed' : 'passed') : 'skipped',
      count: best?.blockers?.length || 0,
      reason: best?.failedGate || best?.mainBlocker || best?.blockers?.[0] || (best ? 'All gates passed' : 'No candidate to check'),
      detail: best?.blockers ? JSON.stringify(best.blockers, null, 2) : null,
    },
    {
      id: 9,
      name: 'Risk Check',
      status: lastCycle.ordersCreated > 0 ? 'passed' : lastCycle.ordersBlocked > 0 && best?.failedGate ? 'failed' : 'skipped',
      count: lastCycle.ordersCreated,
      reason: lastCycle.noBetReason && lastCycle.ordersCreated === 0 ? lastCycle.noBetReason : lastCycle.ordersCreated > 0 ? 'Risk check passed' : 'No order to check',
      detail: null,
    },
    {
      id: 10,
      name: 'Order Created / Rejected',
      status: lastCycle.ordersCreated > 0 ? 'passed' : lastCycle.ordersBlocked > 0 ? 'failed' : (lastCycle.debugOnly ? 'skipped' : 'skipped'),
      count: lastCycle.ordersCreated + lastCycle.ordersBlocked,
      reason: lastCycle.ordersCreated > 0
        ? `Paper order created: ${best?.side} ${best?.runnerName} @ ${best?.odds?.toFixed(2)}`
        : lastCycle.ordersBlocked > 0 ? `Order blocked: ${lastCycle.noBetReason || best?.failedGate || 'Unknown'}` : lastCycle.debugOnly ? 'Debug scan — no order created' : 'No order action',
      detail: null,
    },
    {
      id: 11,
      name: 'Settlement Status',
      status: 'skipped',
      count: 0,
      reason: 'Settlement occurs automatically when the market closes via Betfair stream',
      detail: null,
    },
  ];

  const statusConfig = {
    passed: { icon: CheckCircle2, color: 'text-chart-1', bg: 'bg-chart-1/10' },
    failed: { icon: XCircle, color: 'text-chart-5', bg: 'bg-chart-5/10' },
    skipped: { icon: MinusCircle, color: 'text-muted-foreground', bg: 'bg-muted/20' },
  };

  return (
    <Panel title={`Decision Timeline — Cycle #${lastCycle.cycleNumber}`}>
      <div className="divide-y divide-border">
        {steps.map(step => {
          const config = statusConfig[step.status] || statusConfig.skipped;
          const Icon = config.icon;
          const isExpanded = expanded === step.id;
          const hasDetail = !!step.detail;

          return (
            <div key={step.id}>
              <button
                onClick={() => hasDetail && setExpanded(isExpanded ? null : step.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors',
                  !hasDetail && 'cursor-default'
                )}
              >
                <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0', config.bg)}>
                  <Icon className={cn('h-4 w-4', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">{step.id}.</span>
                    <span className="text-xs font-bold text-foreground">{step.name}</span>
                    {step.count > 0 && <span className="text-[10px] font-mono text-muted-foreground">({step.count})</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{step.reason}</div>
                </div>
                {hasDetail && (isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />)}
              </button>
              {isExpanded && step.detail && (
                <div className="px-4 pb-3">
                  <pre className="text-[9px] font-mono text-muted-foreground bg-muted/30 rounded p-2 overflow-auto max-h-48">{step.detail}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}