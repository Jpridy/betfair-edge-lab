import React, { useState, useCallback } from 'react';
import { useApp } from '@/lib/AppContext';
import { runFullWiringTest, buildSettingsWiringCheck, buildLiveWiringStatus } from '@/lib/wiringAudit';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Activity, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function WiringAudit() {
  const app = useApp();
  const [testResult, setTestResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const runTest = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await runFullWiringTest(app);
      setTestResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }, [app]);

  // Build live tables from current state (not requiring a test run)
  const settingsRows = buildSettingsWiringCheck(app.settings, app.featherlessSettings, app.botSettings);
  const liveStatus = buildLiveWiringStatus(app);
  const lastDiag = app.lastExchangeDiagnostics;
  const lastCycle = app.botCycles?.[0];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wiring Audit</h1>
          <p className="text-sm text-muted-foreground mt-1">Full end-to-end verification of every data path, setting, and decision flow. Paper mode only.</p>
        </div>
        <Button onClick={runTest} disabled={running} size="lg">
          {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Running...</> : <><Activity className="h-4 w-4" /> Run Full Wiring Test</>}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-4 w-4" />
            <span className="text-sm font-bold">Test Error</span>
          </div>
          <p className="text-sm text-destructive mt-1">{error}</p>
        </div>
      )}

      {/* Test Result Summary */}
      {testResult && (
        <Panel title="Full Wiring Test Result" action={<StatusBadge status={testResult.errors.length === 0 ? 'ok' : 'danger'}>{testResult.errors.length === 0 ? 'PASS' : 'FAIL'}</StatusBadge>}>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <TestMetric label="Settings Wired" passed={testResult.settingsWired} />
              <TestMetric label="Betfair Connected" passed={testResult.betfairConnected} />
              <TestMetric label="Featherless AI" passed={testResult.featherlessConnected} />
              <TestMetric label="OpenAI Search" passed={testResult.openAIWebSearchWorking} />
              <TestMetric label="Markets Loaded" value={testResult.marketsLoaded} passed={testResult.marketsLoaded > 0} />
              <TestMetric label="Opportunities" value={testResult.opportunitiesGenerated} passed={testResult.opportunitiesGenerated > 0} />
              <TestMetric label="Probabilities" passed={testResult.probabilitiesGenerated} />
              <TestMetric label="EV Calculated" passed={testResult.evCalculated} />
              <TestMetric label="Validation Ran" passed={testResult.validationRan} />
              <TestMetric label="Risk Check Ran" passed={testResult.riskCheckRan} />
              <TestMetric label="Paper Order Would Create" passed={testResult.paperOrderWouldCreate} />
              <TestMetric label="Settlement Available" passed={testResult.settlementAvailable} />
            </div>

            {testResult.marketTypesDetected && Object.keys(testResult.marketTypesDetected).length > 0 && (
              <div className="flex gap-4 text-xs">
                {Object.entries(testResult.marketTypesDetected).map(([type, count]) => (
                  <span key={type} className="px-2 py-1 bg-muted rounded font-mono">{type}: {count}</span>
                ))}
              </div>
            )}

            {testResult.selectedOpportunity && (
              <div className="bg-muted/30 border border-border rounded p-3 text-xs">
                <div className="font-bold text-foreground mb-1">Selected Opportunity (would create paper order)</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono">
                  <span>Runner: {testResult.selectedOpportunity.runnerName}</span>
                  <span>Side: {testResult.selectedOpportunity.side}</span>
                  <span>Odds: {testResult.selectedOpportunity.odds?.toFixed(2)}</span>
                  <span>EV: ${testResult.selectedOpportunity.ev?.toFixed(2)}</span>
                  <span>ROI: {(testResult.selectedOpportunity.roi * 100)?.toFixed(1)}%</span>
                  <span>Edge: {(testResult.selectedOpportunity.edge * 100)?.toFixed(1)}%</span>
                  <span>P: {(testResult.selectedOpportunity.modelProbability * 100)?.toFixed(1)}%</span>
                  <span>Decision: {testResult.selectedOpportunity.decision}</span>
                </div>
              </div>
            )}

            {testResult.noBetReason && (
              <div className="bg-warning/10 border border-warning/30 rounded p-3 text-xs">
                <span className="font-bold text-warning">No Bet Reason: </span>
                <span className="text-foreground">{testResult.noBetReason}</span>
              </div>
            )}

            {testResult.errors.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-destructive">Errors ({testResult.errors.length})</div>
                {testResult.errors.map((e, i) => <div key={i} className="text-xs text-destructive font-mono">• {e}</div>)}
              </div>
            )}

            {testResult.warnings.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-warning">Warnings ({testResult.warnings.length})</div>
                {testResult.warnings.map((w, i) => <div key={i} className="text-xs text-warning font-mono">• {w}</div>)}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Live Wiring Status */}
      <Panel title="Live Wiring Status">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Connected</TableHead>
              <TableHead>Last Call</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Used By Bot</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liveStatus.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-xs">{s.serviceName}</TableCell>
                <TableCell>{s.connected ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.lastSuccessfulCallAt ? new Date(s.lastSuccessfulCallAt).toLocaleTimeString() : '—'}</TableCell>
                <TableCell className="text-xs font-mono">{s.recordsReturned ?? '—'}</TableCell>
                <TableCell className="text-xs">{s.dataUsedByBot ? 'YES' : 'NO'}</TableCell>
                <TableCell><StatusBadge status={s.connected ? 'ok' : 'neutral'}>{s.status}</StatusBadge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {/* Settings Wiring Check */}
      <Panel title="Settings Wiring Check">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setting</TableHead>
              <TableHead>UI Value</TableHead>
              <TableHead>Saved Value</TableHead>
              <TableHead>Bot Uses</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settingsRows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-xs">{r.settingName}</TableCell>
                <TableCell className="text-xs font-mono">{r.uiValue}</TableCell>
                <TableCell className="text-xs font-mono">{r.savedValue}</TableCell>
                <TableCell className="text-xs font-mono">{r.valueUsedByBot}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                <TableCell>
                  <StatusBadge status={
                    r.status === 'wired' ? 'ok' :
                    r.status === 'mismatch' ? 'warning' :
                    r.status === 'missing' ? 'danger' :
                    r.status === 'not_used' ? 'neutral' : 'neutral'
                  }>{r.status}</StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {/* Betfair Data Diagnostics */}
      <Panel title="Betfair Data Diagnostics">
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {(() => {
            const mfd = lastDiag?.marketFeedDiagnostics || {};
            const twf = lastDiag?.timeWindowFunnel || {};
            const cd = lastDiag?.connectionDiagnostics || {};
            const items = [
              ['Total Markets', mfd.marketsInMemory ?? app.markets?.length ?? 0],
              ['Open Markets', mfd.marketsOpen ?? 0],
              ['Suspended', mfd.marketsSuspended ?? 0],
              ['Closed', mfd.marketsClosed ?? 0],
              ['In-Play', mfd.marketsInPlay ?? 0],
              ['Not In-Play', mfd.marketsNotInPlay ?? 0],
              ['With Start Time', mfd.marketsWithStartTime ?? 0],
              ['Without Start Time', mfd.marketsWithoutStartTime ?? 0],
              ['With Runners', mfd.marketsWithRunners ?? 0],
              ['With Price Data', mfd.marketsWithPriceData ?? 0],
              ['Missing Price Data', mfd.marketsMissingPriceData ?? 0],
              ['Inside Time Window', twf.insideWindowMarkets ?? 0],
              ['Too Early', twf.tooEarlyMarkets ?? 0],
              ['Too Late', twf.tooLateMarkets ?? 0],
              ['No Start Time', twf.noStartTimeMarkets ?? 0],
              ['Betfair API', cd.betfairApiConnected ? 'YES' : 'NO'],
              ['Stream Connected', cd.streamConnected ? 'YES' : 'NO'],
              ['Price Feed Stale', cd.priceFeedStale ? 'YES' : 'NO'],
              ['Last Stream Update', cd.lastStreamUpdateAt ? new Date(cd.lastStreamUpdateAt).toLocaleTimeString() : '—'],
              ['Last Catalogue', cd.lastCatalogueRefreshAt ? new Date(cd.lastCatalogueRefreshAt).toLocaleTimeString() : '—'],
            ];
            return items.map(([label, value], i) => (
              <div key={i} className="bg-muted/30 border border-border rounded p-2">
                <div className="text-muted-foreground">{label}</div>
                <div className="font-mono font-bold text-foreground mt-1">{value}</div>
              </div>
            ));
          })()}
        </div>
      </Panel>

      {/* Exchange Engine Diagnostics */}
      <Panel title="Exchange Opportunity Engine Diagnostics">
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {(() => {
            const d = lastDiag || {};
            const items = [
              ['Total Markets Loaded', d.totalMarketsLoaded ?? 0],
              ['Open Pre-Race Markets', d.openPreRaceMarkets ?? 0],
              ['Inside Time Window', d.marketsInsideTimeWindow ?? 0],
              ['After Runner Filter', d.eligibleMarketsAfterRunnerFilter ?? 0],
              ['After Price Filter', d.eligibleMarketsAfterPriceFilter ?? 0],
              ['Sent to Engine', d.marketsSentToExchangeEngine ?? 0],
              ['Race Clusters', d.raceClustersCreated ?? 0],
              ['Events Scanned', d.eventsScanned ?? 0],
              ['Events With AI', d.eventsWithAI ?? 0],
              ['AI Cache Hits', d.aiCacheHits ?? 0],
              ['AI Calls Made', d.aiCallsMade ?? 0],
              ['WIN Markets', d.winMarketsFound ?? 0],
              ['PLACE Markets', d.placeMarketsFound ?? 0],
              ['H2H Markets', d.h2hMarketsFound ?? 0],
              ['UNKNOWN Markets', d.unknownMarketsFound ?? 0],
              ['Total Opportunities', d.totalOpportunities ?? 0],
              ['BACK Opportunities', d.backOpportunities ?? 0],
              ['LAY Opportunities', d.layOpportunities ?? 0],
              ['Positive EV', d.positiveEVOpportunities ?? 0],
              ['Rejected', d.rejectedOpportunities ?? 0],
            ];
            return items.map(([label, value], i) => (
              <div key={i} className="bg-muted/30 border border-border rounded p-2">
                <div className="text-muted-foreground">{label}</div>
                <div className="font-mono font-bold text-foreground mt-1">{value}</div>
              </div>
            ));
          })()}
        </div>
        {lastDiag?.noBetReason && (
          <div className="px-4 pb-4">
            <div className="bg-warning/10 border border-warning/30 rounded p-2 text-xs">
              <span className="font-bold text-warning">No Bet Reason: </span>
              <span>{lastDiag.noBetReason}</span>
            </div>
          </div>
        )}
      </Panel>

      {/* OpenAI Search Wiring Check */}
      <Panel title="OpenAI Search Wiring Check">
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {(() => {
            const ext = lastDiag?.externalSearchDiagnostics || {};
            const items = [
              ['Search Enabled', ext.enabled ? 'YES' : 'NO'],
              ['Calls This Cycle', ext.callsThisCycle ?? 0],
              ['Cache Hits', ext.cacheHits ?? 0],
              ['Cache Misses', ext.cacheMisses ?? 0],
              ['Timeouts', ext.timeouts ?? 0],
              ['Errors', ext.errors ?? 0],
              ['No Results', ext.noResults ?? 0],
              ['Total Sources Found', ext.totalSourcesFound ?? 0],
              ['Runners Affected', ext.runnersAffected ?? 0],
              ['Latest Status', ext.latestSearchStatus || 'not_called'],
              ['Probability Changes', (ext.probabilityChanges || []).length],
              ['Decision Changes', (ext.decisionChanges || []).length],
            ];
            return items.map(([label, value], i) => (
              <div key={i} className="bg-muted/30 border border-border rounded p-2">
                <div className="text-muted-foreground">{label}</div>
                <div className="font-mono font-bold text-foreground mt-1">{value}</div>
              </div>
            ));
          })()}
        </div>
        {lastDiag?.externalSearchDiagnostics?.latestSearchQuery && (
          <div className="px-4 pb-4">
            <div className="bg-muted/30 border border-border rounded p-2 text-xs">
              <span className="font-bold text-muted-foreground">Latest Query: </span>
              <span className="font-mono">{lastDiag.externalSearchDiagnostics.latestSearchQuery}</span>
            </div>
          </div>
        )}
        {lastDiag?.externalSearchDiagnostics?.latestSearchSummary && (
          <div className="px-4 pb-4">
            <div className="bg-muted/30 border border-border rounded p-2 text-xs">
              <span className="font-bold text-muted-foreground">Latest Summary: </span>
              <span>{lastDiag.externalSearchDiagnostics.latestSearchSummary}</span>
            </div>
          </div>
        )}
      </Panel>

      {/* Top Opportunities (from last cycle) */}
      {lastDiag?.topOpportunities && lastDiag.topOpportunities.length > 0 && (
        <Panel title="Top Opportunities (Last Cycle)">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Runner</TableHead>
                  <TableHead className="text-xs">Market</TableHead>
                  <TableHead className="text-xs">Side</TableHead>
                  <TableHead className="text-xs">Odds</TableHead>
                  <TableHead className="text-xs">P(model)</TableHead>
                  <TableHead className="text-xs">Edge</TableHead>
                  <TableHead className="text-xs">EV</TableHead>
                  <TableHead className="text-xs">ROI</TableHead>
                  <TableHead className="text-xs">Ext.Search</TableHead>
                  <TableHead className="text-xs">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastDiag.topOpportunities.slice(0, 10).map((o, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{o.runnerName}</TableCell>
                    <TableCell className="text-xs">{o.marketName}</TableCell>
                    <TableCell className="text-xs">{o.side === 'BACK' ? <StatusBadge status="info">BACK</StatusBadge> : <StatusBadge status="danger">LAY</StatusBadge>}</TableCell>
                    <TableCell className="text-xs font-mono">{o.odds?.toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-mono">{(o.modelProbability * 100)?.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs font-mono">{(o.edge * 100)?.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs font-mono">${o.ev?.toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-mono">{(o.roi * 100)?.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs">{o.externalSearchUsed ? <StatusBadge status="ok">USED</StatusBadge> : <StatusBadge status="neutral">—</StatusBadge>}</TableCell>
                    <TableCell><StatusBadge status={o.decision === 'BET' ? 'ok' : 'danger'}>{o.decision}</StatusBadge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      {/* Probability Traceability (from top opportunities) */}
      {lastDiag?.topOpportunities && lastDiag.topOpportunities.some(o => o.externalSearchUsed) && (
        <Panel title="Probability Traceability (External Search Adjusted)">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Runner</TableHead>
                <TableHead className="text-xs">Pre-Search P</TableHead>
                <TableHead className="text-xs">Post-Search P</TableHead>
                <TableHead className="text-xs">Delta</TableHead>
                <TableHead className="text-xs">Sources</TableHead>
                <TableHead className="text-xs">Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lastDiag.topOpportunities.filter(o => o.externalSearchUsed).slice(0, 10).map((o, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">{o.runnerName}</TableCell>
                  <TableCell className="text-xs font-mono">{((o.preSearchProbability || 0) * 100)?.toFixed(2)}%</TableCell>
                  <TableCell className="text-xs font-mono">{((o.postSearchProbability || 0) * 100)?.toFixed(2)}%</TableCell>
                  <TableCell className="text-xs font-mono">{((o.probabilityDelta || 0) * 100)?.toFixed(2)}%</TableCell>
                  <TableCell className="text-xs font-mono">{o.externalSourceCount}</TableCell>
                  <TableCell><StatusBadge status={o.decisionImpact === 'no_effect' ? 'neutral' : 'info'}>{o.decisionImpact}</StatusBadge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

function TestMetric({ label, value, passed }) {
  return (
    <div className="bg-muted/30 border border-border rounded p-3 flex items-center gap-2">
      {passed === true ? <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
        : passed === false ? <XCircle className="h-4 w-4 text-danger flex-shrink-0" />
        : null}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
        <div className="text-sm font-bold font-mono">{value !== undefined ? value : passed ? 'YES' : 'NO'}</div>
      </div>
    </div>
  );
}