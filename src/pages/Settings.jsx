import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Upload, RotateCcw, Save } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings, addAuditLog } = useApp();
  const [local, setLocal] = useState(settings);

  const update = (key, value) => setLocal(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    updateSettings(local);
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Configure all trading parameters, risk limits, and strategy toggles.</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> Export JSON</Button>
          <label>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            <span className="inline-flex items-center cursor-pointer h-8 px-3 text-xs rounded-md border border-input bg-background hover:bg-accent">
              <Upload className="h-4 w-4 mr-1" /> Import JSON
            </span>
          </label>
          <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Save Settings</Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
          <TabsTrigger value="risk" className="text-xs">Risk Limits</TabsTrigger>
          <TabsTrigger value="strategy" className="text-xs">Strategy</TabsTrigger>
          <TabsTrigger value="api" className="text-xs">API & Data</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Panel title="General Settings">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Commission Rate (%)"><Input type="number" step="0.1" value={local.commissionRate * 100} onChange={e => update('commissionRate', +e.target.value / 100)} /></Field>
              <Field label="Starting Bankroll ($)"><Input type="number" value={local.bankroll} onChange={e => update('bankroll', +e.target.value)} /></Field>
              <Field label="Base Stake ($)"><Input type="number" value={local.baseStake} onChange={e => update('baseStake', +e.target.value)} /></Field>
              <Field label="Max Stake ($)"><Input type="number" value={local.maxStake} onChange={e => update('maxStake', +e.target.value)} /></Field>
              <Field label="Max Stake % of Bankroll"><Input type="number" value={local.maxStakePercent} onChange={e => update('maxStakePercent', +e.target.value)} /></Field>
              <Field label="Jurisdiction">
                <Select value={local.selectedJurisdiction || 'AU'} onValueChange={v => update('selectedJurisdiction', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AU">Australia</SelectItem>
                    <SelectItem value="UK">United Kingdom</SelectItem>
                    <SelectItem value="ES">Spain</SelectItem>
                    <SelectItem value="IT">Italy</SelectItem>
                    <SelectItem value="RO">Romania</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="risk">
          <Panel title="Risk Limits">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Daily Loss Limit ($)"><Input type="number" value={local.dailyLossLimit} onChange={e => update('dailyLossLimit', +e.target.value)} /></Field>
              <Field label="Max Market Exposure ($)"><Input type="number" value={local.maxMarketExposure} onChange={e => update('maxMarketExposure', +e.target.value)} /></Field>
              <Field label="Max Open Orders"><Input type="number" value={local.maxOpenOrders} onChange={e => update('maxOpenOrders', +e.target.value)} /></Field>
              <Field label="Max Trades Per Market"><Input type="number" value={local.maxTradesPerMarket} onChange={e => update('maxTradesPerMarket', +e.target.value)} /></Field>
              <Field label="Max Trades Per Day"><Input type="number" value={local.maxTradesPerDay} onChange={e => update('maxTradesPerDay', +e.target.value)} /></Field>
              <Field label="Min Liquidity (£)"><Input type="number" value={local.minimumLiquidity} onChange={e => update('minimumLiquidity', +e.target.value)} /></Field>
              <Field label="Min Traded Volume (£)"><Input type="number" value={local.minimumTradedVolume} onChange={e => update('minimumTradedVolume', +e.target.value)} /></Field>
              <Field label="Minimum Odds"><Input type="number" step="0.1" value={local.minOdds} onChange={e => update('minOdds', +e.target.value)} /></Field>
              <Field label="Maximum Odds"><Input type="number" step="0.1" value={local.maxOdds} onChange={e => update('maxOdds', +e.target.value)} /></Field>
              <Field label="Time Window Start (sec before start)"><Input type="number" value={local.defaultTimeWindowStartSeconds} onChange={e => update('defaultTimeWindowStartSeconds', +e.target.value)} /></Field>
              <Field label="Time Window End (sec before start)"><Input type="number" value={local.defaultTimeWindowEndSeconds} onChange={e => update('defaultTimeWindowEndSeconds', +e.target.value)} /></Field>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={local.allowInPlay} onCheckedChange={v => update('allowInPlay', v)} />
                <Label className="text-sm">Allow In-Play Trading</Label>
              </div>
            </div>
          </Panel>

          <Panel title="Responsible Gambling" className="mt-5">
            <div className="p-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Manually reset daily P/L counters and trade statistics.</div>
              <Button variant="outline" size="sm" onClick={handleResetDaily}><RotateCcw className="h-4 w-4 mr-1" /> Reset Daily Stats</Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="strategy">
          <Panel title="Strategy Toggles">
            <div className="p-4 space-y-4">
              <ToggleRow label="Value Betting Strategy" checked={local.strategyValueBetEnabled} onChange={v => update('strategyValueBetEnabled', v)} />
              <ToggleRow label="Pre-Off Scalping Strategy" checked={local.strategyScalpingEnabled} onChange={v => update('strategyScalpingEnabled', v)} />
              <ToggleRow label="Favourite/Outsider Strategy" checked={local.strategyFavOutsiderEnabled} onChange={v => update('strategyFavOutsiderEnabled', v)} />
              <ToggleRow label="Cross-Market Watcher" checked={local.strategyCrossMarketEnabled} onChange={v => update('strategyCrossMarketEnabled', v)} />
              <div className="pt-4 border-t border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Side Toggles (Fav/Outsider)</div>
                <ToggleRow label="Favourite Side Enabled" checked={local.favouriteSideEnabled} onChange={v => update('favouriteSideEnabled', v)} />
                <ToggleRow label="Outsider Side Enabled" checked={local.outsiderSideEnabled} onChange={v => update('outsiderSideEnabled', v)} />
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="api">
          <Panel title="API & Data Settings">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="API Polling Interval (seconds)"><Input type="number" value={local.apiPollingInterval} onChange={e => update('apiPollingInterval', +e.target.value)} /></Field>
            </div>
          </Panel>

          <Panel title="Betfair API Connection" className="mt-5">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Connection Status</span>
                <StatusBadge status="warning">Not Connected (Demo Mode)</StatusBadge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credentials</span>
                <span className="text-xs text-muted-foreground">Stored as secrets (BETFAIR_USERNAME, BETFAIR_APP_KEY, etc.)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Live Trading</span>
                <StatusBadge status="danger">LOCKED — Disabled</StatusBadge>
              </div>
              <div className="bg-chart-4/10 border border-chart-4/30 rounded-lg p-3 mt-3">
                <div className="text-xs text-chart-4 font-bold">⚠ Live Trading is Disabled</div>
                <div className="text-xs text-muted-foreground mt-1">Live trading requires: confirmation text "ENABLE LIVE TRADING", all risk checks passing, and Betfair API credentials configured. This will be enabled in a future version only.</div>
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