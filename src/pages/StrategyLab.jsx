import React, { useState } from 'react';
import { Panel } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Save, CheckCircle2, Brain } from 'lucide-react';

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function StrategyLab() {
  const { featherlessSettings, updateFeatherlessSettings, addAuditLog } = useApp();
  const [config, setConfig] = useState({
    minConfidence: featherlessSettings?.minConfidence || 75,
    minEdge: featherlessSettings?.minEdge || 5,
    minExpectedROI: featherlessSettings?.minExpectedROI || 3,
    minOdds: featherlessSettings?.minOdds || 2.0,
    maxOdds: featherlessSettings?.maxOdds || 12.0,
    minLiquidity: featherlessSettings?.minLiquidity || 5000,
    timeWindowStart: featherlessSettings?.timeWindowStart || 300,
    timeWindowEnd: featherlessSettings?.timeWindowEnd || 30,
    maxBetsPerRace: 1,
    maxStakePercent: 1,
    stakingMode: featherlessSettings?.stakingMode || 'confidence_weighted_fractional_kelly',
    paperTradeOnly: featherlessSettings?.paperTradeOnly ?? true,
  });
  const [saved, setSaved] = useState(false);

  const update = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updateFeatherlessSettings({ ...featherlessSettings, ...config, paperTradeOnly: true, allowLiveHandoff: false });
    addAuditLog('Featherless AI Strategy Updated', 'strategy', 'info', `Min confidence ${config.minConfidence}%, min edge ${config.minEdge}%, min ROI ${config.minExpectedROI}%`);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-xs text-muted-foreground">
        <span className="text-primary font-medium flex items-center gap-1"><Brain className="h-3 w-3" /> Featherless AI Value Decision Engine</span>
        <span className="mt-1 block">Uses live Betfair market data to estimate true runner probabilities, detect value against the exchange price, and paper trade validated bets. This is the only active strategy in the system. No external form data or historical data is connected.</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Strategy Parameters">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Minimum AI Confidence</Label>
                <Input type="number" value={config.minConfidence} onChange={e => update('minConfidence', +e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Minimum Edge (%)</Label>
                <Input type="number" step="0.1" value={config.minEdge} onChange={e => update('minEdge', +e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Minimum Expected ROI (%)</Label>
                <Input type="number" step="0.1" value={config.minExpectedROI} onChange={e => update('minExpectedROI', +e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Minimum Liquidity ($)</Label>
                <Input type="number" value={config.minLiquidity} onChange={e => update('minLiquidity', +e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Min Odds</Label>
                <Input type="number" step="0.1" value={config.minOdds} onChange={e => update('minOdds', +e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Max Odds</Label>
                <Input type="number" step="0.1" value={config.maxOdds} onChange={e => update('maxOdds', +e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Time Window Start (sec)</Label>
                <Input type="number" value={config.timeWindowStart} onChange={e => update('timeWindowStart', +e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Time Window End (sec)</Label>
                <Input type="number" value={config.timeWindowEnd} onChange={e => update('timeWindowEnd', +e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Max Bets Per Race</Label>
                <Input type="number" value={config.maxBetsPerRace} onChange={e => update('maxBetsPerRace', +e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Max Stake % Bankroll</Label>
                <Input type="number" step="0.1" value={config.maxStakePercent} onChange={e => update('maxStakePercent', +e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="space-y-2 pt-3 border-t border-border">
              <ToggleRow label="Paper Trade Only (always on)" checked={true} onChange={() => {}} />
              <ToggleRow label="Bookmaker Confirmation (not connected)" checked={false} onChange={() => {}} />
              <ToggleRow label="Form Data Confirmation (not connected)" checked={false} onChange={() => {}} />
            </div>
            <Button className="w-full" onClick={handleSave}>
              {saved ? <><CheckCircle2 className="h-4 w-4" /> Saved!</> : <><Save className="h-4 w-4" /> Save Strategy Settings</>}
            </Button>
          </div>
        </Panel>

        <Panel title="Staking & Safety Rules">
          <div className="p-4 space-y-3">
            <div>
              <Label className="text-xs">Staking Mode</Label>
              <select value={config.stakingMode} onChange={e => update('stakingMode', e.target.value)} className="w-full h-9 mt-1 bg-background border border-input rounded-md text-xs px-3">
                <option value="flat">Flat Stake</option>
                <option value="percent_bankroll">Percent Bankroll</option>
                <option value="fractional_kelly">Fractional Kelly (25%)</option>
                <option value="confidence_weighted_fractional_kelly">Confidence-Weighted 25% Kelly</option>
              </select>
            </div>
            <div className="pt-3 border-t border-border space-y-2">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kelly Formula</div>
              <div className="text-xs text-muted-foreground font-mono bg-muted/30 rounded p-2">
                kelly = ((odds - 1) × prob - (1 - prob)) / (odds - 1)
              </div>
              <div className="text-xs text-muted-foreground font-mono bg-muted/30 rounded p-2">
                stake = bankroll × kelly × 0.25 × (confidence / 100)
              </div>
            </div>
            <div className="pt-3 border-t border-border space-y-1">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Caps</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• Max stake per bet: 1% bankroll</div>
                <div>• Max exposure per race: 2% bankroll</div>
                <div>• No stake if Kelly ≤ 0</div>
                <div>• No stake if expected ROI below threshold</div>
                <div>• No stake if confidence below threshold</div>
                <div>• Daily stop loss enforced</div>
              </div>
            </div>
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mt-3">
              <div className="text-xs text-danger font-bold">Paper-only mode</div>
              <div className="text-xs text-muted-foreground mt-1">Featherless AI decides only. The app executes paper trades only after all validation passes. Advanced review is disabled. No real bets are placed.</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}