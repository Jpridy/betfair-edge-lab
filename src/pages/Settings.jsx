import React, { useState, useEffect } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Save, CheckCircle2, ShieldAlert, AlertTriangle, RefreshCw, Trash2, FileDown, Network, FlaskConical } from 'lucide-react';
import { isPaperProofModeActive, PAPER_PROOF_APP_SETTINGS, PAPER_PROOF_BOT_SETTINGS, PAPER_PROOF_FEATHERLESS_SETTINGS } from '@/lib/paperProofDefaults';
import BetfairConnection from '@/components/settings/BetfairConnection';
import FeatherlessSettings from '@/components/settings/FeatherlessSettings';
import MarketTypeThresholds from '@/components/settings/MarketTypeThresholds';
import { getCommissionWarnings } from '@/lib/betfairMapping';
import { exportToCSV } from '@/lib/csvExport';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function Settings() {
  const {
    settings, updateSettings, addAuditLog,
    botSettings, updateBotSettings,
    betfairConnection, updateBetfairConnection, testBetfairConnection, disconnectBetfair,
    apiConnected, resetAllPaperTrading, resetDailyStats, clearBotCycles, clearLogs,
    featherlessSettings, updateFeatherlessSettings,
    botCycles, paperOrders,
    applyPaperProofDefaults,
  } = useApp();

  const [local, setLocal] = useState(settings);
  const [botLocal, setBotLocal] = useState(botSettings);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [savedSection, setSavedSection] = useState(null);

  useEffect(() => { setLocal(settings); }, [settings]);
  useEffect(() => { setBotLocal(botSettings); }, [botSettings]);

  const update = (key, value) => setLocal(prev => ({ ...prev, [key]: value }));

  const handleSave = (section) => {
    updateSettings(local);
    if (section === 'bot' || section === 'all') updateBotSettings(botLocal);
    if (section === 'all') updateFeatherlessSettings(featherlessSettings);
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 2000);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    const results = await testBetfairConnection();
    setTestResults(results);
    setTestingConnection(false);
  };

  const handleExportSettings = () => {
    const exportData = { ...local };
    delete exportData.id; delete exportData.created_date; delete exportData.updated_date; delete exportData.created_by_id;
    const data = JSON.stringify(exportData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'betfair-edge-lab-settings.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCycles = () => {
    if (botCycles.length === 0) return;
    exportToCSV('bot-cycles.csv', botCycles.map(c => ({
      cycleNumber: c.cycleNumber, status: c.status, startedAt: c.startedAt, finishedAt: c.finishedAt,
      marketsScanned: c.marketsScanned, marketsPassed: c.marketsPassedFilters, signalsCreated: c.signalsCreated,
      ordersCreated: c.ordersCreated, ordersBlocked: c.ordersBlocked, noBetReason: c.noBetReason || '',
      bestCandidate: c.bestCandidate?.runnerName || '', selectedMarket: c.selectedMarketName || '', notes: c.notes || '',
    })));
  };

  const commWarnings = getCommissionWarnings({ marketBaseRate: 0.05 }, local);
  const proofActive = isPaperProofModeActive(settings, botSettings, featherlessSettings);

  return (
    <div className="space-y-5">
      {/* Paper Proof Mode banner */}
      <div className={cn(
        'border rounded-lg p-3 text-xs flex items-start gap-2',
        proofActive ? 'bg-chart-4/10 border-chart-4/30 text-chart-4' : 'bg-muted/20 border-border text-muted-foreground'
      )}>
        <FlaskConical className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="font-bold">Paper Proof Mode {proofActive ? 'is ACTIVE' : ''}</span>
          {!proofActive && ' — apply proof defaults to test the full pipeline end-to-end with relaxed filters.'}
          {proofActive && ' — filters relaxed to prove paper order creation and settlement. Not suitable for live betting.'}
          <div className="mt-1 text-[10px] opacity-80">
            Paper Proof Mode relaxes value, confidence, spread, liquidity and AI filters. It may create bad theoretical bets. Do not use these settings for live betting.
          </div>
        </div>
        <Button
          size="sm"
          variant={proofActive ? 'outline' : 'default'}
          onClick={() => applyPaperProofDefaults()}
          className="gap-1.5 shrink-0"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          {proofActive ? 'Re-apply' : 'Apply'} Paper Proof Defaults
        </Button>
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Configure bot mode, market filters, opportunity rules, risk management, AI, Betfair, and settlement.</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportSettings}><Download className="h-4 w-4 mr-1" /> Export JSON</Button>
          <Button size="sm" onClick={() => handleSave('all')}>
            {savedSection === 'all' ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save All</>}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="bot">
        <TabsList className="bg-card border border-border flex-wrap">
          <TabsTrigger value="bot" className="text-xs">Bot Mode</TabsTrigger>
          <TabsTrigger value="filters" className="text-xs">Market Filters</TabsTrigger>
          <TabsTrigger value="rules" className="text-xs">Opportunity Rules</TabsTrigger>
          <TabsTrigger value="risk" className="text-xs">Risk Management</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">AI & Research</TabsTrigger>
          <TabsTrigger value="betfair" className="text-xs">Betfair</TabsTrigger>
          <TabsTrigger value="settlement" className="text-xs">Settlement</TabsTrigger>
          <TabsTrigger value="debug" className="text-xs">Debug</TabsTrigger>
        </TabsList>

        {/* 1. Bot Mode */}
        <TabsContent value="bot">
          <Panel title="Bot Mode Configuration">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Scan Interval (seconds) — how often the bot scans markets">
                  <Input type="number" value={botLocal.scanIntervalSeconds} onChange={e => setBotLocal(prev => ({ ...prev, scanIntervalSeconds: +e.target.value }))} />
                </Field>
                <Field label="Mode — forced to paper/demo">
                  <div className="pt-2"><StatusBadge status="ok">PAPER (DEMO)</StatusBadge></div>
                </Field>
              </div>
              <div className="space-y-3 pt-3 border-t border-border">
                <ToggleRow label="Auto Paper Trading — automatically create paper orders when signals pass all checks" checked={botLocal.autoPaperTradingEnabled} onChange={v => setBotLocal(prev => ({ ...prev, autoPaperTradingEnabled: v }))} />
                <ToggleRow label="Debug Scan Mode — scan all markets regardless of time window (for testing)" checked={featherlessSettings?.debugScanMode || false} onChange={v => updateFeatherlessSettings({ debugScanMode: v })} />
                <ToggleRow label="Live Trading — DISABLED (forced off)" checked={false} onChange={() => {}} />
              </div>
              <div className="bg-chart-1/10 border border-chart-1/30 rounded-lg p-3 text-xs text-muted-foreground">
                <span className="text-chart-1 font-bold">Paper Mode:</span> The bot only creates simulated paper orders. No real bets are placed. Live trading is disabled and locked.
              </div>
              <div className="flex justify-end pt-4 border-t border-border">
                <Button size="sm" onClick={() => handleSave('bot')}>
                  {savedSection === 'bot' ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save Bot Settings</>}
                </Button>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* 2. Market Filters */}
        <TabsContent value="filters">
          <Panel title="Market Filters">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Time Window Start (seconds before race start) — when to begin scanning">
                  <Input type="number" value={local.defaultTimeWindowStartSeconds} onChange={e => update('defaultTimeWindowStartSeconds', +e.target.value)} />
                </Field>
                <Field label="Time Window End (seconds before race start) — when to stop scanning">
                  <Input type="number" value={local.defaultTimeWindowEndSeconds} onChange={e => update('defaultTimeWindowEndSeconds', +e.target.value)} />
                </Field>
                <Field label="Minimum Liquidity ($) — minimum available size at best price">
                  <Input type="number" value={local.minimumLiquidity} onChange={e => update('minimumLiquidity', +e.target.value)} />
                </Field>
                <Field label="Minimum Traded Volume ($) — minimum total matched volume">
                  <Input type="number" value={local.minimumTradedVolume} onChange={e => update('minimumTradedVolume', +e.target.value)} />
                </Field>
              </div>
              <div className="space-y-3 pt-3 border-t border-border">
                <ToggleRow label="Allow In-Play Trading — allow betting after race has started" checked={local.allowInPlay} onChange={v => update('allowInPlay', v)} />
                <ToggleRow label="Favourites Enabled — scan favourite runners" checked={local.favouriteSideEnabled} onChange={v => update('favouriteSideEnabled', v)} />
                <ToggleRow label="Outsiders Enabled — scan outsider runners" checked={local.outsiderSideEnabled} onChange={v => update('outsiderSideEnabled', v)} />
              </div>
              <div className="flex justify-end pt-4 border-t border-border">
                <Button size="sm" onClick={() => handleSave('filters')}>
                  {savedSection === 'filters' ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save Market Filters</>}
                </Button>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* 3. Opportunity Rules — WIN/PLACE/H2H thresholds */}
        <TabsContent value="rules">
          <Panel title="Opportunity Rules — Market-Type Thresholds">
            <div className="p-4">
              <MarketTypeThresholds />
            </div>
          </Panel>
        </TabsContent>

        {/* 4. Risk Management */}
        <TabsContent value="risk">
          <Panel title="Risk Management">
            <div className="p-4 space-y-4">
              <div className="bg-chart-4/10 border border-chart-4/30 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-chart-4 shrink-0 mt-0.5" />
                <span>These settings control financial safety limits. Changing them affects how much the bot can stake and lose in paper trading.</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Paper Bankroll ($)"><Input type="number" value={local.paperBankroll || local.bankroll} onChange={e => update('paperBankroll', +e.target.value)} /></Field>
                <Field label="Base Stake ($)"><Input type="number" value={local.baseStake} onChange={e => update('baseStake', +e.target.value)} /></Field>
                <Field label="Max Stake ($)"><Input type="number" value={local.maxStake} onChange={e => update('maxStake', +e.target.value)} /></Field>
                <Field label="Max Stake % of Bankroll"><Input type="number" value={local.maxStakePercent} onChange={e => update('maxStakePercent', +e.target.value)} /></Field>
                <Field label="Max Lay Liability ($)"><Input type="number" value={local.maxLayLiability || 1500} onChange={e => update('maxLayLiability', +e.target.value)} /></Field>
                <Field label="Daily Loss Limit ($)"><Input type="number" value={local.dailyLossLimit} onChange={e => update('dailyLossLimit', +e.target.value)} /></Field>
                <Field label="Weekly Loss Limit ($)"><Input type="number" value={local.weeklyLossLimit || local.dailyLossLimit * 5} onChange={e => update('weeklyLossLimit', +e.target.value)} /></Field>
                <Field label="Max Market Exposure ($)"><Input type="number" value={local.maxMarketExposure} onChange={e => update('maxMarketExposure', +e.target.value)} /></Field>
                <Field label="Max Open Orders"><Input type="number" value={local.maxOpenOrders} onChange={e => update('maxOpenOrders', +e.target.value)} /></Field>
                <Field label="Max Unmatched Orders"><Input type="number" value={local.maxUnmatchedOrders || local.maxOpenOrders} onChange={e => update('maxUnmatchedOrders', +e.target.value)} /></Field>
                <Field label="Max Trades Per Market"><Input type="number" value={local.maxTradesPerMarket} onChange={e => update('maxTradesPerMarket', +e.target.value)} /></Field>
                <Field label="Max Trades Per Runner"><Input type="number" value={local.maxTradesPerRunner || 1} onChange={e => update('maxTradesPerRunner', +e.target.value)} /></Field>
                <Field label="Max Trades Per Day"><Input type="number" value={local.maxTradesPerDay} onChange={e => update('maxTradesPerDay', +e.target.value)} /></Field>
              </div>
              <div className="space-y-3 pt-3 border-t border-border">
                <ToggleRow label="Allow Hedging — allow conflicting BACK+LAY positions on same selection" checked={local.allowHedging || false} onChange={v => update('allowHedging', v)} />
                <ToggleRow label="Risk Limits Disabled — bypass all risk checks (TESTING ONLY)" checked={local.riskLimitsDisabled || false} onChange={v => update('riskLimitsDisabled', v)} />
              </div>
              <div className="flex justify-end pt-4 border-t border-border">
                <Button size="sm" onClick={() => handleSave('risk')}>
                  {savedSection === 'risk' ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save Risk Settings</>}
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title="Commission Model" className="mt-5">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Default Commission Rate (%)"><Input type="number" step="0.1" value={(local.defaultCommissionRate || 0.05) * 100} onChange={e => update('defaultCommissionRate', +e.target.value / 100)} /></Field>
                <Field label="Manual Override (%)"><Input type="number" step="0.1" value={(local.manualCommissionRate || 0) * 100} placeholder="Leave empty for no override" onChange={e => update('manualCommissionRate', e.target.value ? +e.target.value / 100 : null)} /></Field>
                <Field label="Source"><div className="pt-2 text-xs text-muted-foreground">{local.manualCommissionRate ? 'Manual Override' : local.useMarketBaseRate ? 'Market Base Rate' : 'Default Fallback'}</div></Field>
              </div>
              <ToggleRow label="Use Market Base Rate where available" checked={local.useMarketBaseRate !== false} onChange={v => update('useMarketBaseRate', v)} />
              <div className="flex justify-end pt-4 border-t border-border">
                <Button size="sm" onClick={() => handleSave('commission')}>
                  {savedSection === 'commission' ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save Commission</>}
                </Button>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* 5. AI & Research */}
        <TabsContent value="ai">
          <FeatherlessSettings
            settings={featherlessSettings}
            onSave={(newSettings) => {
              updateFeatherlessSettings(newSettings);
              addAuditLog('Featherless AI Settings Updated', 'settings', 'info', `Featherless AI ${newSettings.enabled ? 'enabled' : 'disabled'}, model: ${newSettings.modelName}`);
            }}
          />
        </TabsContent>

        {/* 6. Betfair */}
        <TabsContent value="betfair">
          <Panel title="Betfair Connection Status">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatusField label="API Connected" value={apiConnected ? 'Yes' : 'No'} ok={apiConnected} />
                <StatusField label="Login Status" value={betfairConnection.loginStatus} ok={betfairConnection.loginStatus === 'connected'} />
                <StatusField label="Stream Status" value={betfairConnection.streamConnectionStatus} ok={betfairConnection.streamConnectionStatus === 'connected'} />
                <StatusField label="Market Catalogue" value={apiConnected ? 'Available' : 'Not Available'} ok={apiConnected} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-border">
                <StatusField label="Last Market Sync" value={betfairConnection.lastMarketSyncTime ? new Date(betfairConnection.lastMarketSyncTime).toLocaleTimeString('en-AU') : 'Never'} ok={!!betfairConnection.lastMarketSyncTime} />
                <StatusField label="Data Freshness" value={betfairConnection.dataFresh ? 'Fresh' : 'Stale'} ok={betfairConnection.dataFresh} />
                <Field label="Data Freshness Limit (seconds)"><Input type="number" value={betfairConnection.dataFreshnessLimit} onChange={e => updateBetfairConnection({ dataFreshnessLimit: +e.target.value })} /></Field>
              </div>
              <div className="flex gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testingConnection}>
                  {testingConnection ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Testing...</> : 'Test Connection'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { if (window.confirm('Disconnect from Betfair?')) disconnectBetfair(); }} disabled={!apiConnected}>
                  Disconnect
                </Button>
              </div>
              {testResults && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-3 border-t border-border">
                  <TestResult label="Login/Session" passed={testResults.loginValid} />
                  <TestResult label="App Key" passed={testResults.appKeyPresent} />
                  <TestResult label="Market Data" passed={testResults.marketDataAccess} />
                  <TestResult label="Account Funds" passed={testResults.accountFundsAvailable} />
                  <TestResult label="Current Orders" passed={testResults.currentOrdersAvailable} />
                  <TestResult label="Stream" passed={testResults.streamAvailable} />
                </div>
              )}
            </div>
          </Panel>
          <BetfairConnection />
        </TabsContent>

        {/* 7. Settlement */}
        <TabsContent value="settlement">
          <Panel title="Settlement Configuration">
            <div className="p-4 space-y-4">
              <div className="bg-chart-1/10 border border-chart-1/30 rounded-lg p-3 text-xs text-muted-foreground">
                <span className="text-chart-1 font-bold">Real Settlement Only:</span> Settlement uses real Betfair stream results. No random or simulated settlement. When a market closes, the stream provides winner and placed runner data, which is used to settle paper orders.
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-sm">Result Unknown Handling</span>
                  <StatusBadge status="warning">Awaiting Result — Never Guessed</StatusBadge>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-sm">Random Settlement</span>
                  <StatusBadge status="danger">DISABLED</StatusBadge>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-sm">Settlement Source</span>
                  <StatusBadge status="ok">Betfair Stream</StatusBadge>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                <StatusField label="Settled" value={paperOrders.filter(o => o.status === 'settled').length} ok={true} />
                <StatusField label="Awaiting Result" value={paperOrders.filter(o => o.status === 'awaiting_result').length} ok={false} />
                <StatusField label="Pending" value={paperOrders.filter(o => ['matched', 'partially_matched'].includes(o.status)).length} ok={true} />
                <StatusField label="Voided" value={paperOrders.filter(o => o.voided).length} ok={true} />
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* 8. Debug */}
        <TabsContent value="debug">
          <Panel title="Debug & Maintenance">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button variant="outline" size="sm" onClick={handleExportCycles} disabled={botCycles.length === 0} className="justify-start">
                  <FileDown className="h-4 w-4 mr-2" /> Export Bot Cycles ({botCycles.length})
                </Button>
                <Button variant="outline" size="sm" onClick={resetDailyStats} className="justify-start">
                  <RefreshCw className="h-4 w-4 mr-2" /> Reset Daily Stats
                </Button>
                <Button variant="outline" size="sm" onClick={clearBotCycles} className="justify-start">
                  <Trash2 className="h-4 w-4 mr-2" /> Clear Decision Logs
                </Button>
                <Button variant="outline" size="sm" onClick={clearLogs} className="justify-start">
                  <Trash2 className="h-4 w-4 mr-2" /> Clear Audit Logs
                </Button>
              </div>
              <div className="pt-3 border-t border-border space-y-2">
                <Link to="/wiring-audit">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Network className="h-4 w-4 mr-2" /> Open Full Wiring Audit
                  </Button>
                </Link>
                <Link to="/">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FlaskConical className="h-4 w-4 mr-2" /> Go to Bot Control Centre (Run OpenAI Search Test)
                  </Button>
                </Link>
              </div>
              <div className="pt-3 border-t border-border">
                <Button variant="destructive" size="sm" onClick={() => {
                  if (window.confirm('This will permanently delete ALL paper orders, signals, bot cycles, and reset bankroll. Continue?')) {
                    resetAllPaperTrading();
                  }
                }}>
                  <Trash2 className="h-4 w-4 mr-1" /> Reset All Paper Trading Data
                </Button>
              </div>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} disabled={label.includes('DISABLED')} />
    </div>
  );
}

function StatusField({ label, value, ok }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="pt-1"><StatusBadge status={ok ? 'ok' : 'warning'}>{String(value)}</StatusBadge></div>
    </div>
  );
}

function TestResult({ label, passed }) {
  return (
    <div className={`flex items-center gap-2 text-xs p-2 rounded ${passed ? 'bg-chart-1/10 text-chart-1' : 'bg-chart-5/10 text-chart-5'}`}>
      {passed ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}: {passed ? '✓' : '✗'}
    </div>
  );
}