import React, { useState } from 'react';
import { Panel } from '@/components/ui/Trading';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/lib/AppContext';
import { ChevronDown, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[10px] font-mono font-semibold text-foreground text-right truncate">{value}</span>
    </div>
  );
}

export default function StrategyControlPanel() {
  const { strategyLibrary, featherlessSettings, setFeatherlessSettings, addAuditLog } = useApp();
  const [open, setOpen] = useState(false);
  const strategy = strategyLibrary[0];
  const enabled = featherlessSettings?.enabled || false;

  const handleToggle = (value) => {
    setFeatherlessSettings({ ...featherlessSettings, enabled: value });
    addAuditLog('Strategy Toggled', 'strategy', value ? 'info' : 'warning', `Featherless AI ${value ? 'enabled' : 'disabled'}`, { objectName: 'Featherless AI Value Decision Engine' });
  };

  if (!strategy) return null;

  return (
    <Panel title="Strategy Controls" action={
      <span className="text-xs text-muted-foreground">{enabled ? '1 active' : '0 active'}</span>
    }>
      <div className="p-4 space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          The Featherless AI Value Decision Engine is the only active strategy. Toggle it on or off. Expand for full rules and risk profile.
        </p>
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className={cn(
            'rounded-lg border transition-colors',
            enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
          )}>
            <div className="flex items-center gap-3 p-3">
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                enabled ? 'bg-primary/15 text-primary' : 'bg-muted/30 text-muted-foreground'
              )}>
                <Brain className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground truncate">{strategy.name}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded shrink-0">{strategy.category}</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{strategy.statusLabel || strategy.riskProfile}</div>
              </div>
              <Switch checked={enabled} onCheckedChange={handleToggle} />
              <CollapsibleTrigger asChild>
                <button className="ml-1 p-1 rounded hover:bg-accent transition-colors">
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-2 space-y-3 border-t border-border/50">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Description</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{strategy.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <DetailRow label="Risk Profile" value={strategy.riskProfile} />
                  <DetailRow label="Min Edge" value={`${strategy.minEdge}%`} />
                  <DetailRow label="Min Liquidity" value={`$${strategy.minLiquidity?.toLocaleString()}`} />
                  <DetailRow label="Time Window" value={strategy.timeWindow} />
                  <DetailRow label="Market Types" value={strategy.marketTypes?.join(', ')} />
                  <DetailRow label="Side" value={strategy.sideRestriction || 'BOTH'} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Entry Rules</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{strategy.entryRules}</p>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>
    </Panel>
  );
}