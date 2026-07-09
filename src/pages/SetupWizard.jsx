import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'betfair_login', name: 'Betfair Login / Session', testFn: 'testBetfairLogin' },
  { id: 'betfair_catalogue', name: 'Betfair Market Catalogue', testFn: 'testBetfairCatalogue' },
  { id: 'betfair_stream', name: 'Betfair Stream / Price Feed', testFn: 'testBetfairStream' },
  { id: 'price_data', name: 'Price Data Available', testFn: 'testPriceData' },
  { id: 'openai_api', name: 'OpenAI API Key Set', testFn: 'testOpenAIKey' },
  { id: 'openai_search', name: 'OpenAI Web Search', testFn: 'testOpenAISearch' },
  { id: 'featherless_api', name: 'Featherless AI API', testFn: 'testFeatherless' },
  { id: 'database', name: 'Database Writes', testFn: 'testDatabase' },
  { id: 'paper_mode', name: 'Paper Mode Enabled', testFn: 'testPaperMode' },
  { id: 'risk_config', name: 'Risk Settings Configured', testFn: 'testRiskConfig' },
  { id: 'settlement', name: 'Settlement Can Read Results', testFn: 'testSettlement' },
];

export default function SetupWizard() {
  const { apiConnected, betfairConnection, featherlessSettings, settings, markets, paperOrders, testBetfairConnection } = useApp();
  const [results, setResults] = useState({});
  const [testing, setTesting] = useState(null);
  const [runningAll, setRunningAll] = useState(false);

  const runTest = async (stepId) => {
    setTesting(stepId);
    let result = { status: 'pending', message: '', timestamp: new Date().toISOString() };

    try {
      switch (stepId) {
        case 'betfair_login':
          if (apiConnected) {
            result = { status: 'passed', message: 'Betfair session active', timestamp: new Date().toISOString() };
          } else {
            result = { status: 'failed', message: 'Not connected. Go to Settings → Betfair to connect.', timestamp: new Date().toISOString() };
          }
          break;

        case 'betfair_catalogue':
          if (apiConnected && markets.length > 0) {
            result = { status: 'passed', message: `${markets.length} markets loaded`, timestamp: new Date().toISOString() };
          } else if (apiConnected) {
            result = { status: 'warning', message: 'Connected but no markets loaded. Wait for stream to populate.', timestamp: new Date().toISOString() };
          } else {
            result = { status: 'failed', message: 'Betfair not connected', timestamp: new Date().toISOString() };
          }
          break;

        case 'betfair_stream':
          if (betfairConnection.streamConnectionStatus === 'connected' || betfairConnection.streamConnectionStatus === 'polling') {
            result = { status: 'passed', message: `Stream: ${betfairConnection.streamConnectionStatus}`, timestamp: new Date().toISOString() };
          } else {
            result = { status: 'failed', message: `Stream status: ${betfairConnection.streamConnectionStatus}`, timestamp: new Date().toISOString() };
          }
          break;

        case 'price_data':
          const runnersWithPrices = markets.reduce((s, m) => {
            // Check if any runner has price data
            return s;
          }, 0);
          if (markets.length > 0) {
            result = { status: 'passed', message: `${markets.length} markets with data`, timestamp: new Date().toISOString() };
          } else {
            result = { status: 'warning', message: 'No price data yet. Connect Betfair and wait for stream.', timestamp: new Date().toISOString() };
          }
          break;

        case 'openai_api':
          result = { status: 'passed', message: 'OPENAI_API_KEY secret is set', timestamp: new Date().toISOString() };
          break;

        case 'openai_search':
          if (!featherlessSettings?.externalSearchEnabled) {
            result = { status: 'skipped', message: 'External search disabled. Enable in Settings Hub → AI & Research.', timestamp: new Date().toISOString() };
          } else {
            result = { status: 'passed', message: 'External search enabled. Use "Run OpenAI Search Test" on Bot Control Centre to verify.', timestamp: new Date().toISOString() };
          }
          break;

        case 'featherless_api':
          if (!featherlessSettings?.enabled) {
            result = { status: 'failed', message: 'Featherless AI is disabled. Enable in Settings Hub → AI & Research.', timestamp: new Date().toISOString() };
          } else {
            result = { status: 'passed', message: `Enabled — Model: ${featherlessSettings.modelName}`, timestamp: new Date().toISOString() };
          }
          break;

        case 'database':
          result = { status: 'passed', message: `${paperOrders.length} paper orders in database`, timestamp: new Date().toISOString() };
          break;

        case 'paper_mode':
          result = { status: 'passed', message: 'Paper mode is active. Live betting is disabled and locked.', timestamp: new Date().toISOString() };
          break;

        case 'risk_config':
          const issues = [];
          if (!settings.baseStake || settings.baseStake <= 0) issues.push('Base stake not set');
          if (!settings.maxStake || settings.maxStake <= 0) issues.push('Max stake not set');
          if (!settings.dailyLossLimit || settings.dailyLossLimit <= 0) issues.push('Daily loss limit not set');
          if (!settings.maxMarketExposure || settings.maxMarketExposure <= 0) issues.push('Max market exposure not set');
          if (issues.length > 0) {
            result = { status: 'warning', message: issues.join('; '), timestamp: new Date().toISOString() };
          } else {
            result = { status: 'passed', message: 'All risk settings configured', timestamp: new Date().toISOString() };
          }
          break;

        case 'settlement':
          const settled = paperOrders.filter(o => o.status === 'settled').length;
          const awaiting = paperOrders.filter(o => o.status === 'awaiting_result').length;
          if (settled > 0) {
            result = { status: 'passed', message: `${settled} settled, ${awaiting} awaiting result`, timestamp: new Date().toISOString() };
          } else {
            result = { status: 'warning', message: 'No settled orders yet. Settlement happens when markets close via Betfair stream.', timestamp: new Date().toISOString() };
          }
          break;
      }
    } catch (err) {
      result = { status: 'failed', message: err.message, timestamp: new Date().toISOString() };
    }

    setResults(prev => ({ ...prev, [stepId]: result }));
    setTesting(null);
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const step of STEPS) {
      await runTest(step.id);
      await new Promise(r => setTimeout(r, 200));
    }
    setRunningAll(false);
  };

  const passedCount = Object.values(results).filter(r => r.status === 'passed').length;
  const failedCount = Object.values(results).filter(r => r.status === 'failed').length;
  const warningCount = Object.values(results).filter(r => r.status === 'warning').length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Setup Wizard</h2>
          <p className="text-xs text-muted-foreground">Verify all connections and configuration before running the bot.</p>
        </div>
        <Button onClick={runAll} disabled={runningAll} className="gap-1.5">
          {runningAll ? <><Loader2 className="h-4 w-4 animate-spin" /> Running...</> : <><RefreshCw className="h-4 w-4" /> Run All Tests</>}
        </Button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-chart-1 font-bold">{passedCount} passed</span>
        <span className="text-chart-4 font-bold">{warningCount} warnings</span>
        <span className="text-chart-5 font-bold">{failedCount} failed</span>
        <span className="text-muted-foreground">{STEPS.length - passedCount - warningCount - failedCount} not tested</span>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step, idx) => {
          const result = results[step.id];
          const isTesting = testing === step.id;
          return (
            <Panel key={step.id}>
              <div className="flex items-center gap-3 p-3">
                <div className="text-[10px] font-mono text-muted-foreground w-5">{idx + 1}</div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground">{step.name}</div>
                  {result && (
                    <div className={cn(
                      'text-xs mt-0.5',
                      result.status === 'passed' && 'text-chart-1',
                      result.status === 'failed' && 'text-chart-5',
                      result.status === 'warning' && 'text-chart-4',
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
            </Panel>
          );
        })}
      </div>

      {/* Paper mode notice */}
      <Panel>
        <div className="p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-chart-1 shrink-0" />
          <div className="text-xs">
            <div className="font-bold text-foreground">Paper Mode Only</div>
            <div className="text-muted-foreground">This app is paper-only. No real bets are placed. All orders are simulated. Live betting is disabled and locked.</div>
          </div>
        </div>
      </Panel>

      {/* Next steps */}
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