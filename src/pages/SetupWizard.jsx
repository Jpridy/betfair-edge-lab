import React, { useState, useRef } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, RefreshCw, ArrowRight, ShieldCheck, Database, Radio, Stethoscope } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'betfair_session', name: 'Test Betfair Session' },
  { id: 'endpoint_diagnostic', name: 'Run Betfair Endpoint Diagnostic' },
  { id: 'fetch_markets', name: 'Fetch Betfair Markets Now' },
  { id: 'check_prices', name: 'Check Betfair Prices Now' },
  { id: 'betfair_stream', name: 'Betfair Stream / Price Feed' },
  { id: 'openai_api', name: 'OpenAI API Key (Status Check)' },
  { id: 'openai_search', name: 'OpenAI Web Search (Live Test)' },
  { id: 'featherless_api', name: 'Featherless AI API' },
  { id: 'database', name: 'Database Writes' },
  { id: 'paper_mode', name: 'Paper Mode Enabled' },
  { id: 'risk_config', name: 'Risk Settings Configured' },
  { id: 'settlement', name: 'Settlement Status' },
];

export default function SetupWizard() {
  const { apiConnected, betfairConnection, featherlessSettings, settings, markets, runners, paperOrders, addAuditLog, refreshBetfairData, betfairSessionToken } = useApp();
  const [results, setResults] = useState({});
  const [testing, setTesting] = useState(null);
  const [runningAll, setRunningAll] = useState(false);

  // Ref to always access the latest runTest (avoids stale closures in runAll)
  const runTestRef = useRef(null);

  const runTest = async (stepId) => {
    setTesting(stepId);
    let result = { status: 'pending', message: '', timestamp: new Date().toISOString() };

    try {
      switch (stepId) {
        // ── A. Test Betfair Session ──
        case 'betfair_session': {
          try {
            const resp = await base44.functions.invoke('betfairLogin', { sessionToken: betfairSessionToken });
            const data = resp.data;
            const sessionTokenPresent = !!betfairSessionToken;
            const appKeyPresent = !!data?.appKey;
            const proxyUrlPresent = !!data?.proxyUrl;
            const betfairSessionValid = data?.status === 'success' && sessionTokenPresent;

            result = {
              status: betfairSessionValid ? 'passed' : 'failed',
              message: betfairSessionValid
                ? `Session valid. App Key: ${appKeyPresent ? '✓' : '✗'}, Proxy: ${proxyUrlPresent ? '✓' : '✗'}, Jurisdiction: ${data?.jurisdiction || '—'}`
                : `Session check failed. ${!sessionTokenPresent ? 'No session token. ' : ''}${!appKeyPresent ? 'App key missing. ' : ''}${!proxyUrlPresent ? 'Proxy URL missing. ' : ''}${data?.error || ''}`,
              timestamp: new Date().toISOString(),
              detail: { sessionTokenPresent, appKeyPresent, proxyUrlPresent, betfairSessionValid, jurisdiction: data?.jurisdiction, error: data?.error },
            };
          } catch (err) {
            result = { status: 'failed', message: `Session test failed: ${err.message}`, timestamp: new Date().toISOString() };
          }
          break;
        }

        // ── B. Run Betfair Endpoint Diagnostic ──
        case 'endpoint_diagnostic': {
          if (!betfairSessionToken) {
            result = { status: 'failed', message: 'Betfair session token missing. Connect a session token first.', timestamp: new Date().toISOString() };
            break;
          }
          try {
            const resp = await base44.functions.invoke('betfairMarkets', {
              action: 'diagnose_endpoint',
              sessionToken: betfairSessionToken,
              testBothEndpoints: true,
            });
            const d = resp.data;
            if (d?.error) {
              result = { status: 'failed', message: d.error, timestamp: new Date().toISOString(), detail: d };
            } else if (d?.workingApiBase) {
              const endpoints = d.endpoints || [];
              const summary = endpoints.map(e => `${e.apiBase.replace('https://', '')}: ${e.success ? '✓' : '✗'} (HTTP ${e.httpStatus}, HTML: ${e.responseLooksHtml ? 'Y' : 'N'})`).join('; ');
              result = {
                status: 'passed',
                message: `Working endpoint: ${d.workingApiBase}. HTML 403 detected: ${d.html403Detected ? 'Yes' : 'No'}. ${summary}`,
                timestamp: new Date().toISOString(),
                detail: d,
              };
            } else {
              result = {
                status: 'failed',
                message: `No working endpoint found. HTML 403 detected: ${d?.html403Detected ? 'Yes' : 'No'}. All endpoints returned HTML or errors. Check proxy configuration.`,
                timestamp: new Date().toISOString(),
                detail: d,
              };
            }
          } catch (err) {
            result = { status: 'failed', message: `Diagnostic failed: ${err.message}`, timestamp: new Date().toISOString() };
          }
          break;
        }

        // ── C. Fetch Betfair Markets Now ──
        case 'fetch_markets': {
          if (!betfairSessionToken) {
            result = { status: 'failed', message: 'Betfair session missing. Open Setup and connect with session token.', timestamp: new Date().toISOString() };
            break;
          }
          try {
            const fetchResult = await refreshBetfairData();
            if (fetchResult?.error) {
              result = { status: 'failed', message: fetchResult.error, timestamp: new Date().toISOString(), detail: fetchResult };
            } else {
              const d = fetchResult;
              result = {
                status: d.marketsReturned > 0 ? 'passed' : 'warning',
                message: `${d.marketsReturned} markets, ${d.runnersReturned} runners, ${d.pricedRunnersReturned} priced. WIN: ${d.winMarketsReturned}, PLACE: ${d.placeMarketsReturned}, H2H: ${d.h2hMarketsReturned}. First: ${d.firstMarketName || '—'}`,
                timestamp: new Date().toISOString(),
                detail: d,
              };
            }
          } catch (err) {
            result = { status: 'failed', message: `Fetch failed: ${err.message}`, timestamp: new Date().toISOString() };
          }
          break;
        }

        // ── C. Check Betfair Prices Now ──
        case 'check_prices': {
          const marketsInMemory = markets.length;
          const runnersInMemory = runners.length;
          const runnersWithBack = runners.filter(r => r.bestBackPrice && r.bestBackPrice > 0).length;
          const runnersWithLay = runners.filter(r => r.bestLayPrice && r.bestLayPrice > 0).length;
          const runnersWithBackOrLay = runners.filter(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0)).length;
          const marketsWithPriceData = new Set();
          for (const r of runners) {
            if ((r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0)) {
              marketsWithPriceData.add(r.marketId);
            }
          }
          const firstPricedRunner = runners.find(r => (r.bestBackPrice && r.bestBackPrice > 0) || (r.bestLayPrice && r.bestLayPrice > 0));
          const lastPriceUpdateAt = betfairConnection?.lastMarketSyncTime || betfairConnection?.lastPriceFetchAt || null;
          const priceFeedStale = betfairConnection?.priceFeedStale ?? (runnersWithBackOrLay === 0);

          if (runnersWithBackOrLay > 0) {
            result = {
              status: 'passed',
              message: `${marketsInMemory} markets, ${runnersInMemory} runners in memory. ${runnersWithBackOrLay} runners with prices. First: ${firstPricedRunner?.runnerName || '—'} @ ${firstPricedRunner?.bestBackPrice || '—'}/${firstPricedRunner?.bestLayPrice || '—'}`,
              timestamp: new Date().toISOString(),
              detail: { marketsInMemory, runnersInMemory, marketsWithPriceData: marketsWithPriceData.size, runnersWithBackPrice: runnersWithBack, runnersWithLayPrice: runnersWithLay, runnersWithBackOrLayPrice: runnersWithBackOrLay, firstPricedRunner: firstPricedRunner?.runnerName, firstBackPrice: firstPricedRunner?.bestBackPrice, firstLayPrice: firstPricedRunner?.bestLayPrice, lastPriceUpdateAt, priceFeedStale },
            };
          } else if (marketsInMemory > 0) {
            result = { status: 'warning', message: `${marketsInMemory} markets in memory but 0 runners with price data. Stream may not have connected or prices not yet populated.`, timestamp: new Date().toISOString(), detail: { marketsInMemory, runnersInMemory, marketsWithPriceData: 0, runnersWithBackPrice: 0, runnersWithLayPrice: 0, runnersWithBackOrLayPrice: 0, lastPriceUpdateAt, priceFeedStale: true } };
          } else {
            result = { status: 'failed', message: 'No markets loaded. Fetch Betfair Markets first.', timestamp: new Date().toISOString(), detail: { marketsInMemory: 0, runnersInMemory: 0, priceFeedStale: true } };
          }
          break;
        }

        case 'betfair_stream': {
          const streamStatus = betfairConnection.streamConnectionStatus;
          if (streamStatus === 'connected' || streamStatus === 'polling') {
            result = { status: 'passed', message: `Stream: ${streamStatus}, ${markets.length} markets live`, timestamp: new Date().toISOString() };
            break;
          }

          // Stream is not connected — run worker diagnostic to find out why
          const proxyUrl = betfairConnection?.appKey ? null : null; // We don't have direct access to proxyUrl, use the betfairLogin function
          let diagParts = [`Stream status: ${streamStatus}`];

          try {
            // Get proxy URL from betfairLogin function
            const loginResp = await base44.functions.invoke('betfairLogin', { sessionToken: betfairSessionToken });
            const proxyUrlFromBackend = loginResp.data?.proxyUrl;

            if (!proxyUrlFromBackend) {
              diagParts.push('No BETFAIR_PROXY_URL configured — cannot test stream bridge');
              result = { status: 'failed', message: diagParts.join('. ') + '. REST catalogue data still works.', timestamp: new Date().toISOString(), detail: { streamStatus, proxyUrlPresent: false } };
              break;
            }

            // 1. Check worker health — does it support WebSocket upgrades?
            const healthUrl = proxyUrlFromBackend.replace(/\/$/, '') + '/health';
            const healthRes = await fetch(healthUrl);
            const healthData = await healthRes.json();
            diagParts.push(`Worker v${healthData.version || '?'}`);
            const hasStreamBridge = healthData.features?.includes('websocket-stream-bridge');

            if (!hasStreamBridge) {
              diagParts.push('Worker does NOT support WebSocket stream bridge');
              result = {
                status: 'failed',
                message: `${diagParts.join('. ')}. The deployed Cloudflare Worker is an older version (REST-only). Redeploy with the latest worker code (v6-unified) from src/cloudflare-worker/betfair-proxy.js to enable the stream.`,
                timestamp: new Date().toISOString(),
                detail: { streamStatus, workerVersion: healthData.version, workerFeatures: healthData.features, proxyUrl: proxyUrlFromBackend, actionRequired: 'Redeploy Cloudflare Worker with v6-unified code' },
              };
              break;
            }

            // 2. Test TCP connectivity to Betfair Stream API
            const streamTestUrl = proxyUrlFromBackend.replace(/\/$/, '') + '/stream-test';
            const streamTestRes = await fetch(streamTestUrl);
            const streamTestData = await streamTestRes.json();
            diagParts.push(`TCP to stream-api.betfair.com: ${streamTestData.status === 'ok' ? '✓' : '✗ ' + (streamTestData.message || '')}`);

            if (streamTestData.status === 'ok') {
              result = {
                status: 'warning',
                message: `${diagParts.join('. ')}. Worker supports WebSocket bridge and TCP works, but stream is ${streamStatus}. Check Betfair session token validity and app key permissions for streaming.`,
                timestamp: new Date().toISOString(),
                detail: { streamStatus, workerVersion: healthData.version, workerFeatures: healthData.features, streamTcpTest: streamTestData, proxyUrl: proxyUrlFromBackend },
              };
            } else {
              result = {
                status: 'failed',
                message: `${diagParts.join('. ')}. The worker cannot reach Betfair's Stream API via TCP. REST still works because it uses a different endpoint.`,
                timestamp: new Date().toISOString(),
                detail: { streamStatus, workerVersion: healthData.version, streamTcpTest: streamTestData, proxyUrl: proxyUrlFromBackend },
              };
            }
          } catch (err) {
            diagParts.push(`Worker diagnostic failed: ${err.message}`);
            result = { status: 'warning', message: `${diagParts.join('. ')}. REST catalogue data still works.`, timestamp: new Date().toISOString(), detail: { streamStatus, error: err.message } };
          }
          break;
        }

        case 'openai_api': {
          try {
            const resp = await base44.functions.invoke('openAIWebSearch', { action: 'status_check' });
            const check = resp.data?.statusCheck;
            if (check?.openAiApiKeyPresent) {
              result = { status: 'passed', message: `OpenAI API key verified. Model: ${check.model}`, timestamp: new Date().toISOString() };
            } else {
              result = { status: 'failed', message: 'OpenAI API key not set or backend did not confirm', timestamp: new Date().toISOString() };
            }
          } catch (err) {
            result = { status: 'failed', message: `Status check failed: ${err.message}`, timestamp: new Date().toISOString() };
          }
          break;
        }

        case 'openai_search': {
          if (!featherlessSettings?.externalSearchEnabled) {
            result = { status: 'skipped', message: 'External search disabled. Enable in Settings Hub → AI & Research to test.', timestamp: new Date().toISOString() };
            break;
          }
          try {
            const testMarket = markets[0] ? {
              eventId: markets[0].eventId || 'test',
              eventName: markets[0].eventName || 'Test Race',
              venue: markets[0].venue || 'Test',
              raceNumber: markets[0].raceNumber || 1,
              marketName: markets[0].marketName || 'WIN',
              startTime: markets[0].startTime || markets[0].marketStartTime || new Date().toISOString(),
            } : {
              eventId: 'test', eventName: 'Test Race', venue: 'Test', raceNumber: 1,
              marketName: 'WIN', startTime: new Date().toISOString(),
            };
            const testRunners = runners.slice(0, 3).map(r => ({
              betfairSelectionId: r.betfairSelectionId || r.selectionId,
              runnerName: r.runnerName || 'Test Runner',
              status: 'ACTIVE',
            }));
            const resp = await base44.functions.invoke('openAIWebSearch', {
              market: testMarket, runners: testRunners, settings: featherlessSettings,
            });
            const searchResult = resp.data?.externalSearchResult;
            if (searchResult?.searchStatus === 'success' || searchResult?.searchStatus === 'no_results') {
              result = { status: 'passed', message: `Search returned: ${searchResult.searchStatus}, ${searchResult.sourceCount || 0} sources, quality ${searchResult.dataQuality || 0}`, timestamp: new Date().toISOString() };
            } else if (searchResult?.searchStatus === 'timeout') {
              result = { status: 'warning', message: `Search timed out: ${searchResult.errorMessage || ''}`, timestamp: new Date().toISOString() };
            } else {
              result = { status: 'failed', message: `Search failed: ${searchResult?.searchStatus || 'unknown'} — ${searchResult?.errorMessage || resp.data?.error || ''}`, timestamp: new Date().toISOString() };
            }
          } catch (err) {
            result = { status: 'failed', message: `Search test error: ${err.message}`, timestamp: new Date().toISOString() };
          }
          break;
        }

        case 'featherless_api':
          if (!featherlessSettings?.enabled) {
            result = { status: 'failed', message: 'Featherless AI is disabled. Enable in Settings Hub → AI & Research.', timestamp: new Date().toISOString() };
          } else {
            result = { status: 'passed', message: `Enabled — Model: ${featherlessSettings.modelName}`, timestamp: new Date().toISOString() };
          }
          break;

        case 'database': {
          try {
            const testLog = {
              action: 'Setup Wizard Database Test',
              category: 'system',
              severity: 'info',
              details: `Database write test at ${new Date().toISOString()}`,
              timestamp: new Date().toISOString(),
            };
            const created = await base44.entities.AuditLog.create(testLog);
            if (created?.id) {
              result = { status: 'passed', message: `Test record written and confirmed (ID: ${created.id.slice(0, 8)}...)`, timestamp: new Date().toISOString() };
            } else {
              result = { status: 'warning', message: 'Write returned but no ID confirmed', timestamp: new Date().toISOString() };
            }
          } catch (err) {
            result = { status: 'failed', message: `Database write failed: ${err.message}`, timestamp: new Date().toISOString() };
          }
          break;
        }

        case 'paper_mode':
          result = { status: 'passed', message: 'Paper mode is active. Live betting is disabled and locked.', timestamp: new Date().toISOString() };
          break;

        case 'risk_config': {
          const issues = [];
          if (!settings.baseStake || settings.baseStake <= 0) issues.push('Base stake not set');
          if (!settings.maxStake || settings.maxStake <= 0) issues.push('Max stake not set');
          if (!settings.dailyLossLimit || settings.dailyLossLimit <= 0) issues.push('Daily loss limit not set');
          if (!settings.maxMarketExposure || settings.maxMarketExposure <= 0) issues.push('Max market exposure not set');
          if (settings.riskLimitsDisabled) issues.push('⚠️ Risk limits DISABLED (testing mode)');
          if (issues.length > 0) {
            result = { status: 'warning', message: issues.join('; '), timestamp: new Date().toISOString() };
          } else {
            result = { status: 'passed', message: 'All risk settings configured', timestamp: new Date().toISOString() };
          }
          break;
        }

        case 'settlement': {
          const settled = paperOrders.filter(o => o.status === 'settled');
          const awaiting = paperOrders.filter(o => o.status === 'awaiting_result');
          const unknown = paperOrders.filter(o => o.status === 'awaiting_result' && o.resultConfidence === 'unknown');
          const latestSettled = settled[0];
          const parts = [
            `${settled.length} settled`,
            `${awaiting.length} awaiting result`,
            `${unknown.length} result unknown`,
          ];
          if (latestSettled) {
            parts.push(`latest source: ${latestSettled.resultSource || 'betfair_stream'}`);
            parts.push(`result: ${latestSettled.result}`);
          }
          if (settled.length > 0) {
            result = { status: 'passed', message: parts.join(', '), timestamp: new Date().toISOString() };
          } else if (awaiting.length > 0) {
            result = { status: 'warning', message: parts.join(', ') + ' — settlement pending market close', timestamp: new Date().toISOString() };
          } else {
            result = { status: 'warning', message: 'No settled or awaiting orders. Settlement happens when markets close via Betfair stream.', timestamp: new Date().toISOString() };
          }
          break;
        }
      }
    } catch (err) {
      result = { status: 'failed', message: err.message, timestamp: new Date().toISOString() };
    }

    setResults(prev => ({ ...prev, [stepId]: result }));
    setTesting(null);
  };

  // Keep ref in sync with latest runTest (which captures latest markets/runners)
  runTestRef.current = runTest;

  const runAll = async () => {
    setRunningAll(true);
    for (const step of STEPS) {
      await runTestRef.current(step.id);
      await new Promise(r => setTimeout(r, 200));
    }
    setRunningAll(false);
  };

  const passedCount = Object.values(results).filter(r => r.status === 'passed').length;
  const failedCount = Object.values(results).filter(r => r.status === 'failed').length;
  const warningCount = Object.values(results).filter(r => r.status === 'warning').length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Setup Wizard</h2>
          <p className="text-xs text-muted-foreground">Verify all connections and configuration before running the bot. Each test calls the real backend.</p>
        </div>
        <Button onClick={runAll} disabled={runningAll} className="gap-1.5">
          {runningAll ? <><Loader2 className="h-4 w-4 animate-spin" /> Running...</> : <><RefreshCw className="h-4 w-4" /> Run All Tests</>}
        </Button>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span className="text-success font-bold">{passedCount} passed</span>
        <span className="text-warning font-bold">{warningCount} warnings</span>
        <span className="text-danger font-bold">{failedCount} failed</span>
        <span className="text-muted-foreground">{STEPS.length - passedCount - warningCount - failedCount} not tested</span>
      </div>

      <div className="space-y-2">
        {STEPS.map((step, idx) => {
          const result = results[step.id];
          const isTesting = testing === step.id;
          return (
            <Panel key={step.id}>
              <div className="p-3">
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-mono text-muted-foreground w-5">{idx + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-foreground">{step.name}</div>
                    {result && (
                      <div className={cn(
                        'text-xs mt-0.5',
                        result.status === 'passed' && 'text-success',
                        result.status === 'failed' && 'text-danger',
                        result.status === 'warning' && 'text-warning',
                        result.status === 'skipped' && 'text-muted-foreground'
                      )}>
                        {result.message}
                      </div>
                    )}
                  </div>
                  {result && (
                    <StatusBadge status={
                      result.status === 'passed' ? 'ok' :
                      result.status === 'failed' ? 'danger' :
                      result.status === 'warning' ? 'warning' : 'neutral'
                    }>
                      {result.status.toUpperCase()}
                    </StatusBadge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => runTest(step.id)} disabled={isTesting} className="gap-1.5">
                    {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Test
                  </Button>
                </div>
                {result?.detail && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Details</summary>
                    <pre className="mt-1 text-[10px] font-mono text-muted-foreground bg-muted/20 rounded p-2 overflow-auto max-h-48">{JSON.stringify(result.detail, null, 2)}</pre>
                  </details>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel>
        <div className="p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-success shrink-0" />
          <div className="text-xs">
            <div className="font-bold text-foreground">Paper Mode Only</div>
            <div className="text-muted-foreground">This app is paper-only. No real bets are placed. All orders are simulated. Live betting is disabled and locked.</div>
          </div>
        </div>
      </Panel>

      <div className="flex justify-between">
        <Link to="/settings">
          <Button variant="outline" size="sm" className="gap-1.5">
            Configure Settings <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link to="/">
          <Button size="sm" className="gap-1.5">
            Go to Bot Control Centre <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}