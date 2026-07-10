import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { FlaskConical, Loader2, ExternalLink, ArrowRight } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { base44 } from '@/api/base44Client';
import { scanEligibleMarkets } from '@/lib/exchangeOpportunityEngine';
import { clusterMarketsByEvent, detectMarketType } from '@/lib/marketClusterer';
import { buildRacePack } from '@/lib/racePackBuilder';
import { findRunnerResearch, applyExternalAdjustment, applyConfidenceAdjustment, determineDecisionImpact } from '@/lib/externalSearchIntegration';
import OpenAIDiagnostics, { getOpenAIDiagnostics } from '@/components/bot/OpenAIDiagnostics';

export default function ExternalSearchTestButton() {
  const { markets, runners, featherlessSettings, settings } = useApp();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setResult(null);

    try {
      // Find nearest open race — cluster markets by event, sort by start time
      const eligible = scanEligibleMarkets(markets, runners, settings, true);
      if (eligible.length === 0) {
        setError('No open markets with 2+ runners found. Connect to Betfair and ensure markets are loaded.');
        return;
      }

      const eventClusters = clusterMarketsByEvent(eligible);
      const nowMs = Date.now();
      const sortedClusters = eventClusters
        .filter(c => c.startTime)
        .map(c => ({ cluster: c, secsToJump: Math.round((new Date(c.startTime).getTime() - nowMs) / 1000) }))
        .sort((a, b) => a.secsToJump - b.secsToJump);

      if (sortedClusters.length === 0) {
        setError('No event clusters with start times found.');
        return;
      }

      const nearest = sortedClusters[0];
      const cluster = nearest.cluster;

      // Find primary market and its runners for the OpenAI search call
      const clusterMarkets = eligible.filter(m =>
        (m.eventId || '') === (cluster.eventId || '')
      );
      const market = clusterMarkets.find(m => detectMarketType(m) === 'WIN') || clusterMarkets[0];
      const marketRunners = runners.filter(r =>
        (r.marketId === market.id || r.marketId === market.betfairMarketId) && r.status === 'ACTIVE'
      );

      if (marketRunners.length === 0) {
        setError('No active runners found for the nearest market.');
        return;
      }

      // Build race pack for Featherless AI
      const bankrollStats = { bankroll: settings.paperBankroll || settings.bankroll || 10000 };
      const racePack = buildRacePack(cluster, runners, markets, settings, featherlessSettings, bankrollStats, [], null, {
        paperMode: true,
        paperProofMode: false,
      });

      if (!racePack) {
        setError('Failed to build race pack for AI analysis.');
        return;
      }

      // Step 1: Get pre-search probabilities from Featherless AI
      let preSearchAISet = null;
      try {
        const aiResp = await base44.functions.invoke('featherlessAI', {
          racePack,
          settings,
          strategySettings: featherlessSettings,
          bankrollStats,
        });
        preSearchAISet = aiResp.data?.aiResult || null;
      } catch (aiErr) {
        setError(`AI probability call failed: ${aiErr.response?.data?.error || aiErr.message}. Cannot compare pre/post search without AI probabilities.`);
        return;
      }

      if (!preSearchAISet?.runnerProbabilities) {
        setError('AI did not return runner probabilities. Cannot run external search test.');
        return;
      }

      // Build pre-search probability map
      const probMap = new Map();
      for (const rp of preSearchAISet.runnerProbabilities) {
        const sid = String(rp.selectionId || rp.betfairSelectionId || '');
        if (sid) probMap.set(sid, rp);
      }

      // Step 2: Call OpenAI web search
      const searchResp = await base44.functions.invoke('openAIWebSearch', {
        market,
        runners: marketRunners,
        settings: featherlessSettings,
      });

      const externalSearchResult = searchResp.data?.externalSearchResult;
      if (!externalSearchResult) {
        setError(`OpenAI web search did not return a result: ${searchResp.data?.error || 'Unknown error'}`);
        return;
      }

      // Step 3: Apply adjustments and build comparison
      const runnerComparisons = marketRunners.map(runner => {
        const selectionId = String(runner.betfairSelectionId || runner.selectionId || '');
        const probData = probMap.get(selectionId);
        const preSearchProbability = probData?.pWin || 0;
        const preSearchConfidence = probData?.confidence || 0;

        const runnerResearch = findRunnerResearch(externalSearchResult, selectionId);
        const { postSearchProbability, probabilityDelta } = applyExternalAdjustment(
          preSearchProbability, runnerResearch, featherlessSettings, externalSearchResult.dataQuality
        );
        const { postSearchConfidence, confidenceDelta } = applyConfidenceAdjustment(
          preSearchConfidence, runnerResearch, featherlessSettings
        );

        const decisionImpact = determineDecisionImpact(
          probabilityDelta, confidenceDelta,
          !!runnerResearch && externalSearchResult.searchStatus === 'success',
          externalSearchResult.dataQuality, featherlessSettings
        );

        return {
          selectionId,
          runnerName: runner.runnerName,
          preSearchProbability,
          postSearchProbability,
          probabilityDelta,
          preSearchConfidence,
          postSearchConfidence,
          confidenceDelta,
          decisionImpact,
          positiveSignals: runnerResearch?.positiveSignals || [],
          negativeSignals: runnerResearch?.negativeSignals || [],
          neutralSignals: runnerResearch?.neutralSignals || [],
          sourceUrls: runnerResearch?.sourceUrls || [],
        };
      });

      // Step 4: Determine if best opportunity changed
      const sortedPre = [...runnerComparisons].sort((a, b) => b.preSearchProbability - a.preSearchProbability);
      const sortedPost = [...runnerComparisons].sort((a, b) => b.postSearchProbability - a.postSearchProbability);
      const bestPreName = sortedPre[0]?.runnerName;
      const bestPostName = sortedPost[0]?.runnerName;
      const bestChanged = bestPreName !== bestPostName;

      setResult({
        market: {
          betfairMarketId: market.betfairMarketId || market.id,
          eventName: cluster.eventName || market.eventName || '',
          marketName: market.marketName || '',
          marketStartTime: cluster.startTime || market.startTime || market.marketStartTime,
          secondsToJump: nearest.secsToJump,
          runnerCount: marketRunners.length,
          detectedMarketType: detectMarketType(market),
        },
        searchQuery: externalSearchResult.searchQuery,
        searchStatus: externalSearchResult.searchStatus,
        sourceCount: externalSearchResult.sourceCount,
        sources: externalSearchResult.sources?.slice(0, 10) || [],
        raceLevelNotes: externalSearchResult.raceLevelNotes,
        dataQuality: externalSearchResult.dataQuality,
        errorMessage: externalSearchResult.errorMessage,
        diagnostics: getOpenAIDiagnostics(searchResp.data),
        runnerComparisons,
        bestPreName,
        bestPostName,
        bestChanged,
        preSearchAISummary: preSearchAISet?.raceSummary || '',
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Panel
      title="External Search Test (Proof Mode)"
      action={
        <Button size="sm" onClick={handleTest} disabled={testing}>
          {testing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...</> : <><FlaskConical className="h-3.5 w-3.5" /> Run External Search Test</>}
        </Button>
      }
    >
      <div className="px-4 py-2 text-[10px] text-muted-foreground bg-muted/30 border-b border-border">
        Selects the nearest open race, calls OpenAI web search, and shows the exact query, sources, runner facts, probability before/after search, and whether the best opportunity changed. Does NOT create an order.
      </div>

      {error && (
        <div className="px-4 py-3 text-sm text-danger bg-danger/5">
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 space-y-4">
          {/* Market info */}
          <div className="text-xs">
            <div className="font-bold text-foreground mb-1">
              {result.market.eventName} — {result.market.marketName}
            </div>
            <div className="text-muted-foreground">
              {result.market.runnerCount} runners · {result.market.detectedMarketType} · {result.market.secondsToJump}s to jump
            </div>
          </div>

          {/* Search query */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Search Query</div>
            <div className="text-xs font-mono text-foreground bg-muted/50 rounded px-2 py-1.5">{result.searchQuery}</div>
          </div>

          {/* Search status */}
          <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-3">
              <StatusBadge status={result.searchStatus === 'success' ? 'ok' : result.searchStatus === 'timeout' || result.searchStatus === 'no_results' ? 'warning' : result.searchStatus === 'error' ? 'danger' : 'neutral'}>
                {result.searchStatus?.toUpperCase().replace(/_/g, ' ')}
              </StatusBadge>
              <span className="text-xs text-muted-foreground">
                {result.searchStatus === 'success' && result.sourceCount >= 2 ? 'Search works — enough sources for probability adjustment' : result.searchStatus === 'success' && result.sourceCount === 1 ? 'Search works — not enough sources for probability adjustment' : result.searchStatus === 'success' ? 'Search ran successfully' : 'Search did not complete successfully'}
              </span>
            </div>
            <OpenAIDiagnostics data={result.diagnostics} />
          </div>

          {result.errorMessage && (
            <div className="text-xs text-danger">{result.errorMessage}</div>
          )}

          {/* Race-level notes */}
          {result.raceLevelNotes && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Race-Level Notes</div>
              <div className="text-xs text-foreground">{result.raceLevelNotes}</div>
            </div>
          )}

          {/* Sources */}
          {result.sources.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Sources Found</div>
              <div className="space-y-1">
                {result.sources.map((s, i) => (
                  <div key={i} className="text-xs flex items-start gap-2">
                    <ExternalLink className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-foreground">{s.title}</div>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline text-[10px]">{s.domain || s.url}</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Runner comparisons */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Runner Probability Comparison</div>
            <div className="space-y-2">
              {result.runnerComparisons
                .sort((a, b) => b.postSearchProbability - a.postSearchProbability)
                .map((rc, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs bg-muted/30 rounded px-2 py-1.5">
                    <span className="font-mono text-muted-foreground w-4">{i + 1}</span>
                    <span className="font-medium text-foreground flex-1 truncate">{rc.runnerName}</span>
                    <span className="font-mono text-muted-foreground">{(rc.preSearchProbability * 100).toFixed(1)}%</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={`font-mono ${rc.probabilityDelta > 0 ? 'text-success' : rc.probabilityDelta < 0 ? 'text-danger' : 'text-foreground'}`}>
                      {(rc.postSearchProbability * 100).toFixed(1)}%
                    </span>
                    <span className={`font-mono text-[10px] ${rc.probabilityDelta > 0 ? 'text-success' : rc.probabilityDelta < 0 ? 'text-danger' : 'text-muted-foreground'}`}>
                      {rc.probabilityDelta > 0 ? '+' : ''}{(rc.probabilityDelta * 100).toFixed(2)}%
                    </span>
                    <StatusBadge status={
                      rc.decisionImpact?.includes('increased') ? 'ok' :
                      rc.decisionImpact?.includes('decreased') ? 'danger' :
                      rc.decisionImpact?.includes('blocked') ? 'warning' : 'neutral'
                    }>
                      {rc.decisionImpact?.replace(/_/g, ' ')}
                    </StatusBadge>
                  </div>
                ))}
            </div>
          </div>

          {/* Best opportunity change */}
          <div className={`px-3 py-2 rounded text-xs ${result.bestChanged ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground'}`}>
            {result.bestChanged ? (
              <>Best opportunity changed: <strong>{result.bestPreName}</strong> → <strong>{result.bestPostName}</strong></>
            ) : (
              <>Best opportunity unchanged: <strong>{result.bestPostName}</strong> remains top-ranked</>
            )}
          </div>

          {/* Runner signals detail */}
          {result.runnerComparisons.some(rc => rc.positiveSignals.length > 0 || rc.negativeSignals.length > 0) && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Extracted Runner Facts</div>
              <div className="space-y-2">
                {result.runnerComparisons
                  .filter(rc => rc.positiveSignals.length > 0 || rc.negativeSignals.length > 0)
                  .map((rc, i) => (
                    <div key={i} className="text-xs">
                      <div className="font-medium text-foreground mb-1">{rc.runnerName}</div>
                      {rc.positiveSignals.length > 0 && (
                        <div className="text-success ml-3">+ {rc.positiveSignals.join('; ')}</div>
                      )}
                      {rc.negativeSignals.length > 0 && (
                        <div className="text-danger ml-3">− {rc.negativeSignals.join('; ')}</div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Authority notice */}
          <div className="text-[10px] text-muted-foreground bg-muted/20 px-3 py-2 rounded">
            No order was created. The exchange engine remains the final authority — EV, ROI, spread, liquidity, and safety gates are recalculated every cycle using live Betfair prices.
          </div>
        </div>
      )}
    </Panel>
  );
}