import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge, SideBadge } from '@/components/ui/Trading';
import { ChevronDown, ChevronRight, Brain, Clock, AlertTriangle, CheckCircle2, XCircle, Zap } from 'lucide-react';

const statusConfig = {
  success: { icon: CheckCircle2, badge: 'ok', label: 'Success' },
  cache_hit: { icon: CheckCircle2, badge: 'info', label: 'Cache Hit' },
  failed: { icon: XCircle, badge: 'danger', label: 'Failed' },
  timeout: { icon: Clock, badge: 'warning', label: 'Timeout' },
  not_configured: { icon: AlertTriangle, badge: 'warning', label: 'Not Configured' },
  not_called: { icon: AlertTriangle, badge: 'neutral', label: 'Not Called' },
  market_only_fallback: { icon: Zap, badge: 'warning', label: 'Market-Only Fallback' },
};

export default function FeatherlessRaceDecisionPanel({ diagnostics: propDiagnostics }) {
  const { lastExchangeDiagnostics } = useApp();
  const [expanded, setExpanded] = useState(true);
  const [expandedAssessment, setExpandedAssessment] = useState(0);

  const source = propDiagnostics || lastExchangeDiagnostics;
  const diag = source?.raceAssessmentDiagnostics;
  const assessments = diag?.raceAssessments || [];

  if (!diag || assessments.length === 0) {
    return (
      <Panel title="Featherless Race Assessment" subtitle="AI-driven race-level probability assessment">
        <div className="px-4 py-8 text-center">
          <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-xs text-muted-foreground">No race assessment data yet. Run a scan to see Featherless AI race analysis.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Featherless Race Assessment"
      subtitle="Race-first AI assessment — full race pack sent before any opportunity selected"
      action={
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      }
    >
      {expanded && (
        <div className="space-y-4 p-4">
          {/* Summary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <MiniMetric label="Packs Built" value={diag.racePacksBuilt} />
            <MiniMetric label="FL Called" value={diag.featherlessCalled} accent="text-info" />
            <MiniMetric label="Succeeded" value={diag.featherlessSucceeded} accent="text-success" />
            <MiniMetric label="Failed" value={diag.featherlessFailed} accent={diag.featherlessFailed > 0 ? 'text-danger' : ''} />
            <MiniMetric label="Market Fallback" value={diag.marketOnlyFallbacksUsed} accent={diag.marketOnlyFallbacksUsed > 0 ? 'text-warning' : ''} />
            <MiniMetric label="Avg Latency" value={diag.featherlessAvgLatencyMs > 0 ? `${diag.featherlessAvgLatencyMs}ms` : '—'} />
            <MiniMetric label="Overruled" value={diag.localEngineOverruledFeatherless} accent={diag.localEngineOverruledFeatherless > 0 ? 'text-warning' : ''} />
          </div>

          {/* Per-race assessments */}
          <div className="space-y-2">
            {assessments.map((ra, idx) => {
              const sc = statusConfig[ra.featherlessStatus] || statusConfig.not_called;
              const StatusIcon = sc.icon;
              const isExpanded = expandedAssessment === idx;
              return (
                <div key={idx} className="bg-elevated border border-border-subtle rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedAssessment(isExpanded ? -1 : idx)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-hover transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <StatusIcon className={`h-4 w-4 shrink-0 ${
                        ra.featherlessStatus === 'success' ? 'text-success' :
                        ra.featherlessStatus === 'failed' || ra.featherlessStatus === 'timeout' ? 'text-danger' :
                        ra.featherlessStatus === 'not_configured' ? 'text-warning' :
                        'text-muted-foreground'
                      }`} />
                      <span className="text-xs font-body font-semibold text-foreground truncate">{ra.eventName || ra.eventId}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ra.featherlessLatencyMs > 0 && <span className="text-[10px] font-mono text-muted-foreground">{ra.featherlessLatencyMs}ms</span>}
                      <StatusBadge status={sc.badge}>{sc.label}</StatusBadge>
                      {ra.finalDecision === 'BET'
                        ? <StatusBadge status="ok">BET</StatusBadge>
                        : <StatusBadge status="neutral">NO BET</StatusBadge>}
                      {ra.localEngineOverruled && <StatusBadge status="warning">OVERRULED</StatusBadge>}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-border-subtle pt-3">
                      {/* Race pack summary */}
                      {ra.racePackSummary && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                          <KV label="Runners" value={ra.racePackSummary.runnerCount} />
                          <KV label="Markets" value={ra.racePackSummary.marketCount} />
                          <KV label="WIN" value={ra.racePackSummary.winMarketPresent ? '✓' : '✗'} />
                          <KV label="PLACE" value={ra.racePackSummary.placeMarketPresent ? '✓' : '✗'} />
                          <KV label="H2H" value={ra.racePackSummary.h2hMarketCount || 0} />
                          <KV label="Ext Research" value={ra.racePackSummary.externalResearchUsed ? '✓' : '✗'} />
                          <KV label="Risk Context" value={ra.racePackSummary.riskContextIncluded ? '✓' : '✗'} />
                          <KV label="Total Matched" value={`$${(ra.racePackSummary.totalMatched || 0).toLocaleString()}`} />
                          <KV label="Venue" value={ra.racePackSummary.venue || '—'} />
                          <KV label="Secs to Jump" value={ra.racePackSummary.secondsToJump ?? '—'} />
                        </div>
                      )}

                      {/* Featherless output */}
                      {ra.featherlessCalled && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                          <KV label="Data Quality" value={`${ra.featherlessDataQuality}/100`} accent={ra.featherlessDataQuality >= 70 ? 'text-success' : ra.featherlessDataQuality >= 50 ? 'text-warning' : 'text-danger'} />
                          <KV label="Confidence" value={`${ra.featherlessConfidence}/100`} accent={ra.featherlessConfidence >= 70 ? 'text-success' : ra.featherlessConfidence >= 50 ? 'text-warning' : 'text-danger'} />
                          <KV label="Runner Probs" value={ra.runnerProbabilitiesReturned} />
                          <KV label="H2H Probs" value={ra.h2hProbabilitiesReturned} />
                          <KV label="Rec'd Opps" value={ra.recommendedOpportunitiesReturned} />
                        </div>
                      )}

                      {/* Featherless recommendation vs local engine */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {ra.featherlessRecommendedOpp && (
                          <div className="bg-info/5 border border-info/20 rounded-md p-2">
                            <div className="text-[9px] font-body font-semibold text-info uppercase tracking-label mb-1">Featherless Recommended</div>
                            <div className="flex items-center gap-2">
                              <SideBadge side={ra.featherlessRecommendedOpp.side} />
                              <span className="text-xs font-body text-foreground">{ra.featherlessRecommendedOpp.runnerName}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{ra.featherlessRecommendedOpp.marketType}</span>
                              {ra.featherlessRecommendedOpp.estimatedEdge != null && (
                                <span className="text-[10px] font-mono text-info">edge {ra.featherlessRecommendedOpp.estimatedEdge.toFixed(1)}%</span>
                              )}
                            </div>
                          </div>
                        )}
                        {ra.bestLocalOpportunity && (
                          <div className={`border rounded-md p-2 ${ra.localEngineOverruled ? 'bg-warning/5 border-warning/20' : 'bg-success/5 border-success/20'}`}>
                            <div className={`text-[9px] font-body font-semibold uppercase tracking-label mb-1 ${ra.localEngineOverruled ? 'text-warning' : 'text-success'}`}>
                              Local Engine Selected
                            </div>
                            <div className="flex items-center gap-2">
                              <SideBadge side={ra.bestLocalOpportunity.side} />
                              <span className="text-xs font-body text-foreground">{ra.bestLocalOpportunity.runnerName}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{ra.bestLocalOpportunity.marketType}</span>
                              <span className="text-[10px] font-mono text-success">EV ${ra.bestLocalOpportunity.ev.toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Overrule reason */}
                      {ra.overruleReason && (
                        <div className="bg-warning/5 border border-warning/25 rounded-md p-2 flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                          <p className="text-[11px] text-warning leading-relaxed">{ra.overruleReason}</p>
                        </div>
                      )}

                      {/* Final decision */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground font-body">Final decision:</span>
                        <span className={`font-heading font-semibold ${ra.finalDecision === 'BET' ? 'text-success' : 'text-muted-foreground'}`}>{ra.finalDecision}</span>
                        <span className="text-muted-foreground">— {ra.finalReason}</span>
                      </div>

                      {/* Decision source */}
                      <div className="text-[10px] font-mono text-muted-foreground">
                        Source: {ra.decisionSource}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

function MiniMetric({ label, value, accent }) {
  return (
    <div className="bg-elevated border border-border-subtle rounded-md p-2 text-center">
      <div className="text-[9px] font-body font-medium text-muted-foreground uppercase tracking-label">{label}</div>
      <div className={`text-base font-heading font-semibold tabular-nums ${accent || 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function KV({ label, value, accent }) {
  return (
    <div>
      <div className="text-[9px] font-body font-medium text-muted-foreground uppercase tracking-label">{label}</div>
      <div className={`font-mono tabular-nums ${accent || 'text-foreground'}`}>{value}</div>
    </div>
  );
}