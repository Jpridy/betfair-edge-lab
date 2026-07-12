import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Save, Download, CheckCircle2, ChevronDown, RotateCcw, AlertTriangle } from 'lucide-react';
import FeatherlessSettings from '@/components/settings/FeatherlessSettings';
import MarketTypeThresholds from '@/components/settings/MarketTypeThresholds';
import ResetAppData from '@/components/settings/ResetAppData';
import EffectiveSettingsTable from '@/components/settings/EffectiveSettingsTable';
import { PAPER_VALIDATION_PRESET } from '@/lib/paperValidationPreset';

function SettingsField({ label, explanation, children, unit, range, warning }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      {explanation && <p className="text-[10px] text-muted-foreground leading-snug">{explanation}</p>}
      <div className="flex items-center gap-2">
        {children}
        {unit && <span className="text-[10px] text-muted-foreground shrink-0">{unit}</span>}
      </div>
      {range && <p className="text-[10px] text-muted-foreground/70">Range: {range}</p>}
      {warning && <p className="text-[10px] text-warning flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{warning}</p>}
    </div>
  );
}

function SettingsGroup({ title, description, children, defaultOpen = true }) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Panel>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 border-b border-border-subtle hover:bg-hover/50">
          <div className="text-left">
            <h3 className="text-sm font-heading font-semibold text-foreground">{title}</h3>
            {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 space-y-4">{children}</div>
        </CollapsibleContent>
      </Panel>
    </Collapsible>
  );
}

