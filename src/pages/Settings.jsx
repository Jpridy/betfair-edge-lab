import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Save, Download, CheckCircle2, ChevronDown, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import BetfairConnection from '@/components/settings/BetfairConnection';
import ResetAppData from '@/components/settings/ResetAppData';
import EffectiveSettingsTable from '@/components/settings/EffectiveSettingsTable';
import { PAPER_VALIDATION_PRESET } from '@/lib/paperValidationPreset';

function SettingsField({ label, explanation, children, unit, range, warning, locked = false }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        {locked && <span className="rounded bg-success/10 px-1.5 py-0.5 text-[9px] font-semibold text-success">LOCKED SAFE</span>}
      </div>
      {explanation && <p className="text-[11px] leading-snug text-muted-foreground">{explanation}</p>}
      <div className="flex items-center gap-2">
        {children}
        {unit && <span className="shrink-0 text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {range && <p className="text-[10px] text-muted-foreground/70">Allowed: {range}</p>}
      {warning && <p className="flex items-center gap-1 text-[10px] text-warning"><AlertTriangle className="h-3 w-3" />{warning}</p>}
    </div>
  );
}

function SettingsGroup({ title, description, children, defaultOpen = true }) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Panel>
        <CollapsibleTrigger className="flex w-full items-center justify-between border-b border-border-subtle px-4 py-3 text-left hover:bg-hover/50">
          <div>
            <h3 className="text-sm font-heading font-semibold text-foreground">{title}</h3>
            {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 p-4">{children}</div>
        </CollapsibleContent>
      </Panel>
    </Collapsible>
  );
}

const asNumber = event => Number(event.target.value);
const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

const MARKET_FIELDS = [
  ['MinOdds', 'Minimum odds', 0.1],
  ['MaxOdds', 'Maximum odds', 0.1],
  ['MinLiquidity', 'Minimum liquidity', 1],
  ['MaxSpreadTicks', 'Maximum spread', 1],
  ['MinEdge', 'Minimum commission-adjusted edge', 0.1],
  ['MinROI', 'Minimum expected ROI', 0.1],
];

function WinThresholdEditor({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {MARKET_FIELDS.map(([suffix, label, step]) => {
        const key = `win${suffix}`;
        const unit = suffix.includes('Liquidity') ? 'AUD' : suffix.includes('Odds') ? 'odds' : suffix.includes('Spread') ? 'ticks' : '%';
        return (
          <SettingsField key={key} label={label} explanation="Used directly by the WIN opportunity engine and final order checks." unit={unit}>
            <Input type="number" step={step} value={value[key] ?? ''} onChange={event => onChange(key, asNumber(event))} />
          </SettingsField>
        );
      })}
    </div>
  );
}

