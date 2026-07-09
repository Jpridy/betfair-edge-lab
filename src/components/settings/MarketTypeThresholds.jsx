import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Save } from 'lucide-react';

const MARKET_TYPES = [
  { key: 'win', label: 'WIN', prefix: 'win' },
  { key: 'place', label: 'PLACE', prefix: 'place' },
  { key: 'h2h', label: 'H2H', prefix: 'h2h' },
];

const FIELDS = [
  { suffix: 'MinOdds', label: 'Min Odds', step: 0.1 },
  { suffix: 'MaxOdds', label: 'Max Odds', step: 0.1 },
  { suffix: 'MinLiquidity', label: 'Min Liquidity ($)', step: 1 },
  { suffix: 'MaxSpreadTicks', label: 'Max Spread (ticks)', step: 1 },
  { suffix: 'MinEdge', label: 'Min Edge (%)', step: 0.1 },
  { suffix: 'MinROI', label: 'Min ROI (%)', step: 0.1 },
];

export default function MarketTypeThresholds() {
  const { featherlessSettings, updateFeatherlessSettings } = useApp();
  const [local, setLocal] = useState(featherlessSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocal(featherlessSettings); }, [featherlessSettings]);

  const update = (key, value) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateFeatherlessSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-chart-3/10 border border-chart-3/30 rounded-lg p-3 text-xs text-muted-foreground">
        <span className="text-chart-3 font-medium">Market-Type Thresholds:</span> These thresholds are used by the exchange engine to filter opportunities for each market type. The engine calls <span className="font-mono">resolveMarketTypeThresholds()</span> to get the active values for WIN, PLACE, and H2H markets.
      </div>

      {MARKET_TYPES.map(mt => (
        <div key={mt.key} className="border border-border rounded-lg p-3">
          <div className="text-xs font-bold text-primary uppercase tracking-wider mb-3">{mt.label} Markets</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {FIELDS.map(f => {
              const fieldKey = `${mt.prefix}${f.suffix}`;
              return (
                <div key={fieldKey}>
                  <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                  <Input
                    type="number"
                    step={f.step}
                    value={local?.[fieldKey] ?? 0}
                    onChange={e => update(fieldKey, +e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} className="gap-1.5">
          {saved ? <><CheckCircle2 className="h-4 w-4" /> Saved!</> : <><Save className="h-4 w-4" /> Save Thresholds</>}
        </Button>
      </div>
    </div>
  );
}