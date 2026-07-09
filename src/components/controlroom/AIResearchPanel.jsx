import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { cn } from '@/lib/utils';
import { Brain, CheckCircle2, XCircle, Loader2, Globe } from 'lucide-react';
import OpenAISearchDebugPanel from '@/components/bot/OpenAISearchDebugPanel';
import ExternalSearchTestButton from '@/components/bot/ExternalSearchTestButton';

export default function AIResearchPanel() {
  const { featherlessSettings, lastExchangeDiagnostics, aiDecisions } = useApp();

  const aiEnabled = featherlessSettings?.enabled === true;
  const extEnabled = featherlessSettings?.externalSearchEnabled === true;
  const aiDiag = lastExchangeDiagnostics;
  const lastAI = aiDecisions[0];

  const aiStatusLog = aiDiag?.aiStatusLog || [];
  const lastAIStatus = aiStatusLog[aiStatusLog.length - 1];
  const aiError = aiStatusLog.find(s => s.status === 'ai_error');

  return (
    <div className="space-y-4">
      {/* AI Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Featherless AI */}
        <Panel title="Featherless AI">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className={cn('h-4 w-4', aiEnabled ? 'text-chart-2' : 'text-muted-foreground')} />
                <span className="text-sm font-bold">Status</span>
              </div>
              <StatusBadge status={aiEnabled ? 'ok' : 'neutral'}>
                {aiEnabled ? 'ENABLED' : 'DISABLED'}
              </StatusBadge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Model" value={featherlessSettings?.modelName || '—'} />
              <Stat label="Events with AI" value={aiDiag?.eventsWithAI || 0} />
              <Stat label="AI Calls" value={aiDiag?.aiCallsMade || 0} />
              <Stat label="Cache Hits" value={aiDiag?.aiCacheHits || 0} />
            </div>
            {aiError && (
              <div className="text-xs text-chart-5 bg-chart-5/10 rounded p-2">
                <span className="font-bold">Error:</span> {aiError.reason || 'Unknown error'}
              </div>
            )}
            {lastAI && (
              <div className="text-xs space-y-1 border-t border-border pt-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Latest AI Decision</div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={lastAI.decision === 'BET' ? 'ok' : 'warning'}>{lastAI.decision}</StatusBadge>
                  <span className="text-foreground">{lastAI.selectedRunner || '—'}</span>
                </div>
                <div className="text-muted-foreground">
                  Prob: {((lastAI.estimatedProbability || 0) * 100).toFixed(1)}% · Fair Odds: {lastAI.fairOdds?.toFixed(2) || '—'} · Edge: {(lastAI.valueEdge || 0).toFixed(1)}%
                </div>
                <div className="text-muted-foreground text-[10px]">
                  Confidence: {lastAI.confidence || 0} · Data Quality: {lastAI.dataQualityScore || 0}
                </div>
                {lastAI.mainReason && (
                  <div className="text-foreground text-[10px] mt-1">{lastAI.mainReason}</div>
                )}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground bg-chart-2/5 border border-chart-2/20 rounded p-2">
              AI provides probabilities only. EV, ROI, and BET/NO_BET are calculated deterministically by the exchange engine using live Betfair prices.
            </div>
          </div>
        </Panel>

        {/* OpenAI Search */}
        <Panel
          title="OpenAI Web Search"
          action={
            <div className="flex items-center gap-2">
              {extEnabled ? <Globe className="h-3.5 w-3.5 text-chart-3" /> : <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-[10px] font-medium text-muted-foreground">{extEnabled ? 'ENABLED' : 'DISABLED'}</span>
            </div>
          }
        >
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="API Key" value="Set" icon={CheckCircle2} iconColor="text-chart-1" />
              <Stat label="Web Search" value={extEnabled ? 'On' : 'Off'} icon={extEnabled ? CheckCircle2 : XCircle} iconColor={extEnabled ? 'text-chart-1' : 'text-chart-5'} />
            </div>
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
    <div className="bg-muted/30 rounded p-2">
      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={cn('h-3 w-3', iconColor || 'text-muted-foreground')} />}
        <span className="text-xs font-mono font-semibold text-foreground truncate">{value}</span>
      </div>
    </div>
  );
}