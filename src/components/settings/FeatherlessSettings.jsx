import React, { useState } from 'react';
import { Panel } from '@/components/ui/Trading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Save, Wifi, RefreshCw, Brain, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { DISCOVERY_PRESETS, FREQUENCY_TO_MODE } from '@/lib/candidateScoring';

const DEFAULT_FEATHERLESS = {
  enabled: false,
  modelName: 'deepseek-ai/DeepSeek-V4-Flash',
  temperature: 0.1,
  maxTokens: 4000,
  timeoutSeconds: 60,
  minConfidence: 75,
  minEdge: 5,
  minExpectedROI: 3,
  paperTradeOnly: true,
  allowLiveHandoff: false,
  storeLogs: true,
  minOdds: 2.0,
  maxOdds: 12.0,
  minLiquidity: 500,
  maxSpread: 5,
  timeWindowStart: 500,
  timeWindowEnd: 30,
  stakingMode: 'confidence_weighted_fractional_kelly',
  webResearchEnabled: false,
  aiDecisionMode: 'strict',
  requireExternalFormData: false,
  targetPaperBetsPerDay: 'low',
  debugScanMode: false,
};

export default function FeatherlessSettings({ settings, onSave }) {
  const [local, setLocal] = useState({ ...DEFAULT_FEATHERLESS, ...settings });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saved, setSaved] = useState(false);

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
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

        {/* Web Research Toggle */}
        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <Label className="text-sm font-bold">OpenAI Web Search Research</Label>
            <div className="text-xs text-muted-foreground mt-1">Gathers public race-day info (form, scratchings, track, tips) via OpenAI web search before AI analysis. Adds ~10-30s latency per bot cycle. API key stored securely (OPENAI_API_KEY).</div>
          </div>
          <Switch checked={local.webResearchEnabled} onCheckedChange={v => update('webResearchEnabled', v)} />
        </div>

        {/* Model Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
          <div>
            <Label className="text-xs">Featherless Model Name</Label>
            <Input value={local.modelName} onChange={e => update('modelName', e.target.value)} className="mt-1" placeholder="deepseek-ai/DeepSeek-V4-Flash" />
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

        {/* Paper Discovery Mode Presets */}
        <div className="pt-3 border-t border-border">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Paper Discovery Mode</div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {Object.entries(DISCOVERY_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => {
                  update('aiDecisionMode', key);
                  update('minConfidence', preset.minConfidence);
                  update('minEdge', preset.minEdge);
                  update('minExpectedROI', preset.minExpectedROI);
                  update('minLiquidity', preset.minLiquidity);
                  update('maxSpread', preset.maxSpread);
                }}
                className={`text-xs font-medium rounded-lg p-2 border transition-all ${
                  local.aiDecisionMode === key
                    ? 'bg-primary/15 border-primary text-primary'
                    : 'bg-card border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <Zap className="h-3 w-3 mx-auto mb-1" />
                {preset.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2">
            Lower thresholds create more paper trades for testing. They do not mean better real-money performance.
          </div>
        </div>

        {/* Bet Pick Frequency */}
        <div className="pt-3 border-t border-border">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Bet Pick Frequency</div>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[
              { key: 'very_low', label: 'Very Low', range: '1–3/day' },
              { key: 'low', label: 'Low', range: '3–8/day' },
              { key: 'medium', label: 'Medium', range: '8–20/day' },
              { key: 'high', label: 'High', range: '20+/day' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => {
                  update('targetPaperBetsPerDay', opt.key);
                  const mode = FREQUENCY_TO_MODE[opt.key];
                  if (mode) {
                    const preset = DISCOVERY_PRESETS[mode];
                    update('aiDecisionMode', mode);
                    update('minConfidence', preset.minConfidence);
                    update('minEdge', preset.minEdge);
                    update('minExpectedROI', preset.minExpectedROI);
                    update('minLiquidity', preset.minLiquidity);
                    update('maxSpread', preset.maxSpread);
                  }
                }}
                className={`text-xs font-medium rounded-lg p-2 border transition-all ${
                  local.targetPaperBetsPerDay === opt.key
                    ? 'bg-chart-3/15 border-chart-3 text-chart-3'
                    : 'bg-card border-border text-muted-foreground hover:border-chart-3/30'
                }`}
              >
                <div className="font-bold">{opt.label}</div>
                <div className="text-[9px] text-muted-foreground">{opt.range}</div>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-chart-4 bg-chart-4/5 rounded p-1.5">
            Higher frequency is for data collection only.
          </div>
        </div>

        {/* Market-Only / External Form Data */}
        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <Label className="text-sm font-bold">Require External Form Data</Label>
            <div className="text-xs text-muted-foreground mt-1">When enabled, market-only signals are blocked. When disabled (default), market-only paper signals are allowed and clearly labeled.</div>
          </div>
          <Switch checked={local.requireExternalFormData} onCheckedChange={v => update('requireExternalFormData', v)} />
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
              <Label className="text-xs">Max Spread (ticks)</Label>
              <Input type="number" value={local.maxSpread} onChange={e => update('maxSpread', +e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Time Window Start (sec before jump)</Label>
              <Input type="number" value={local.timeWindowStart} onChange={e => update('timeWindowStart', +e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Time Window End (sec before jump)</Label>
              <Input type="number" value={local.timeWindowEnd} onChange={e => update('timeWindowEnd', +e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>

        {/* Debug Scan Mode */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Debug Scan Mode</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Ignore time window — scan all open markets to prove WIN/PLACE/H2H detection and opportunity generation. NO orders placed.
              </div>
            </div>
            <Switch checked={local.debugScanMode} onCheckedChange={v => update('debugScanMode', v)} />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <Button size="sm" onClick={handleSave}>
            {saved ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save Featherless Settings</>}
          </Button>
        </div>
      </div>
    </Panel>
  );
}