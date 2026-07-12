import React, { useState, useEffect } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Save, CheckCircle2 } from 'lucide-react';
import InfoHint from '@/components/InfoHint';
import FeatherlessSettings from '@/components/settings/FeatherlessSettings';
import MarketTypeThresholds from '@/components/settings/MarketTypeThresholds';
import ResetAppData from '@/components/settings/ResetAppData';
import EffectiveSettingsTable from '@/components/settings/EffectiveSettingsTable';
import { PAPER_VALIDATION_PRESET } from '@/lib/paperValidationPreset';

export default function Settings() {
  const {
    settings, updateSettings, addAuditLog,
    botSettings, updateBotSettings,
    featherlessSettings, updateFeatherlessSettings,
  } = useApp();

  const [local, setLocal] = useState(settings);
  const [botLocal, setBotLocal] = useState(botSettings);
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

  const applyValidationPreset=()=>{updateSettings(PAPER_VALIDATION_PRESET.appSettings);updateBotSettings(PAPER_VALIDATION_PRESET.botSettings);updateFeatherlessSettings(PAPER_VALIDATION_PRESET.featherlessSettings);setLocal(PAPER_VALIDATION_PRESET.appSettings);setBotLocal(PAPER_VALIDATION_PRESET.botSettings);addAuditLog('Statistical Paper Validation Preset Applied','settings','info','Conservative paper-only validation preset applied.');};

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


  return (
    <div className="space-y-5">
      {/* Settings toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Configure bot behaviour, market filters, opportunity thresholds, risk limits, commission, and AI research.</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={applyValidationPreset}>Apply Validation Preset</Button>
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
                <ToggleRow label="Live Trading — DISABLED (forced off)" checked={false} onChange={() => {}} />
              </div>
              <InfoHint tone="info" className="text-[11px]">
                Paper Mode — the bot only creates simulated paper orders. No real bets are placed. Live trading is disabled and locked.
              </InfoHint>
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
              <InfoHint tone="warning" className="text-[11px]">
                These settings control financial safety limits. Changing them affects how much the bot can stake and lose in paper trading.
              </InfoHint>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Paper Bankroll ($)"><Input type="number" value={local.paperBankroll??local.bankroll} onChange={e => update('paperBankroll', +e.target.value)} /></Field>
                <Field label="Base Stake ($)"><Input type="number" value={local.baseStake} onChange={e => update('baseStake', +e.target.value)} /></Field>
                <Field label="Max Stake ($)"><Input type="number" value={local.maxStake} onChange={e => update('maxStake', +e.target.value)} /></Field>
                <Field label="Max Stake % of Bankroll"><Input type="number" value={local.maxStakePercent} onChange={e => update('maxStakePercent', +e.target.value)} /></Field>
                <Field label="Max Lay Liability ($)"><Input type="number" value={local.maxLayLiability??1500} onChange={e => update('maxLayLiability', +e.target.value)} /></Field>
                <Field label="Daily Loss Limit ($)"><Input type="number" value={local.dailyLossLimit} onChange={e => update('dailyLossLimit', +e.target.value)} /></Field>
                <Field label="Weekly Loss Limit ($)"><Input type="number" value={local.weeklyLossLimit??local.dailyLossLimit*5} onChange={e => update('weeklyLossLimit', +e.target.value)} /></Field>
                <Field label="Max Market Exposure ($)"><Input type="number" value={local.maxMarketExposure} onChange={e => update('maxMarketExposure', +e.target.value)} /></Field>
                <Field label="Max Open Orders"><Input type="number" value={local.maxOpenOrders} onChange={e => update('maxOpenOrders', +e.target.value)} /></Field>
                <Field label="Max Unmatched Orders"><Input type="number" value={local.maxUnmatchedOrders??local.maxOpenOrders} onChange={e => update('maxUnmatchedOrders', +e.target.value)} /></Field>
                <Field label="Max Trades Per Market"><Input type="number" value={local.maxTradesPerMarket} onChange={e => update('maxTradesPerMarket', +e.target.value)} /></Field>
                <Field label="Max Trades Per Runner"><Input type="number" value={local.maxTradesPerRunner??1} onChange={e => update('maxTradesPerRunner', +e.target.value)} /></Field>
                <Field label="Max Trades Per Day"><Input type="number" value={local.maxTradesPerDay} onChange={e => update('maxTradesPerDay', +e.target.value)} /></Field>
              </div>
              <div className="space-y-3 pt-3 border-t border-border">
                <ToggleRow label="Allow Hedging — allow conflicting BACK+LAY positions on same selection" checked={local.allowHedging || false} onChange={v => update('allowHedging', v)} />
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
                <Field label="Default Commission Rate (%)"><Input type="number" step="0.1" value={(local.defaultCommissionRate??.05)*100} onChange={e => update('defaultCommissionRate', +e.target.value / 100)} /></Field>
                <Field label="Manual Override (%)"><Input type="number" step="0.1" value={(local.manualCommissionRate??0)*100} placeholder="Leave empty for no override" onChange={e => update('manualCommissionRate', e.target.value ? +e.target.value / 100 : null)} /></Field>
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

      </Tabs>
      <Panel title="Effective Settings" subtitle="Stored values, enforced values, units and linked engine consumers"><EffectiveSettingsTable /></Panel>
      <ResetAppData />
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