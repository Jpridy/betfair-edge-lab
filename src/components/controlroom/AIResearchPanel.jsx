import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { cn } from '@/lib/utils';
import { Brain, CheckCircle2, XCircle, Globe } from 'lucide-react';
import OpenAISearchDebugPanel from '@/components/bot/OpenAISearchDebugPanel';
import ExternalSearchTestButton from '@/components/bot/ExternalSearchTestButton';

export default function AIResearchPanel() {
  const { featherlessSettings, lastExchangeDiagnostics, aiDecisions, botCycles } = useApp();

  const aiEnabled = featherlessSettings?.enabled === true;
  const extEnabled = featherlessSettings?.externalSearchEnabled === true;
  const aiDiag = lastExchangeDiagnostics;
  const lastAI = aiDecisions[0];

  const aiStatusLog = aiDiag?.aiStatusLog || [];
  const lastAIStatus = aiStatusLog[aiStatusLog.length - 1];
  const aiError = aiStatusLog.find(s => s.status === 'ai_error');

  return (
    <div className="space-y-5">
      {/* AI Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Featherless AI */}
        <Panel title="Featherless AI" subtitle="Probability estimation engine">
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className={cn('h-4 w-4', aiEnabled ? 'text-primary' : 'text-muted-foreground')} />
                <span className="text-sm font-body font-semibold text-foreground">Status</span>
              </div>
              <StatusBadge status={aiEnabled ? 'ok' : 'neutral'}>
                {aiEnabled ? 'ENABLED' : 'DISABLED'}
              </StatusBadge>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <Stat label="Model" value={featherlessSettings?.modelName || '—'} />
              <Stat label="Events with AI" value={aiDiag?.eventsWithAI || 0} />
              <Stat label="AI Calls" value={aiDiag?.aiCallsMade || 0} />
              <Stat label="Cache Hits" value={aiDiag?.aiCacheHits || 0} />
            </div>
            {aiError && (
              <div className="text-[11px] text-danger bg-danger/8 border border-danger/20 rounded-md p-2.5 font-body">
                <span className="font-semibold">Error:</span> {aiError.reason || 'Unknown error'}
              </div>
            )}
            {lastAI && (
              <div className="text-xs space-y-1.5 border-t border-border-subtle pt-3">
                <div className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-label">Latest AI Decision</div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={lastAI.decision === 'BET' ? 'ok' : 'warning'}>{lastAI.decision}</StatusBadge>
                  <span className="text-foreground font-body font-medium">{lastAI.selectedRunner || '—'}</span>
                </div>
                <div className="text-muted-foreground font-body">
                  Prob: <span className="font-mono tabular-nums">{((lastAI.estimatedProbability || 0) * 100).toFixed(1)}%</span> · Fair Odds: <span className="font-mono">{lastAI.fairOdds?.toFixed(2) || '—'}</span> · Edge: <span className="font-mono">{(lastAI.valueEdge || 0).toFixed(1)}%</span>
                </div>
                <div className="text-muted-foreground text-[10px] font-body">
                  Confidence: <span className="font-mono">{lastAI.confidence || 0}</span> · Data Quality: <span className="font-mono">{lastAI.dataQualityScore || 0}</span>
                </div>
                {lastAI.mainReason && (
                  <div className="text-foreground text-[11px] mt-1 font-body">{lastAI.mainReason}</div>
                )}
              </div>
            )}
            {/* Pre/Post search probability comparison */}
            {(() => {
              const extDiag = aiDiag?.externalSearchDiagnostics || botCycles?.[0]?.scanSummary?.externalSearchDiagnostics;
              const bestOpp = botCycles?.[0]?.bestCandidate;
              const preSearch = bestOpp?.preSearchProbability;
              const postSearch = bestOpp?.postSearchProbability;
              const delta = bestOpp?.probabilityDelta;
              const decisionImpact = bestOpp?.decisionImpact;
              if (extEnabled && extDiag && extDiag.callsThisCycle > 0) {
                return (
                  <div className="text-xs border-t border-border-subtle pt-3 space-y-1.5">
                    <div className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-label">OpenAI Search Impact (Latest Cycle)</div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Stat label="Search Calls" value={extDiag.callsThisCycle || 0} />
                      <Stat label="Sources Found" value={extDiag.totalSourcesFound || 0} />
                      <Stat label="Cache Hits" value={extDiag.cacheHits || 0} />
                      <Stat label="Errors" value={extDiag.errors || 0} iconColor={extDiag.errors > 0 ? 'text-danger' : 'text-success'} />
                    </div>
                    {preSearch != null && postSearch != null && (
                      <div className="bg-muted/30 border border-border-subtle rounded-md p-2.5 space-y-0.5">
                        <div className="flex justify-between"><span className="text-muted-foreground font-body">Pre-search prob:</span><span className="font-mono tabular-nums">{(preSearch * 100).toFixed(1)}%</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground font-body">Post-search prob:</span><span className="font-mono tabular-nums">{(postSearch * 100).toFixed(1)}%</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground font-body">Delta:</span><span className={cn('font-mono tabular-nums font-semibold', Math.abs(delta || 0) > 0.01 ? 'text-primary' : 'text-muted-foreground')}>{((delta || 0) * 100).toFixed(2)}%</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground font-body">Decision impact:</span><span className="font-mono text-info">{decisionImpact || 'no_effect'}</span></div>
                      </div>
                    )}
                  </div>
                );
              } else if (extEnabled) {
                return (
                  <div className="text-xs border-t border-border-subtle pt-3">
                    <div className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-label">OpenAI Search</div>
                    <div className="text-muted-foreground font-body text-[11px]">Enabled but not called this cycle (no qualifying markets or all cached).</div>
                  </div>
                );
              }
              return null;
            })()}
            <div className="text-[10px] text-muted-foreground bg-primary/5 border border-primary/15 rounded-md p-2.5 font-body leading-relaxed">
              AI provides probabilities only. EV, ROI, and BET/NO_BET are calculated deterministically by the exchange engine using live Betfair prices.
            </div>
          </div>
        </Panel>

        {/* OpenAI Search */}
        <Panel
          title="OpenAI Web Search"
          subtitle="External form data enrichment"
          action={
            <div className="flex items-center gap-2">
              {extEnabled ? <Globe className="h-3.5 w-3.5 text-info" /> : <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-[10px] font-body font-semibold text-muted-foreground tracking-label">{extEnabled ? 'ENABLED' : 'DISABLED'}</span>
            </div>
          }
        >
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <Stat label="API Key" value="Configured" icon={CheckCircle2} iconColor="text-success" />
              <Stat label="Web Search" value={extEnabled ? 'On' : 'Off'} icon={extEnabled ? CheckCircle2 : XCircle} iconColor={extEnabled ? 'text-success' : 'text-muted-foreground'} />
            </div>
            {!extEnabled && (
              <div className="text-[10px] text-muted-foreground bg-muted/30 border border-border-subtle rounded-md p-2.5 font-body leading-relaxed">
                OpenAI Web Search is disabled. Enable in Settings → AI & Research to use external search for probability adjustments.
              </div>
            )}
            <ExternalSearchTestButton />
          </div>
        </Panel>
      </div>

      {/* Full OpenAI Debug Panel */}
      <OpenAISearchDebugPanel />
    </div>
  );
}

function Stat({ label, value, icon: Icon, iconColor }) {
  return (
    <div className="bg-muted/30 border border-border-subtle rounded-md p-2.5">
      <div className="text-[9px] font-body font-semibold text-muted-foreground uppercase tracking-label">{label}</div>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={cn('h-3 w-3', iconColor || 'text-muted-foreground')} />}
        <span className="text-xs font-mono tabular-nums font-semibold text-foreground truncate">{value}</span>
      </div>
    </div>
  );
}