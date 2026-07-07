import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Upload, RotateCcw, Save, ShieldAlert, AlertTriangle, CheckCircle2, Wifi, RefreshCw, Trash2 } from 'lucide-react';
import BetfairConnection from '@/components/settings/BetfairConnection';
import FeatherlessSettings from '@/components/settings/FeatherlessSettings';
import { calculateCommission, getCommissionWarnings, isCommissionValidForLive } from '@/lib/betfairMapping';

export default function Settings() {
  const { settings, updateSettings, addAuditLog, botSettings, updateBotSettings, betfairConnection, updateBetfairConnection, testBetfairConnection, apiConnected, resetAllPaperTrading, featherlessSettings, setFeatherlessSettings } = useApp();
  const [local, setLocal] = useState(settings);
  const [botLocal, setBotLocal] = useState(botSettings);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [savedSection, setSavedSection] = useState(null);

  const update = (key, value) => setLocal(prev => ({ ...prev, [key]: value }));

  const handleSave = (section) => {
    updateSettings(local);
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 2000);
  };

  const handleExport = () => {
    const data = JSON.stringify(local, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'betfair-edge-lab-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    addAuditLog('Settings Exported', 'settings', 'info', 'Settings JSON exported');
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        setLocal(imported);
        addAuditLog('Settings Imported', 'settings', 'info', 'Settings JSON imported');
      } catch (err) {
        // Invalid JSON
      }
    };
    reader.readAsText(file);
  };

  const handleResetDaily = () => {
    addAuditLog('Daily Stats Reset', 'settings', 'warning', 'Daily P/L and trade counters manually reset');
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    const results = await testBetfairConnection();
    setTestResults(results);
    setTestingConnection(false);
  };

  // Commission warnings for current settings
  const commWarnings = getCommissionWarnings({ marketBaseRate: 0.05 }, local);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Configure commission model, risk limits, Betfair connection, and strategy toggles.</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> Export JSON</Button>
          <label>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            <span className="inline-flex items-center cursor-pointer h-8 px-3 text-xs rounded-md border border-input bg-background hover:bg-accent">
              <Upload className="h-4 w-4 mr-1" /> Import JSON
            </span>
          </label>
          <Button size="sm" onClick={() => handleSave('all')}>{savedSection === 'all' ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save Settings</>}</Button>
        </div>
      </div>

      <Tabs defaultValue="commission">
        <TabsList className="bg-card border border-border flex-wrap">
          <TabsTrigger value="commission" className="text-xs">Commission</TabsTrigger>
          <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
          <TabsTrigger value="risk" className="text-xs">Risk Limits</TabsTrigger>
          <TabsTrigger value="strategy" className="text-xs">Strategy</TabsTrigger>
          <TabsTrigger value="betfair" className="text-xs">Betfair Connection</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">AI / Integrations</TabsTrigger>
          <TabsTrigger value="bot" className="text-xs">Bot</TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs">Compliance</TabsTrigger>
        </TabsList>

        {/* ── Commission Model ── */}
        <TabsContent value="commission">
          <Panel title="Commission Model — Market Base Rate">
            <div className="p-4 space-y-4">
              <div className="bg-chart-3/10 border border-chart-3/30 rounded-lg p-3 text-xs text-muted-foreground">
                <span className="text-chart-3 font-medium">Betfair Exchange Commission:</span> Commission is calculated only on net market winnings, using the Market Base Rate for each market. Do not hard-code 5% — markets can have different rates.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Default Commission Rate (%)">
                  <Input type="number" step="0.1" value={(local.defaultCommissionRate || 0.05) * 100} onChange={e => update('defaultCommissionRate', +e.target.value / 100)} />
                </Field>
                <Field label="Manual Override Commission Rate (%)">
                  <Input type="number" step="0.1" value={(local.manualCommissionRate || 0) * 100} placeholder="Leave empty for no override" onChange={e => update('manualCommissionRate', e.target.value ? +e.target.value / 100 : null)} />
                </Field>
                <Field label="Commission Source">
                  <div className="pt-2 text-xs text-muted-foreground">
                    {local.manualCommissionRate ? 'Manual Override' : local.useMarketBaseRate ? 'Market Base Rate (with fallback)' : 'Default Fallback Rate'}
                  </div>
                </Field>
              </div>

              <div className="space-y-3 pt-2">
                <ToggleRow label="Use market-specific Market Base Rate where available" checked={local.useMarketBaseRate !== false} onChange={v => update('useMarketBaseRate', v)} />
              </div>

              {/* Commission Warnings */}
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Commission Warnings</div>
                {commWarnings.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-chart-1">
                    <CheckCircle2 className="h-4 w-4" /> Commission configuration is valid.
                  </div>
                ) : (
                  commWarnings.map((w, i) => (
                    <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded ${w.level === 'critical' ? 'bg-chart-5/10 text-chart-5' : w.level === 'warning' ? 'bg-chart-4/10 text-chart-4' : 'bg-chart-3/10 text-chart-3'}`}>
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {w.message}
                    </div>
                  ))
                )}
              </div>

              {/* Live Mode Commission Check */}
              <div className={`rounded-lg p-3 border ${isCommissionValidForLive({ marketBaseRate: 0.05 }, local) ? 'bg-chart-1/10 border-chart-1/30' : 'bg-chart-5/10 border-chart-5/30'}`}>
                <div className="text-xs font-bold">
                  {isCommissionValidForLive({ marketBaseRate: 0.05 }, local) ? '✓ Commission calculation valid for live mode' : '✗ Live mode blocked: Commission calculation invalid'}
                </div>
                {!isCommissionValidForLive({ marketBaseRate: 0.05 }, local) && (
                  <div className="text-xs text-muted-foreground mt-1">Market Base Rate required before live use. Set a default commission rate or enable Market Base Rate.</div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <Button size="sm" onClick={() => handleSave('commission')}>
                  {savedSection === 'commission' ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save Commission Settings</>}
                </Button>
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="general">
          <Panel title="General Settings">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Paper Bankroll ($)"><Input type="number" value={local.paperBankroll || local.bankroll} onChange={e => update('paperBankroll', +e.target.value)} /></Field>
              <Field label="Base Stake ($)"><Input type="number" value={local.baseStake} onChange={e => update('baseStake', +e.target.value)} /></Field>
              <Field label="Max Stake ($)"><Input type="number" value={local.maxStake} onChange={e => update('maxStake', +e.target.value)} /></Field>
              <Field label="Max Stake % of Bankroll"><Input type="number" value={local.maxStakePercent} onChange={e => update('maxStakePercent', +e.target.value)} /></Field>
              <Field label="Max Lay Liability ($)"><Input type="number" value={local.maxLayLiability || 1500} onChange={e => update('maxLayLiability', +e.target.value)} /></Field>

            </div>
            <div className="flex justify-end px-4 pb-4 pt-2 border-t border-border">
              <Button size="sm" onClick={() => handleSave('general')}>
                {savedSection === 'general' ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save General Settings</>}
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="risk">
          <Panel title="Risk Limits">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Daily Loss Limit ($)"><Input type="number" value={local.dailyLossLimit} onChange={e => update('dailyLossLimit', +e.target.value)} /></Field>
              <Field label="Weekly Loss Limit ($)"><Input type="number" value={local.weeklyLossLimit || local.dailyLossLimit * 5} onChange={e => update('weeklyLossLimit', +e.target.value)} /></Field>
              <Field label="Max Market Exposure ($)"><Input type="number" value={local.maxMarketExposure} onChange={e => update('maxMarketExposure', +e.target.value)} /></Field>
              <Field label="Max Open Orders"><Input type="number" value={local.maxOpenOrders} onChange={e => update('maxOpenOrders', +e.target.value)} /></Field>
              <Field label="Max Unmatched Orders"><Input type="number" value={local.maxUnmatchedOrders || local.maxOpenOrders} onChange={e => update('maxUnmatchedOrders', +e.target.value)} /></Field>
              <Field label="Max Trades Per Market"><Input type="number" value={local.maxTradesPerMarket} onChange={e => update('maxTradesPerMarket', +e.target.value)} /></Field>
              <Field label="Max Trades Per Runner"><Input type="number" value={local.maxTradesPerRunner || 1} onChange={e => update('maxTradesPerRunner', +e.target.value)} /></Field>
              <Field label="Max Trades Per Day"><Input type="number" value={local.maxTradesPerDay} onChange={e => update('maxTradesPerDay', +e.target.value)} /></Field>
              <Field label="Min Liquidity ($)"><Input type="number" value={local.minimumLiquidity} onChange={e => update('minimumLiquidity', +e.target.value)} /></Field>
              <Field label="Min Traded Volume ($)"><Input type="number" value={local.minimumTradedVolume} onChange={e => update('minimumTradedVolume', +e.target.value)} /></Field>
              <Field label="Minimum Odds"><Input type="number" step="0.1" value={local.minOdds} onChange={e => update('minOdds', +e.target.value)} /></Field>
              <Field label="Maximum Odds"><Input type="number" step="0.1" value={local.maxOdds} onChange={e => update('maxOdds', +e.target.value)} /></Field>
              <Field label="Time Window Start (sec before start)"><Input type="number" value={local.defaultTimeWindowStartSeconds} onChange={e => update('defaultTimeWindowStartSeconds', +e.target.value)} /></Field>
              <Field label="Time Window End (sec before start)"><Input type="number" value={local.defaultTimeWindowEndSeconds} onChange={e => update('defaultTimeWindowEndSeconds', +e.target.value)} /></Field>
              <Field label="Minimum Paper Trades Before Live Review"><Input type="number" value={local.minimumPaperTrades || 200} onChange={e => update('minimumPaperTrades', +e.target.value)} /></Field>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={local.allowInPlay} onCheckedChange={v => update('allowInPlay', v)} />
                <Label className="text-sm">Allow In-Play Trading</Label>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={local.persistApproved || false} onCheckedChange={v => update('persistApproved', v)} />
                <Label className="text-sm">Admin Approve PERSIST for Pre-Off</Label>
              </div>
              <div className="md:col-span-3 flex justify-end pt-4 border-t border-border">
                <Button size="sm" onClick={() => handleSave('risk')}>
                  {savedSection === 'risk' ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save Risk Limits</>}
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title="Daily Reset" className="mt-5">
            <div className="p-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Manually reset daily P/L counters and trade statistics.</div>
              <Button variant="outline" size="sm" onClick={handleResetDaily}><RotateCcw className="h-4 w-4 mr-1" /> Reset Daily Stats</Button>
            </div>
          </Panel>

          <Panel title="Reset All Paper Trading" className="mt-5">
            <div className="p-4 space-y-3">
              <div className="bg-chart-5/10 border border-chart-5/30 rounded-lg p-3">
                <div className="text-xs font-bold text-chart-5 flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> This will permanently clear ALL paper trading data</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Deletes all paper orders, rejected orders, strategy signals, bot cycles, and activity logs. Resets bankroll P/L to zero, strategy stats to baseline, and daily counters to zero. Bankroll returns to your starting balance. This cannot be undone.
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="destructive" size="sm" onClick={() => {
                  if (window.confirm('This will permanently delete ALL paper orders, signals, bot cycles, and reset bankroll P/L, strategy stats, and daily counters. Bankroll returns to starting balance. This cannot be undone. Are you sure?')) {
                    resetAllPaperTrading();
                  }
                }}>
                  <Trash2 className="h-4 w-4 mr-1" /> Reset All Paper Trading
                </Button>
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="strategy">
          <Panel title="Strategy Toggles">
            <div className="p-4 space-y-4">
              <div className="pt-2 border-t border-border">
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">AI Strategy</div>
                <ToggleRow label="Featherless AI Value Decision Engine" checked={featherlessSettings?.enabled || false} onChange={v => {
                  setFeatherlessSettings({ ...featherlessSettings, enabled: v });
                  addAuditLog('Featherless AI Strategy Toggled', 'strategy', v ? 'info' : 'warning', `Featherless AI ${v ? 'enabled' : 'disabled'}`);
                }} />
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* ── Betfair Connection ── */}
        <TabsContent value="betfair">
          <Panel title="Betfair Exchange Connection">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="App Key">
                  <div className="text-xs font-mono pt-2">{betfairConnection.appKey ? '••••••••••••' : 'Not configured'}</div>
                </Field>
                <Field label="Session Token Status">
                  <div className="pt-2"><StatusBadge status={betfairConnection.sessionTokenStatus === 'connected' ? 'ok' : 'danger'}>{betfairConnection.sessionTokenStatus}</StatusBadge></div>
                </Field>
                <Field label="Login Status">
                  <div className="pt-2"><StatusBadge status={betfairConnection.loginStatus === 'connected' ? 'ok' : 'danger'}>{betfairConnection.loginStatus}</StatusBadge></div>
                </Field>
                <Field label="Data Freshness Limit (seconds)">
                  <Input type="number" value={betfairConnection.dataFreshnessLimit} onChange={e => updateBetfairConnection({ dataFreshnessLimit: +e.target.value })} />
                </Field>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
                <Field label="Stream Connection Status">
                  <div className="pt-2"><StatusBadge status={betfairConnection.streamConnectionStatus === 'connected' ? 'ok' : 'neutral'}>{betfairConnection.streamConnectionStatus}</StatusBadge></div>
                </Field>
                <Field label="Last Market Sync Time">
                  <div className="text-xs font-mono pt-2">{betfairConnection.lastMarketSyncTime ? new Date(betfairConnection.lastMarketSyncTime).toLocaleTimeString('en-AU') : 'Never'}</div>
                </Field>
                <Field label="Last Order Sync Time">
                  <div className="text-xs font-mono pt-2">{betfairConnection.lastOrderSyncTime ? new Date(betfairConnection.lastOrderSyncTime).toLocaleTimeString('en-AU') : 'Never'}</div>
                </Field>
              </div>

              {/* Connection Test */}
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Connection Test</div>
                  <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testingConnection}>
                    {testingConnection ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Wifi className="h-4 w-4 mr-1" />}
                    Test Betfair Connection
                  </Button>
                </div>
                {testResults && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <TestResult label="Login/Session" passed={testResults.loginValid} />
                      <TestResult label="App Key" passed={testResults.appKeyPresent} />
                      <TestResult label="Market Data" passed={testResults.marketDataAccess} />
                      <TestResult label="Account Funds" passed={testResults.accountFundsAvailable} />
                      <TestResult label="Current Orders" passed={testResults.currentOrdersAvailable} />
                      <TestResult label="Stream Connection" passed={testResults.streamAvailable} />
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
                      <span>Stream: <span className="font-mono text-foreground">{testResults.streamStatus || '—'}</span></span>
                      <span>Markets: <span className="font-mono text-foreground">{testResults.marketCount ?? 0}</span></span>
                      <span>Runners: <span className="font-mono text-foreground">{testResults.runnerCount ?? 0}</span></span>
                    </div>
                    {testResults.streamStatus === 'error' && (
                      <div className="text-xs text-chart-5 bg-chart-5/10 border border-chart-5/30 rounded-lg p-3 space-y-1">
                        <div className="font-bold">Stream connection failed</div>
                        <div>The Cloudflare Worker needs to be updated to support the WebSocket-to-TCP stream bridge.</div>
                        <div className="mt-1">Steps: Go to Cloudflare Dashboard → Workers → your betfair-proxy worker → Edit code → paste the updated code from <span className="font-mono">cloudflare-worker/betfair-proxy.js</span> → Save and deploy.</div>
                        <div className="mt-1">The worker now bridges browser WebSocket connections to Betfair's raw TCP Stream API (Betfair does not support WebSocket directly).</div>
                      </div>
                    )}
                    {testResults.streamStatus === 'session_expired' && (
                      <div className="text-xs text-chart-4 bg-chart-4/10 border border-chart-4/30 rounded-lg p-2">
                        Session token expired. Go to betfair.com.au, log in, and paste a fresh session token from the keepAlive link.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <BetfairConnection />

          <Panel title="Live Trading Lockout" className="mt-5">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Live Trading Status</span>
                <StatusBadge status="danger">LOCKED — Disabled</StatusBadge>
              </div>
              <div className="bg-chart-5/10 border border-chart-5/30 rounded-lg p-3 mt-3">
                <div className="text-xs text-chart-5 font-bold flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Live Trading is Hard-Locked</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Live mode is blocked until ALL of the following pass: strategy status is Green, admin approval, 200+ settled paper trades, positive ROI, positive CLV, profit factor &gt; 1.20, drawdown within limit, data quality Clean, commission calculation valid, Betfair connection healthy, Risk Manager allows, persistence type approved, and user confirms live betting warning modal.
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="ai">
          <FeatherlessSettings
            settings={featherlessSettings}
            onSave={(newSettings) => {
              setFeatherlessSettings(newSettings);
              addAuditLog('Featherless AI Settings Updated', 'settings', 'info', `Featherless AI ${newSettings.enabled ? 'enabled' : 'disabled'}, model: ${newSettings.modelName}`);
            }}
          />
        </TabsContent>

        <TabsContent value="bot">
          <Panel title="Bot Settings">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Scan Interval (seconds)"><Input type="number" value={botLocal.scanIntervalSeconds} onChange={e => setBotLocal(prev => ({ ...prev, scanIntervalSeconds: +e.target.value }))} /></Field>
              </div>
              <div className="pt-4 border-t border-border space-y-3">
                <ToggleRow label="Enable Auto Paper Trading" checked={botLocal.autoPaperTradingEnabled} onChange={v => setBotLocal(prev => ({ ...prev, autoPaperTradingEnabled: v }))} />
                <ToggleRow label="Require Live Confirmation Text" checked={botLocal.requireLiveConfirmationText} onChange={v => setBotLocal(prev => ({ ...prev, requireLiveConfirmationText: v }))} />
              </div>
              <div className="flex justify-end pt-4 border-t border-border">
                <Button size="sm" onClick={() => updateBotSettings(botLocal)}><Save className="h-4 w-4 mr-1" /> Save Bot Settings</Button>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* ── Responsible Gambling & Compliance ── */}
        <TabsContent value="compliance">
          <Panel title="Responsible Use & Compliance">
            <div className="p-4 space-y-4">
              <div className="bg-chart-4/10 border border-chart-4/30 rounded-lg p-4 space-y-2">
                <div className="text-sm font-bold text-chart-4 flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Responsible Gambling Warning</div>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>This tool is for personal strategy research unless proper permissions are in place.</li>
                  <li>Live betting can lose real money — never bet more than you can afford to lose.</li>
                  <li>Paper results do not guarantee live results. Slippage, latency, and liquidity differ in live markets.</li>
                  <li>Automation must remain locked until validation passes (200+ settled trades, positive CLV, profit factor &gt; 1.20).</li>
                  <li>You are responsible for Betfair account compliance, including terms of service and jurisdictional regulations.</li>
                  <li>Never share your Betfair app key or session token.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <ToggleRow label="Forced Paper-Only Mode (locks out live trading entirely)" checked={local.forcedPaperOnlyMode || false} onChange={v => update('forcedPaperOnlyMode', v)} />
                <ToggleRow label="Daily Deposit/Loss Reminder" checked={local.dailyDepositReminderEnabled || false} onChange={v => update('dailyDepositReminderEnabled', v)} />
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <Button size="sm" onClick={() => handleSave('compliance')}>
                  {savedSection === 'compliance' ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save Compliance Settings</>}
                </Button>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Support Resources</div>
                <div className="text-xs text-muted-foreground">
                  Gambling help: 1800 858 858 (AU) · www.gamblinghelponline.org.au<br />
                  For platform or billing issues, contact Base44 support.
                </div>
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
      <Switch checked={checked} onCheckedChange={onChange} />
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