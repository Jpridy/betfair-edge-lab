import React, { useState, useEffect } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, Zap, Globe } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { base44 } from '@/api/base44Client';
import WebResearchPanel from './WebResearchPanel';

export default function FeatherlessAIDecisionPanel() {
  const { markets, runners, settings, bankrollStats, featherlessSettings, addPaperOrder, addAuditLog, aiDecisions } = useApp();
  const [selectedMarketId, setSelectedMarketId] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState(null);
  const [latestDecision, setLatestDecision] = useState(null);
  const [webResearch, setWebResearch] = useState(null);
  const [researchLoading, setResearchLoading] = useState(false);

  const eligibleMarkets = markets.filter(m =>
    m.status === 'OPEN' && !m.inPlay &&
    runners.some(r => (r.marketId === m.id || r.marketId === m.betfairMarketId) && r.status === 'ACTIVE' && r.bestBackPrice > 0)
  );

  // Auto-select the first eligible market when markets load or when the
  // currently selected market is no longer in the eligible list.
  useEffect(() => {
    if (eligibleMarkets.length === 0) return;
    const stillEligible = eligibleMarkets.some(m => m.id === selectedMarketId);
    if (!stillEligible) {
      setSelectedMarketId(eligibleMarkets[0].id);
    }
  }, [eligibleMarkets, selectedMarketId]);

  const selectedMarket = markets.find(m => m.id === selectedMarketId) || eligibleMarkets[0];
  const marketRunners = runners.filter(r => (r.marketId === selectedMarket?.id || r.marketId === selectedMarket?.betfairMarketId) && r.status === 'ACTIVE');

  const handleAnalyse = async () => {
    if (!selectedMarket) return;
    if (!featherlessSettings?.enabled) {
      setError('Featherless AI is not enabled. Enable it in Settings → AI.');
      return;
    }

    setAnalysing(true);
    setError(null);
    setLatestDecision(null);
    setWebResearch(null);

    try {
      // Step 1: Gather public race-day information via OpenAI web search
      let research = null;
      setResearchLoading(true);
      try {
        const researchResp = await base44.functions.invoke('raceWebResearch', {
          market: selectedMarket,
          runners: marketRunners,
        });
        if (researchResp.data?.research) {
          research = researchResp.data.research;
          setWebResearch(research);
        }
      } catch (_) {
        // Research failed — continue without it (graceful degradation)
      }
      setResearchLoading(false);

      // Step 2: Run Featherless AI with Betfair data + web research
      const resp = await base44.functions.invoke('featherlessAI', {
        market: selectedMarket,
        runners: marketRunners,
        settings,
        strategySettings: featherlessSettings,
        bankrollStats,
        raceFormProfiles: marketRunners.map(r => r.raceFormProfile).filter(Boolean),
        webResearch: research,
      });

      if (resp.data?.error) {
        setError(resp.data.error);
        addAuditLog('Featherless AI Failed', 'api', 'error', resp.data.error);
      } else {
        const decision = resp.data?.decision;
        setLatestDecision(decision);
        addAuditLog('Featherless AI Decision', 'strategy', 'info',
          `${decision?.decision} on ${selectedMarket?.marketName} — ${decision?.selectedRunner || 'no selection'} (confidence ${decision?.confidence}%, edge ${decision?.valueEdge}%)`);

        // If safety gate passed, create paper order
        if (decision?.safetyGatePassed && decision?.decision === 'BET') {
          const runner = marketRunners.find(r =>
            r.runnerName === decision.selectedRunner ||
            String(r.betfairSelectionId) === String(decision.selectionId)
          );
          if (runner) {
            const stake = decision.recommendedStake || settings.baseStake || 100;
            // Available size check — use bestBackSize for BACK, bestLaySize for LAY
            const availableSize = runner.bestBackSize || 0;
            const matchedStake = Math.min(stake, availableSize);
            const unmatchedStake = stake - matchedStake;
            const orderStatus = matchedStake === 0 ? 'unmatched' : unmatchedStake > 0 ? 'partially_matched' : 'matched';
            const order = {
              strategyName: 'Featherless AI Value Decision Engine',
              marketId: selectedMarket.id,
              betfairMarketId: selectedMarket.betfairMarketId,
              selectionId: runner.betfairSelectionId || runner.selectionId,
              runnerId: runner.id,
              runnerName: runner.runnerName || 'Unknown Runner',
              horseNumber: runner.horseNumber || runner.sortPriority || 0,
              marketName: selectedMarket.venue ? `${selectedMarket.venue} - ${selectedMarket.marketName || 'Win'}` : (selectedMarket.marketName || 'Unknown Market'),
              venue: selectedMarket.venue || '',
              raceNumber: selectedMarket.raceNumber || 0,
              marketStartTime: selectedMarket.startTime || null,
              side: 'BACK',
              orderType: 'LIMIT',
              size: stake,
              price: runner.bestBackPrice,
              persistenceType: 'LAPSE',
              customerRef: 'BELAI' + Date.now().toString(36).toUpperCase(),
              customerStrategyRef: 'BEL_FEATHERLESSAI',
              handicap: runner.handicap || 0,
              paper_mode: true,
              liveMode: false,
              requested_size: stake,
              matched_size: matchedStake,
              remaining_size: unmatchedStake,
              average_price_matched: matchedStake > 0 ? runner.bestBackPrice : null,
              requested_price: runner.bestBackPrice,
              matched_price: matchedStake > 0 ? runner.bestBackPrice : null,
              placed_date: new Date().toISOString(),
              matched_date: matchedStake > 0 ? new Date().toISOString() : null,
              requestedOdds: runner.bestBackPrice,
              matchedOdds: matchedStake > 0 ? runner.bestBackPrice : null,
              requestedStake: stake,
              matchedStake: matchedStake,
              status: orderStatus,
              expectedValue: decision.expectedROI * stake / 100,
              result: 'pending',
              grossProfit: 0,
              commission: 0,
              netProfit: 0,
              commissionRateUsed: selectedMarket?.marketBaseRate || settings.defaultCommissionRate || 0.05,
              commissionSource: selectedMarket?.marketBaseRate ? 'market_base_rate' : 'default_fallback',
              commission_calculation_status: selectedMarket?.marketBaseRate ? 'ok' : 'using_default',
              entryReason: `Featherless AI: ${decision.mainReason}`,
              warningFlags: decision.risks || [],
              paperSimulationQuality: 'High',
            };
            addPaperOrder(order);
            addAuditLog('AI Paper Trade Created', 'order', 'info',
              `BACK ${runner.runnerName} @ ${runner.bestBackPrice} × $${stake.toFixed(2)} (AI confidence ${decision.confidence}%, edge ${decision.valueEdge}%)`,
              { objectName: runner.runnerName });
          }
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      const isAuthError = err.response?.status === 401 || errMsg.includes('401') || errMsg.toLowerCase().includes('authentication');
      if (isAuthError) {
        setError('Your session has expired. Redirecting to login...');
        addAuditLog('Session Expired', 'system', 'critical', 'User session token expired. Redirecting to login.');
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      } else {
        setError(errMsg);
        addAuditLog('Featherless AI Error', 'api', 'error', errMsg);
      }
    }
    setAnalysing(false);
  };

  if (!featherlessSettings?.enabled) {
    return (
      <Panel title="Featherless AI Decision Engine">
        <div className="p-6 text-center">
          <Brain className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground">Featherless AI is not enabled.</div>
          <div className="text-xs text-muted-foreground mt-1">Go to Settings → AI to configure your Featherless API key and enable the decision engine.</div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Featherless AI Decision Engine" action={
      <StatusBadge status={analysing ? 'warning' : latestDecision?.decision === 'BET' ? 'ok' : latestDecision ? 'info' : 'neutral'}>
        {analysing ? 'Analysing...' : latestDecision?.decision || 'Not checked'}
      </StatusBadge>
    }>
      <div className="p-4 space-y-4">
        {/* Market Selector + Analyse Button */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">Select Market for AI Analysis</label>
            <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select market" /></SelectTrigger>
              <SelectContent>
                {eligibleMarkets.map(m => <SelectItem key={m.id} value={m.id}>{m.venue} — {m.marketName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleAnalyse} disabled={analysing || !selectedMarket}>
            {analysing ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Brain className="h-3 w-3 mr-1" />}
            {researchLoading ? 'Researching...' : analysing ? 'Analysing...' : 'Run AI Analysis'}
          </Button>
        </div>

        {selectedMarket && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
            {selectedMarket.venue ? `${selectedMarket.venue}` : 'Unknown venue'}{selectedMarket.raceNumber ? ` · R${selectedMarket.raceNumber}` : ''} · {marketRunners.length} runners · ${selectedMarket.totalMatched?.toLocaleString() || 0} traded · {selectedMarket.status}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-chart-5 bg-chart-5/10 border border-chart-5/30 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* Web Research Summary */}
        {(researchLoading || webResearch) && (
          <WebResearchPanel research={webResearch} loading={researchLoading} />
        )}

        {/* AI Decision Results */}
        {latestDecision && (
          <div className="space-y-3">
            {/* Decision Banner */}
            <div className={`rounded-lg p-4 border ${latestDecision.decision === 'BET' ? 'bg-chart-1/10 border-chart-1/30' : latestDecision.decision === 'WATCH' ? 'bg-chart-4/10 border-chart-4/30' : 'bg-muted border-border'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {latestDecision.decision === 'BET' ? <Zap className="h-5 w-5 text-chart-1" /> : latestDecision.decision === 'WATCH' ? <Clock className="h-5 w-5 text-chart-4" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-lg font-bold">{latestDecision.decision}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="text-xl font-bold font-mono">{latestDecision.confidence}%</div>
                </div>
              </div>
              {latestDecision.mainReason && <div className="text-xs text-muted-foreground mt-2">{latestDecision.mainReason}</div>}
            </div>

            {/* Decision Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DecisionMetric label="Selected Runner" value={latestDecision.selectedRunner || '—'} />
              <DecisionMetric label="AI Fair Odds" value={latestDecision.fairOdds?.toFixed(2) || '—'} />
              <DecisionMetric label="Betfair Odds" value={latestDecision.betfairOdds?.toFixed(2) || '—'} />
              <DecisionMetric label="Min Acceptable" value={latestDecision.minimumAcceptableOdds?.toFixed(2) || '—'} />
              <DecisionMetric label="Value Edge" value={`${latestDecision.valueEdge?.toFixed(2)}%`} positive={latestDecision.valueEdge > 0} />
              <DecisionMetric label="Expected ROI" value={`${latestDecision.expectedROI?.toFixed(2)}%`} positive={latestDecision.expectedROI > 0} />
              <DecisionMetric label="Race Risk" value={latestDecision.raceRiskLevel} />
              <DecisionMetric label="Data Quality" value={`${latestDecision.dataQualityScore}/100`} />
              <DecisionMetric label="Data Source" value={latestDecision.dataSource?.replace(/_/g, ' ') || 'MARKET ONLY'} />
              <DecisionMetric label="Most Likely Winner" value={latestDecision.mostLikelyWinner || '—'} />
              <DecisionMetric label="Response Time" value={`${latestDecision.responseTimeMs}ms`} />
              <DecisionMetric label="Recommended Stake" value={`$${latestDecision.recommendedStake?.toFixed(2) || '0.00'}`} />
              <DecisionMetric label="Staking Mode" value={latestDecision.stakingMode?.replace(/_/g, ' ') || '—'} />
            </div>

            {/* Safety Gate */}
            <div className={`rounded-lg p-3 border ${latestDecision.safetyGatePassed ? 'bg-chart-1/10 border-chart-1/30' : 'bg-chart-5/10 border-chart-5/30'}`}>
              <div className="flex items-center gap-2 text-xs font-bold">
                {latestDecision.safetyGatePassed ? <CheckCircle2 className="h-4 w-4 text-chart-1" /> : <AlertTriangle className="h-4 w-4 text-chart-5" />}
                Safety Gate: {latestDecision.safetyGatePassed ? 'PASSED — Paper trade created' : 'FAILED — No paper trade'}
              </div>
              {latestDecision.safetyGateFailures?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {latestDecision.safetyGateFailures.map((f, i) => (
                    <div key={i} className="text-xs text-chart-5 flex items-start gap-1">
                      <span className="text-muted-foreground">•</span> {f}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Risks */}
            {latestDecision.risks?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Risks</div>
                <div className="space-y-1">
                  {latestDecision.risks.map((r, i) => (
                    <div key={i} className="text-xs text-chart-4 bg-chart-4/5 rounded p-2 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {r}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Web Research Assessment from AI */}
            {latestDecision.webResearchAssessment && (
              <div className="rounded-lg p-3 border bg-chart-3/5 border-chart-3/20">
                <div className="flex items-center gap-2 text-xs font-bold mb-1">
                  <Globe className="h-4 w-4 text-chart-3" />
                  Web Research Assessment
                  <StatusBadge status={latestDecision.webResearchAssessment === 'supports' ? 'ok' : latestDecision.webResearchAssessment === 'conflicts' ? 'danger' : latestDecision.webResearchAssessment === 'missing' ? 'neutral' : 'info'}>
                    {latestDecision.webResearchAssessment}
                  </StatusBadge>
                </div>
                {latestDecision.webResearchSummary && (
                  <div className="text-xs text-muted-foreground">{latestDecision.webResearchSummary}</div>
                )}
              </div>
            )}

            {/* Validation Status */}
            {latestDecision.validationStatus === 'invalid' && (
              <div className="text-xs text-chart-5 bg-chart-5/10 border border-chart-5/30 rounded p-2">
                <div className="font-bold">AI Response Validation Failed:</div>
                {latestDecision.validationErrors?.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Recent AI Decisions */}
        {aiDecisions.length > 0 && !latestDecision && (
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent AI Decisions</div>
            <div className="space-y-2">
              {aiDecisions.slice(0, 5).map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs border border-border rounded p-2">
                  <div>
                    <span className="font-medium">{d.decision}</span> · {d.selectedRunner || 'no selection'}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>Conf: {d.confidence}%</span>
                    <span>Edge: {d.valueEdge?.toFixed(1)}%</span>
                    {d.safetyGatePassed ? <StatusBadge status="ok">Paper Trade</StatusBadge> : <StatusBadge status="neutral">No Trade</StatusBadge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function DecisionMetric({ label, value, positive }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold font-mono mt-1 ${positive === true ? 'text-chart-1' : positive === false ? 'text-chart-5' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}