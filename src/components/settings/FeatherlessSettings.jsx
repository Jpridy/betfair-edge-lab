import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Wifi, RefreshCw, Brain, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const DEFAULT_FEATHERLESS = {
  enabled: false,
  modelName: 'meta-llama/Llama-3.3-70B-Instruct',
  temperature: 0.1,
  maxTokens: 2000,
  timeoutSeconds: 10,
  minConfidence: 75,
  minEdge: 5,
  minExpectedROI: 3,
  paperTradeOnly: true,
  allowLiveHandoff: false,
  storeLogs: true,
  minOdds: 2.0,
  maxOdds: 12.0,
  minLiquidity: 5000,
  timeWindowStart: 300,
  timeWindowEnd: 30,
  stakingMode: 'confidence_weighted_fractional_kelly',
};

const STAKING_MODES = [
  { value: 'flat', label: 'Flat Stake' },
  { value: 'percent_bankroll', label: 'Percent Bankroll' },
  { value: 'fractional_kelly', label: 'Fractional Kelly (25%)' },
  { value: 'confidence_weighted_fractional_kelly', label: 'Confidence-Weighted 25% Kelly' },
];

export default function FeatherlessSettings({ settings, onSave }) {
  const [local, setLocal] = useState({ ...DEFAULT_FEATHERLESS, ...settings });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const update = (key, value) => setLocal(prev => ({ ...prev, [key]: value }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await base44.functions.invoke('featherlessAI', { action: 'test' });
      setTestResult(resp.data);
    } catch (err) {
      setTestResult({ connected: false, error: err.response?.data?.error || err.message });
    }
    setTesting(false);
  };

  const handleSave = () => {
    onSave(local);
  };

  return (
    <Panel title="Featherless AI Decision Engine">
      <div className="p-4 space-y-4">
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-xs text-muted-foreground">
          <span className="text-primary font-medium flex items-center gap-1"><Brain className="h-3 w-3" /> Featherless AI:</span>
          <span className="mt-1 block">Uses an OpenAI-compatible API at <code className="text-foreground">api.featherless.ai/v1</code>. The API key is stored server-side and never exposed to the browser. AI decisions are always validated by the app's safety gate before any paper trade is created.</span>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <Label className="text-sm font-bold">Enable Featherless AI</Label>
            <div className="text-xs text-muted-foreground mt-1">Disabled until API key is configured and enabled</div>
          </div>
          <Switch checked={local.enabled} onCheckedChange={v => update('enabled', v)} />
        </div>

        {/* Connection Test */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">API Key stored securely (FEATHERLESS_API_KEY)</div>
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Wifi className="h-3 w-3 mr-1" />}
            Test Connection
          </Button>
        </div>
        {testResult && (
          <div className={`flex items-center gap-2 text-xs p-2 rounded ${testResult.connected ? 'bg-chart-1/10 text-chart-1' : 'bg-chart-5/10 text-chart-5'}`}>
            {testResult.connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {testResult.connected ? 'Connection successful — API key valid' : `Connection failed: ${testResult.error || 'Unknown error'}`}
          </div>
        )}

        {/* Model Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
          <div>
            <Label className="text-xs">Featherless Model Name</Label>
            <Input value={local.modelName} onChange={e => update('modelName', e.target.value)} className="mt-1" placeholder="meta-llama/Llama-3.3-70B-Instruct" />
            <div className="text-[10px] text-muted-foreground mt-1">Any model available on featherless.ai</div>
          </div>
          <div>
            <Label className="text-xs">Temperature</Label>
            <Input type="number" step="0.1" min="0" max="2" value={local.temperature} onChange={e => update('temperature', +e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Max Tokens</Label>
            <Input type="number" value={local.maxTokens} onChange={e => update('maxTokens', +e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">AI Request Timeout (seconds)</Label>
            <Input type="number" value={local.timeoutSeconds} onChange={e => update('timeoutSeconds', +e.target.value)} className="mt-1" />
          </div>
        </div>

        {/* Decision Thresholds */}
        <div className="pt-3 border-t border-border">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Decision Thresholds</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Minimum AI Confidence</Label>
              <Input type="number" value={local.minConfidence} onChange={e => update('minConfidence', +e.target.value)} className="mt-1" />
              <div className="text-[10px] text-muted-foreground mt-1">0-100 scale</div>
            </div>
            <div>
              <Label className="text-xs">Minimum Edge (%)</Label>
              <Input type="number" step="0.1" value={local.minEdge} onChange={e => update('minEdge', +e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Minimum Expected ROI (%)</Label>
              <Input type="number" step="0.1" value={local.minExpectedROI} onChange={e => update('minExpectedROI', +e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>

        {/* Strategy Parameters */}
        <div className="pt-3 border-t border-border">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Strategy Parameters</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Min Odds</Label>
              <Input type="number" step="0.1" value={local.minOdds} onChange={e => update('minOdds', +e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Max Odds</Label>
              <Input type="number" step="0.1" value={local.maxOdds} onChange={e => update('maxOdds', +e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Min Liquidity ($)</Label>
              <Input type="number" value={local.minLiquidity} onChange={e => update('minLiquidity', +e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Time Window Start (sec before jump)</Label>
              <Input type="number" value={local.timeWindowStart} onChange={e => update('timeWindowStart', +e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Time Window End (sec before jump)</Label>
              <Input type="number" value={local.timeWindowEnd} onChange={e => update('timeWindowEnd', +e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Staking Mode</Label>
              <Select value={local.stakingMode} onValueChange={v => update('stakingMode', v)}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAKING_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Safety Toggles */}
        <div className="pt-3 border-t border-border space-y-3">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Safety & Mode</div>
          <ToggleRow label="Paper Trade Only Mode" checked={local.paperTradeOnly} onChange={v => update('paperTradeOnly', v)} />
          <ToggleRow label="Allow Live Bet Handoff (to Bot Control Centre)" checked={local.allowLiveHandoff} onChange={v => update('allowLiveHandoff', v)} />
          <ToggleRow label="Store Full AI Request/Response Logs" checked={local.storeLogs} onChange={v => update('storeLogs', v)} />
        </div>

        {/* Live Warning */}
        {local.allowLiveHandoff && (
          <div className="bg-chart-5/10 border border-chart-5/30 rounded-lg p-3">
            <div className="text-xs font-bold text-chart-5 flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Live AI Betting Warning</div>
            <div className="text-xs text-muted-foreground mt-1">AI betting is experimental. Use paper trading first. Live mode should only be enabled after enough profitable paper-trading evidence.</div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-border">
          <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Save Featherless Settings</Button>
        </div>
      </div>
    </Panel>
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