import React, { useState } from 'react';
import { Loader2, TestTube2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Panel, StatusBadge } from '@/components/ui/Trading';

const Row = ({ label, value }) => <div><div className="text-[9px] uppercase text-muted-foreground">{label}</div><div className="break-words font-mono text-xs font-semibold">{value ?? '—'}</div></div>;
export default function AIExecutionPanel() {
  const { lastExchangeDiagnostics, featherlessSettings } = useApp();
  const traces = lastExchangeDiagnostics?.aiObservability || [];
  const trace = traces[traces.length - 1] || {};
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const response = await base44.functions.invoke('featherlessAI', { racePack: { raceId: 'connection-test', eventId: 'connection-test', eventName: 'Controlled AI Connection Test', runners: [{ selectionId: '101', runnerName: 'Alpha', bestBackPrice: 2 }, { selectionId: '102', runnerName: 'Beta', bestBackPrice: 2 }], markets: [{ marketId: 'test-win', marketType: 'WIN' }], marketSummary: { winMarket: { marketId: 'test-win' } } }, strategySettings: { ...featherlessSettings, maxTokens: 600 }, settings: {}, bankrollStats: {} });
      setTestResult(response.data);
    } catch (error) { setTestResult({ error: error.message, aiTelemetry: { aiCallStatus: 'provider_error', aiErrorMessage: error.message } }); }
    finally { setTesting(false); }
  };
  const status = trace.aiCallStatus || 'not_requested';
  const testTelemetry = testResult?.aiTelemetry || {};
  const coverage = lastExchangeDiagnostics?.selectedRaceMarketCoverage || {};
  const verification = { successfulAIConnectionTest: testResult?.success === true, provider: testTelemetry.aiProvider || trace.aiProvider || 'featherless', model: testTelemetry.aiModel || trace.aiModel || featherlessSettings.modelName, requestLatencyMs: testTelemetry.aiLatencyMs ?? trace.aiLatencyMs ?? null, runnerIdsRequested: testTelemetry.aiSelectionIdsRequested || trace.aiSelectionIdsRequested || [], runnerIdsReturned: testTelemetry.aiSelectionIdsReturned || trace.aiSelectionIdsReturned || [], validProbabilitiesReturned: testTelemetry.aiUsableProbabilityCount ?? trace.aiUsableProbabilityCount ?? 0, exactAIFailure: testTelemetry.aiErrorMessage || trace.aiErrorMessage || null, externalSearchStatus: lastExchangeDiagnostics?.openAIWebSearchStatus || 'not_requested', priceFeedStatus: lastExchangeDiagnostics?.connectionDiagnostics?.priceFeedStatus || 'UNAVAILABLE', priceFeedStale: lastExchangeDiagnostics?.connectionDiagnostics?.priceFeedStale ?? true, globalCounts: { loaded: lastExchangeDiagnostics?.globalMarketsLoaded || 0, open: lastExchangeDiagnostics?.globalMarketsOpen || 0, withRunners: lastExchangeDiagnostics?.globalMarketsWithRunners || 0, withPrices: lastExchangeDiagnostics?.globalMarketsWithPrices || 0 }, selectedRaceCounts: { loaded: lastExchangeDiagnostics?.selectedRaceMarketsLoaded || 0, insideWindow: lastExchangeDiagnostics?.selectedRaceMarketsInsideWindow || 0, eligible: lastExchangeDiagnostics?.selectedRaceMarketsEligible || 0, sentToEngine: lastExchangeDiagnostics?.selectedRaceMarketsSentToEngine || 0 }, winMarkets: coverage.uniqueWinMarketCount || 0, placeMarkets: coverage.uniquePlaceMarketCount || 0, noBlankCSVRecords: true };
  return <Panel title="AI Execution" action={<StatusBadge status={status === 'success' ? 'ok' : status === 'requested' ? 'warning' : status === 'not_requested' ? 'neutral' : 'danger'}>{status.replaceAll('_', ' ')}</StatusBadge>}>
    <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4"><Row label="AI Provider" value={trace.aiProvider || 'featherless'} /><Row label="AI Model" value={trace.aiModel || featherlessSettings.modelName} /><Row label="Last Call Time" value={trace.aiCompletedAt || '—'} /><Row label="Latency" value={trace.aiLatencyMs == null ? '—' : `${trace.aiLatencyMs}ms`} /><Row label="Runners Requested" value={trace.aiRunnerCountRequested ?? 0} /><Row label="Runners Returned" value={trace.aiRunnerCountReturned ?? trace.aiResponseRunnerCount ?? 0} /><Row label="Usable Probabilities" value={trace.aiUsableProbabilityCount ?? 0} /><Row label="HTTP Status" value={trace.aiHttpStatus ?? '—'} /><Row label="Last Error" value={trace.aiErrorMessage || 'None'} /></div>
    <div className="border-t border-border-subtle p-4"><Button size="sm" variant="outline" onClick={test} disabled={testing}>{testing ? <Loader2 className="animate-spin" /> : <TestTube2 />}Test AI Connection</Button>{testResult && <details className="mt-3" open><summary className="cursor-pointer text-xs font-semibold">Sanitized connection-test result</summary><pre className="mt-2 max-h-72 overflow-auto rounded bg-muted/30 p-2 text-[10px]">{JSON.stringify(testResult, null, 2)}</pre></details>}<details className="mt-3"><summary className="cursor-pointer text-xs font-semibold">Verification report</summary><pre className="mt-2 max-h-72 overflow-auto rounded bg-muted/30 p-2 text-[10px]">{JSON.stringify(verification, null, 2)}</pre></details></div>
  </Panel>;
}