export default function Settings() {
  const {
    settings, updateSettings, addAuditLog,
    botSettings, updateBotSettings,
    featherlessSettings, updateFeatherlessSettings,
  } = useApp();

  const [local, setLocal] = useState(settings);
  const [botLocal, setBotLocal] = useState(botSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocal(settings); }, [settings]);
  useEffect(() => { setBotLocal(botSettings); }, [botSettings]);

  const update = (key, value) => setLocal(prev => ({ ...prev, [key]: value }));
  const updateBot = (key, value) => setBotLocal(prev => ({ ...prev, [key]: value }));

  const hasChanges = JSON.stringify(local) !== JSON.stringify(settings) || JSON.stringify(botLocal) !== JSON.stringify(botSettings);

  const handleApply = () => {
    updateSettings(local);
    updateBotSettings(botLocal);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDiscard = () => {
    setLocal(settings);
    setBotLocal(botSettings);
  };

  const applyPreset = (preset) => {
    if (preset === 'safe') {
      setLocal(PAPER_VALIDATION_PRESET.appSettings);
      setBotLocal(PAPER_VALIDATION_PRESET.botSettings);
    } else if (preset === 'balanced') {
      setLocal({ ...PAPER_VALIDATION_PRESET.appSettings, minOdds: 1.8, maxOdds: 12, baseStake: 3 });
      setBotLocal({ ...PAPER_VALIDATION_PRESET.botSettings });
    }
  };

  const handleExport = () => {
    const data = JSON.stringify({ appSettings: local, botSettings: botLocal, featherlessSettings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'betfair-edge-lab-settings.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* A. Settings Summary */}
      <Panel>
        <div className="flex items-center justify-between p-4 flex-wrap gap-3">
          <div className="space-y-1">
            <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">Settings Summary</div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">Preset:</span>
              <span className="font-semibold text-foreground">Safe Paper Validation</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-warning font-semibold">Paper-Only Locked</span>
              {hasChanges && <><span className="text-muted-foreground">·</span><span className="text-info font-semibold">Unsaved changes</span></>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleDiscard} disabled={!hasChanges}><RotateCcw className="h-3.5 w-3.5" /> Discard</Button>
            <Button size="sm" variant="outline" onClick={handleExport}><Download className="h-3.5 w-3.5" /> Export</Button>
            <Button size="sm" onClick={handleApply} disabled={!hasChanges}>
              {saved ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</> : <><Save className="h-3.5 w-3.5" /> Apply Changes</>}
            </Button>
          </div>
        </div>
      </Panel>

      {/* B. Quick Preset */}
      <Panel title="Quick Preset" subtitle="Choose a preset configuration">
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button variant="outline" onClick={() => applyPreset('safe')} className="justify-start h-auto py-3">
            <div className="text-left">
              <div className="text-sm font-semibold">Safe Paper Validation</div>
              <div className="text-[10px] text-muted-foreground">Conservative thresholds, minimal risk</div>
            </div>
          </Button>
          <Button variant="outline" onClick={() => applyPreset('balanced')} className="justify-start h-auto py-3">
            <div className="text-left">
              <div className="text-sm font-semibold">Balanced Paper Testing</div>
              <div className="text-[10px] text-muted-foreground">Moderate thresholds, more opportunities</div>
            </div>
          </Button>
          <Button variant="outline" disabled className="justify-start h-auto py-3">
            <div className="text-left">
              <div className="text-sm font-semibold">Custom</div>
              <div className="text-[10px] text-muted-foreground">Manually configured</div>
            </div>
          </Button>
        </div>
      </Panel>

      {/* C. General */}
      <SettingsGroup title="General" description="Bankroll, commission, and data freshness">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingsField label="Paper Bankroll" explanation="Starting balance for paper trading" unit="AUD">
            <Input type="number" value={local.paperBankroll ?? local.bankroll ?? 0} onChange={e => update('paperBankroll', +e.target.value)} />
          </SettingsField>
          <SettingsField label="Commission Source" explanation="Where commission rates come from">
            <Select value={local.useMarketBaseRate !== false ? 'market' : 'default'} onValueChange={v => update('useMarketBaseRate', v === 'market')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Market Base Rate</SelectItem>
                <SelectItem value="default">Default Fallback</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="Default Commission" explanation="Used when market base rate is unavailable" unit="%">
            <Input type="number" step="0.1" value={(local.defaultCommissionRate ?? 0.05) * 100} onChange={e => update('defaultCommissionRate', +e.target.value / 100)} />
          </SettingsField>
          <SettingsField label="Data Freshness Limit" explanation="Price data older than this is marked stale" unit="seconds" range="10–120">
            <Input type="number" value={local.dataFreshnessLimit ?? 30} onChange={e => update('dataFreshnessLimit', +e.target.value)} />
          </SettingsField>
        </div>
      </SettingsGroup>

      {/* D. Bot */}
      <SettingsGroup title="Bot" description="Scanning and auto-stop behaviour">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingsField label="Bot Enabled" explanation="Master switch for the paper bot">
            <Switch checked={botLocal.botEnabled} onCheckedChange={v => updateBot('botEnabled', v)} />
          </SettingsField>
          <SettingsField label="Scan Interval" explanation="How often the bot scans markets" unit="seconds" range="5–120">
            <Input type="number" value={botLocal.scanIntervalSeconds ?? 10} onChange={e => updateBot('scanIntervalSeconds', +e.target.value)} />
          </SettingsField>
          <SettingsField label="Time Window Start" explanation="When to begin scanning before race start" unit="seconds">
            <Input type="number" value={local.defaultTimeWindowStartSeconds ?? 300} onChange={e => update('defaultTimeWindowStartSeconds', +e.target.value)} />
          </SettingsField>
          <SettingsField label="Time Window End" explanation="When to stop scanning before race start" unit="seconds">
            <Input type="number" value={local.defaultTimeWindowEndSeconds ?? 30} onChange={e => update('defaultTimeWindowEndSeconds', +e.target.value)} />
          </SettingsField>
          <SettingsField label="Stop on API Error" explanation="Halt bot if Betfair API errors occur">
            <Switch checked={botLocal.stopOnApiError} onCheckedChange={v => updateBot('stopOnApiError', v)} />
          </SettingsField>
          <SettingsField label="Stop on Daily Loss" explanation="Halt bot when daily loss limit is hit">
            <Switch checked={botLocal.stopOnDailyLoss} onCheckedChange={v => updateBot('stopOnDailyLoss', v)} />
          </SettingsField>
          <SettingsField label="Stop on Drawdown" explanation="Halt bot when max drawdown is reached">
            <Switch checked={botLocal.stopOnMaxDrawdown} onCheckedChange={v => updateBot('stopOnMaxDrawdown', v)} />
          </SettingsField>
          <SettingsField label="Stop on Losing Streak" explanation="Halt bot when losing streak limit is hit">
            <Switch checked={botLocal.stopOnLosingStreak} onCheckedChange={v => updateBot('stopOnLosingStreak', v)} />
          </SettingsField>
        </div>
      </SettingsGroup>

      {/* E. Win Market */}
      <SettingsGroup title="WIN Market" description="Thresholds for WIN market opportunities">
        <div className="p-4"><MarketTypeThresholds /></div>
      </SettingsGroup>

      {/* F. Staking */}
      <SettingsGroup title="Staking" description="How stakes are calculated">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingsField label="Staking Mode" explanation="Method for calculating bet size">
            <Select value={featherlessSettings.stakingMode ?? 'fractional_kelly'} onValueChange={v => updateFeatherlessSettings({ stakingMode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat</SelectItem>
                <SelectItem value="fractional_kelly">Fractional Kelly</SelectItem>
                <SelectItem value="flat_proof_stake">Flat Proof Stake</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="Base Stake" explanation="Fixed stake for flat mode" unit="AUD">
            <Input type="number" value={local.baseStake ?? 2} onChange={e => update('baseStake', +e.target.value)} />
          </SettingsField>
          <SettingsField label="Kelly Multiplier" explanation="Fraction of full Kelly to use" range="0–1">
            <Input type="number" step="0.05" value={featherlessSettings.kellyMultiplier ?? 0.1} onChange={e => updateFeatherlessSettings({ kellyMultiplier: +e.target.value })} />
          </SettingsField>
          <SettingsField label="Max Stake" explanation="Absolute maximum stake per bet" unit="AUD">
            <Input type="number" value={local.maxStake ?? 25} onChange={e => update('maxStake', +e.target.value)} />
          </SettingsField>
          <SettingsField label="Max Stake %" explanation="Maximum stake as % of bankroll" unit="%">
            <Input type="number" step="0.5" value={(local.maxStakePercent ?? 0.25) * 100} onChange={e => update('maxStakePercent', +e.target.value / 100)} />
          </SettingsField>
          <SettingsField label="Max LAY Liability" explanation="Maximum liability for LAY bets" unit="AUD">
            <Input type="number" value={local.maxLayLiability ?? 50} onChange={e => update('maxLayLiability', +e.target.value)} />
          </SettingsField>
        </div>
      </SettingsGroup>

      {/* G. Risk */}
      <SettingsGroup title="Risk" description="Financial safety limits" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingsField label="Daily Loss Limit" explanation="Stop trading when daily loss reaches this" unit="AUD"><Input type="number" value={local.dailyLossLimit ?? 100} onChange={e => update('dailyLossLimit', +e.target.value)} /></SettingsField>
          <SettingsField label="Weekly Loss Limit" explanation="Stop trading when weekly loss reaches this" unit="AUD"><Input type="number" value={local.weeklyLossLimit ?? 300} onChange={e => update('weeklyLossLimit', +e.target.value)} /></SettingsField>
          <SettingsField label="Max Drawdown" explanation="Maximum allowed equity drawdown" unit="AUD"><Input type="number" value={botLocal.maxDrawdownLimit ?? 300} onChange={e => updateBot('maxDrawdownLimit', +e.target.value)} /></SettingsField>
          <SettingsField label="Max Losing Streak" explanation="Stop after this many consecutive losses"><Input type="number" value={botLocal.maxLosingStreak ?? 8} onChange={e => updateBot('maxLosingStreak', +e.target.value)} /></SettingsField>
          <SettingsField label="Max Exposure" explanation="Maximum total open exposure" unit="AUD"><Input type="number" value={local.maxMarketExposure ?? 100} onChange={e => update('maxMarketExposure', +e.target.value)} /></SettingsField>
          <SettingsField label="Max Open Orders" explanation="Maximum simultaneous open orders"><Input type="number" value={local.maxOpenOrders ?? 5} onChange={e => update('maxOpenOrders', +e.target.value)} /></SettingsField>
          <SettingsField label="Max Unmatched Orders" explanation="Maximum unmatched orders allowed"><Input type="number" value={local.maxUnmatchedOrders ?? 2} onChange={e => update('maxUnmatchedOrders', +e.target.value)} /></SettingsField>
          <SettingsField label="Max Trades Per Race" explanation="Maximum trades per single race"><Input type="number" value={local.maxTradesPerMarket ?? 1} onChange={e => update('maxTradesPerMarket', +e.target.value)} /></SettingsField>
          <SettingsField label="Max Trades Per Runner" explanation="Maximum trades per single runner"><Input type="number" value={local.maxTradesPerRunner ?? 1} onChange={e => update('maxTradesPerRunner', +e.target.value)} /></SettingsField>
          <SettingsField label="Max Trades Per Day" explanation="Maximum total trades per day"><Input type="number" value={local.maxTradesPerDay ?? 20} onChange={e => update('maxTradesPerDay', +e.target.value)} /></SettingsField>
        </div>
      </SettingsGroup>

      {/* H. Model */}
      <SettingsGroup title="Model" description="AI model and probability configuration">
        <FeatherlessSettings
          settings={featherlessSettings}
          onSave={(newSettings) => {
            updateFeatherlessSettings(newSettings);
            addAuditLog('Featherless AI Settings Updated', 'settings', 'info', `Featherless AI ${newSettings.enabled ? 'enabled' : 'disabled'}, model: ${newSettings.modelName}`);
          }}
        />
      </SettingsGroup>

      {/* I. Self-Calibration */}
      <SettingsGroup title="Self-Calibration" description="Automated strategy tuning" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingsField label="Enabled" explanation="Allow automated calibration runs">
            <Switch checked={featherlessSettings.aiDecisionMode === 'active_paper_discovery'} onCheckedChange={v => updateFeatherlessSettings({ aiDecisionMode: v ? 'active_paper_discovery' : 'strict' })} />
          </SettingsField>
          <SettingsField label="Objective Mode" explanation="What the calibrator optimises for">
            <Select defaultValue="BALANCED" onValueChange={() => {}}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BALANCED">Balanced</SelectItem>
                <SelectItem value="STRIKE_RATE_WITH_PROFIT">Strike Rate with Profit</SelectItem>
                <SelectItem value="PROFIT_MAXIMISING">Profit Maximising</SelectItem>
                <SelectItem value="LOW_DRAWDOWN">Low Drawdown</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="Minimum Sample" explanation="Minimum settled bets before calibration" warning="Requires at least 50 settled bets">
            <Input type="number" value={local.minimumPaperTrades ?? 500} onChange={e => update('minimumPaperTrades', +e.target.value)} />
          </SettingsField>
          <SettingsField label="Nightly Run" explanation="Run calibration automatically each night">
            <Switch defaultChecked={false} onCheckedChange={() => {}} />
          </SettingsField>
          <SettingsField label="Auto-Apply Champion" explanation="Automatically promote new champions" warning="OFF by default — champions require manual approval">
            <Switch checked={false} onCheckedChange={() => {}} disabled />
          </SettingsField>
        </div>
      </SettingsGroup>

      {/* J. Advanced */}
      <SettingsGroup title="Advanced" description="Cache, price moves, and debug options" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingsField label="Cache TTL" explanation="How long AI results are cached" unit="seconds"><Input type="number" value={featherlessSettings.aiResultCacheTtlSeconds ?? 90} onChange={e => updateFeatherlessSettings({ aiResultCacheTtlSeconds: +e.target.value })} /></SettingsField>
          <SettingsField label="Price Move Threshold" explanation="Re-run AI when price moves this many ticks" unit="ticks"><Input type="number" value={featherlessSettings.majorPriceMoveTicks ?? 5} onChange={e => updateFeatherlessSettings({ majorPriceMoveTicks: +e.target.value })} /></SettingsField>
          <SettingsField label="Debug Scan Mode" explanation="Run diagnostic scans without creating orders"><Switch checked={featherlessSettings.debugScanMode} onCheckedChange={v => updateFeatherlessSettings({ debugScanMode: v })} /></SettingsField>
        </div>
      </SettingsGroup>

      <Panel title="Effective Settings" subtitle="Stored values, enforced values, and linked engine consumers">
        <EffectiveSettingsTable />
      </Panel>
      <ResetAppData />
    </div>
  );
}