export default function Settings() {
  const {
    settings,
    updateSettings,
    botSettings,
    updateBotSettings,
    featherlessSettings,
    updateFeatherlessSettings,
    effectiveSettings,
    addAuditLog,
  } = useApp();

  const [appDraft, setAppDraft] = useState(settings);
  const [botDraft, setBotDraft] = useState(botSettings);
  const [modelDraft, setModelDraft] = useState(featherlessSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => setAppDraft(settings), [settings]);
  useEffect(() => setBotDraft(botSettings), [botSettings]);
  useEffect(() => setModelDraft(featherlessSettings), [featherlessSettings]);

  const updateApp = (key, value) => setAppDraft(previous => ({ ...previous, [key]: value }));
  const updateBot = (key, value) => setBotDraft(previous => ({ ...previous, [key]: value }));
  const updateModel = (key, value) => setModelDraft(previous => ({ ...previous, [key]: value }));

  const hasChanges = changed(appDraft, settings) || changed(botDraft, botSettings) || changed(modelDraft, featherlessSettings);
  const validationErrors = useMemo(() => {
    const errors = [];
    if (!(appDraft.paperBankroll > 0)) errors.push('Paper bankroll must be greater than zero.');
    if (!(appDraft.dataFreshnessLimit >= 5 && appDraft.dataFreshnessLimit <= 300)) errors.push('Data freshness limit must be between 5 and 300 seconds.');
    if (!(appDraft.defaultTimeWindowStartSeconds > appDraft.defaultTimeWindowEndSeconds)) errors.push('The scan window must open before it closes.');
    if (!(appDraft.maxStakePercent > 0 && appDraft.maxStakePercent <= 5)) errors.push('Maximum stake percent must be between 0 and 5%.');
    if (!(modelDraft.kellyMultiplier >= 0 && modelDraft.kellyMultiplier <= 1)) errors.push('Kelly multiplier must be between 0 and 1.');
    if (!(modelDraft.winMinOdds > 1 && modelDraft.winMaxOdds > modelDraft.winMinOdds)) errors.push('WIN odds range is invalid.');
    return errors;
  }, [appDraft, modelDraft]);

  const handleApply = () => {
    if (validationErrors.length) return;
    updateSettings(appDraft);
    updateBotSettings(botDraft);
    updateFeatherlessSettings(modelDraft);
    addAuditLog('Settings Applied', 'settings', 'info', 'App, bot, model, staking and risk settings applied together from one draft.');
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const handleDiscard = () => {
    setAppDraft(settings);
    setBotDraft(botSettings);
    setModelDraft(featherlessSettings);
  };

  const applyPreset = (preset) => {
    const source = PAPER_VALIDATION_PRESET;
    if (preset === 'safe') {
      setAppDraft({ ...source.appSettings });
      setBotDraft({ ...source.botSettings });
      setModelDraft({ ...source.featherlessSettings });
      return;
    }
    setAppDraft({ ...source.appSettings, maxStake: 10, maxStakePercent: 0.1, maxOpenOrders: 3 });
    setBotDraft({ ...source.botSettings });
    setModelDraft({ ...source.featherlessSettings, winMinEdge: 4, winMinROI: 3, minConfidence: 70, kellyMultiplier: 0.05 });
  };

  const handleExport = () => {
    const payload = JSON.stringify({ appSettings: appDraft, botSettings: botDraft, featherlessSettings: modelDraft }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'betfair-edge-lab-settings.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-label text-muted-foreground">Settings</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">Paper-only configuration</span>
              <span className="text-muted-foreground">•</span>
              <span className="flex items-center gap-1 font-semibold text-success"><ShieldCheck className="h-3.5 w-3.5" />Live orders locked</span>
              {hasChanges && <><span className="text-muted-foreground">•</span><span className="font-semibold text-info">Unsaved changes</span></>}
            </div>
            {validationErrors.length > 0 && <p className="mt-1 text-xs text-danger">{validationErrors[0]}</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleDiscard} disabled={!hasChanges}><RotateCcw className="h-3.5 w-3.5" />Discard</Button>
            <Button size="sm" variant="outline" onClick={handleExport}><Download className="h-3.5 w-3.5" />Export</Button>
            <Button size="sm" onClick={handleApply} disabled={!hasChanges || validationErrors.length > 0}>
              {saved ? <><CheckCircle2 className="h-3.5 w-3.5" />Applied</> : <><Save className="h-3.5 w-3.5" />Apply Changes</>}
            </Button>
          </div>
        </div>
      </Panel>

      <BetfairConnection />

      <Panel title="Recommended Preset" subtitle="Start with a safe paper configuration; changes remain drafts until Apply Changes is pressed">
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
          <Button variant="outline" onClick={() => applyPreset('safe')} className="h-auto justify-start py-3">
            <div className="text-left"><div className="text-sm font-semibold">Safe Paper Validation</div><div className="text-[11px] text-muted-foreground">Recommended baseline for clean data collection.</div></div>
          </Button>
          <Button variant="outline" onClick={() => applyPreset('conservative')} className="h-auto justify-start py-3">
            <div className="text-left"><div className="text-sm font-semibold">Extra Conservative</div><div className="text-[11px] text-muted-foreground">Fewer bets, smaller stakes and stronger value requirements.</div></div>
          </Button>
        </div>
      </Panel>

      <SettingsGroup title="General" description="Paper bankroll, commission and data freshness">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SettingsField label="Paper bankroll" explanation="Starting balance used for paper accounting." unit="AUD"><Input type="number" value={appDraft.paperBankroll ?? appDraft.bankroll ?? 0} onChange={event => updateApp('paperBankroll', asNumber(event))} /></SettingsField>
          <SettingsField label="Commission source" explanation="Prefer the market base rate, then use the fallback rate."><Select value={appDraft.useMarketBaseRate !== false ? 'market' : 'default'} onValueChange={value => updateApp('useMarketBaseRate', value === 'market')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="market">Market Base Rate</SelectItem><SelectItem value="default">Default Fallback</SelectItem></SelectContent></Select></SettingsField>
          <SettingsField label="Default commission" explanation="Fallback when Betfair does not supply a market rate." unit="%"><Input type="number" step="0.1" value={(appDraft.defaultCommissionRate ?? 0.08) * 100} onChange={event => updateApp('defaultCommissionRate', asNumber(event) / 100)} /></SettingsField>
          <SettingsField label="Data freshness limit" explanation="Older executable prices are blocked as stale." unit="seconds" range="5–300"><Input type="number" value={appDraft.dataFreshnessLimit ?? 30} onChange={event => updateApp('dataFreshnessLimit', asNumber(event))} /></SettingsField>
          <SettingsField label="Paper-only mode" explanation="Real Betfair order submission is disabled system-wide." locked><Switch checked disabled /></SettingsField>
          <SettingsField label="In-play betting" explanation="In-play order creation remains disabled." locked><Switch checked={false} disabled /></SettingsField>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Bot" description="Scan timing and automatic stop behaviour">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SettingsField label="Bot enabled" explanation="Allows the paper bot to start."><Switch checked={botDraft.botEnabled === true} onCheckedChange={value => updateBot('botEnabled', value)} /></SettingsField>
          <SettingsField label="Scan interval" explanation="Time between paper scans." unit="seconds" range="5–120"><Input type="number" value={botDraft.scanIntervalSeconds ?? 10} onChange={event => updateBot('scanIntervalSeconds', asNumber(event))} /></SettingsField>
          <SettingsField label="Window opens" explanation="Begin considering races this many seconds before the jump." unit="seconds"><Input type="number" value={appDraft.defaultTimeWindowStartSeconds ?? 300} onChange={event => updateApp('defaultTimeWindowStartSeconds', asNumber(event))} /></SettingsField>
          <SettingsField label="Window closes" explanation="Stop creating paper orders this many seconds before the jump." unit="seconds"><Input type="number" value={appDraft.defaultTimeWindowEndSeconds ?? 30} onChange={event => updateApp('defaultTimeWindowEndSeconds', asNumber(event))} /></SettingsField>
          <SettingsField label="Stop on API error" explanation="Stop rather than continue on unreliable data."><Switch checked={botDraft.stopOnApiError === true} onCheckedChange={value => updateBot('stopOnApiError', value)} /></SettingsField>
          <SettingsField label="Stop on daily loss" explanation="Stop when the daily limit is reached."><Switch checked={botDraft.stopOnDailyLoss === true} onCheckedChange={value => updateBot('stopOnDailyLoss', value)} /></SettingsField>
          <SettingsField label="Stop on drawdown" explanation="Stop when maximum drawdown is reached."><Switch checked={botDraft.stopOnMaxDrawdown === true} onCheckedChange={value => updateBot('stopOnMaxDrawdown', value)} /></SettingsField>
          <SettingsField label="Stop on losing streak" explanation="Stop after the configured consecutive-loss limit."><Switch checked={botDraft.stopOnLosingStreak === true} onCheckedChange={value => updateBot('stopOnLosingStreak', value)} /></SettingsField>
        </div>
      </SettingsGroup>

      <SettingsGroup title="WIN Market" description="Actual thresholds used by the opportunity engine">
        <WinThresholdEditor value={modelDraft} onChange={updateModel} />
        <SettingsField label="Minimum traded volume" explanation="Blocks thin markets before model analysis." unit="AUD"><Input type="number" value={appDraft.minimumTradedVolume ?? 5000} onChange={event => updateApp('minimumTradedVolume', asNumber(event))} /></SettingsField>
      </SettingsGroup>

      <SettingsGroup title="Staking" description="Stake sizing and hard caps">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SettingsField label="Staking mode" explanation="Fractional Kelly is recommended for paper validation."><Select value={modelDraft.stakingMode ?? 'fractional_kelly'} onValueChange={value => updateModel('stakingMode', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="flat">Flat stake</SelectItem><SelectItem value="fractional_kelly">Fractional Kelly</SelectItem></SelectContent></Select></SettingsField>
          <SettingsField label="Base stake" explanation="Used only by flat staking." unit="AUD"><Input type="number" value={appDraft.baseStake ?? 2} onChange={event => updateApp('baseStake', asNumber(event))} /></SettingsField>
          <SettingsField label="Kelly multiplier" explanation="0.10 means ten percent of full Kelly." range="0–1"><Input type="number" step="0.01" value={modelDraft.kellyMultiplier ?? 0.1} onChange={event => updateModel('kellyMultiplier', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum stake" explanation="Absolute stake cap." unit="AUD"><Input type="number" value={appDraft.maxStake ?? 25} onChange={event => updateApp('maxStake', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum stake percent" explanation="Stored and entered directly as a percentage. 0.25 means 0.25%, not 25%." unit="%" range="0.01–5"><Input type="number" step="0.01" value={appDraft.maxStakePercent ?? 0.25} onChange={event => updateApp('maxStakePercent', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum LAY liability" explanation="Maximum amount at risk on one LAY paper order." unit="AUD"><Input type="number" value={appDraft.maxLayLiability ?? 50} onChange={event => updateApp('maxLayLiability', asNumber(event))} /></SettingsField>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Risk" description="Portfolio stop limits" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SettingsField label="Daily loss limit" unit="AUD"><Input type="number" value={appDraft.dailyLossLimit ?? 100} onChange={event => updateApp('dailyLossLimit', asNumber(event))} /></SettingsField>
          <SettingsField label="Weekly loss limit" unit="AUD"><Input type="number" value={appDraft.weeklyLossLimit ?? 300} onChange={event => updateApp('weeklyLossLimit', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum drawdown" unit="AUD"><Input type="number" value={botDraft.maxDrawdownLimit ?? 300} onChange={event => updateBot('maxDrawdownLimit', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum losing streak"><Input type="number" value={botDraft.maxLosingStreak ?? 8} onChange={event => updateBot('maxLosingStreak', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum open exposure" unit="AUD"><Input type="number" value={appDraft.maxMarketExposure ?? 100} onChange={event => updateApp('maxMarketExposure', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum open orders"><Input type="number" value={appDraft.maxOpenOrders ?? 5} onChange={event => updateApp('maxOpenOrders', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum unmatched orders"><Input type="number" value={appDraft.maxUnmatchedOrders ?? 2} onChange={event => updateApp('maxUnmatchedOrders', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum trades per race"><Input type="number" value={appDraft.maxTradesPerMarket ?? 1} onChange={event => updateApp('maxTradesPerMarket', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum trades per runner"><Input type="number" value={appDraft.maxTradesPerRunner ?? 1} onChange={event => updateApp('maxTradesPerRunner', asNumber(event))} /></SettingsField>
          <SettingsField label="Maximum trades per day"><Input type="number" value={appDraft.maxTradesPerDay ?? 20} onChange={event => updateApp('maxTradesPerDay', asNumber(event))} /></SettingsField>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Model" description="AI probability source and strict fallback rules" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SettingsField label="Model enabled" explanation="When disabled, normal paper orders are blocked because deterministic fallback remains off."><Switch checked={modelDraft.enabled === true} onCheckedChange={value => updateModel('enabled', value)} /></SettingsField>
          <SettingsField label="Model name"><Input value={modelDraft.modelName ?? ''} onChange={event => updateModel('modelName', event.target.value)} /></SettingsField>
          <SettingsField label="Timeout" unit="seconds"><Input type="number" value={modelDraft.timeoutSeconds ?? 60} onChange={event => updateModel('timeoutSeconds', asNumber(event))} /></SettingsField>
          <SettingsField label="Minimum confidence" unit="%"><Input type="number" value={modelDraft.minConfidence ?? 65} onChange={event => updateModel('minConfidence', asNumber(event))} /></SettingsField>
          <SettingsField label="Require full race pack"><Switch checked={modelDraft.requireFullRacePack !== false} onCheckedChange={value => updateModel('requireFullRacePack', value)} /></SettingsField>
          <SettingsField label="Deterministic fallback" explanation="Locked off so market-only prices cannot pretend to be an independent edge." locked><Switch checked={false} disabled /></SettingsField>
          <SettingsField label="Favourite context"><Switch checked={modelDraft.favouriteContextEnabled !== false} onCheckedChange={value => updateModel('favouriteContextEnabled', value)} /></SettingsField>
          <SettingsField label="Maximum probability adjustment" unit="decimal" range="0–0.02"><Input type="number" step="0.001" value={modelDraft.favouriteContextMaxProbabilityAdjustment ?? 0.01} onChange={event => updateModel('favouriteContextMaxProbabilityAdjustment', asNumber(event))} /></SettingsField>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Self-Calibration" description="Research settings; champion changes still require manual approval" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SettingsField label="Enabled"><Switch checked={modelDraft.selfCalibrationEnabled === true} onCheckedChange={value => updateModel('selfCalibrationEnabled', value)} /></SettingsField>
          <SettingsField label="Objective"><Select value={modelDraft.calibrationObjectiveMode ?? 'STRIKE_RATE_WITH_PROFIT'} onValueChange={value => updateModel('calibrationObjectiveMode', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="STRIKE_RATE_WITH_PROFIT">Strike Rate with Profit</SelectItem><SelectItem value="BALANCED">Balanced</SelectItem><SelectItem value="PROFIT_MAXIMISING">Profit Maximising</SelectItem><SelectItem value="LOW_DRAWDOWN">Low Drawdown</SelectItem></SelectContent></Select></SettingsField>
          <SettingsField label="Minimum settled sample" warning="No profile is promoted below the required sample."><Input type="number" value={appDraft.minimumPaperTrades ?? 500} onChange={event => updateApp('minimumPaperTrades', asNumber(event))} /></SettingsField>
          <SettingsField label="Nightly calibration"><Switch checked={modelDraft.calibrationNightlyEnabled === true} onCheckedChange={value => updateModel('calibrationNightlyEnabled', value)} /></SettingsField>
          <SettingsField label="Auto-apply champion" explanation="Locked off. Proposed settings require manual review." locked><Switch checked={false} disabled /></SettingsField>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Advanced" description="Caching and diagnostics" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SettingsField label="AI result cache" unit="seconds"><Input type="number" value={modelDraft.aiResultCacheTtlSeconds ?? 60} onChange={event => updateModel('aiResultCacheTtlSeconds', asNumber(event))} /></SettingsField>
          <SettingsField label="Major price move" unit="ticks"><Input type="number" value={modelDraft.majorPriceMoveTicks ?? 3} onChange={event => updateModel('majorPriceMoveTicks', asNumber(event))} /></SettingsField>
          <SettingsField label="Debug scan mode" explanation="Diagnostic scans never create orders."><Switch checked={modelDraft.debugScanMode === true} onCheckedChange={value => updateModel('debugScanMode', value)} /></SettingsField>
        </div>
      </SettingsGroup>

      <Panel title="Effective Settings" subtitle={`${effectiveSettings.linkage.filter(item => item.linked && !item.validationError).length} linked settings; stored and enforced values shown below`}>
        <EffectiveSettingsTable />
      </Panel>
      <ResetAppData />
    </div>
  );
}
