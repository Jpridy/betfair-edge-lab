import React, { useState } from 'react';
import { Panel } from '@/components/ui/Trading';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/lib/AppContext';
import { ChevronDown, Brain, TrendingUp, Scissors, Users, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';

const STRATEGY_ICONS = {
  'Value Bet': TrendingUp,
  'Pre-Off Scalping': Scissors,
  'Fav/Outsider': Users,
  'Steam/Drift': Wind,
  'Featherless AI Value Decision Engine': Brain,
};

const STRATEGY_SETTING_KEYS = {
  'Value Bet': 'strategyValueBetEnabled',
  'Pre-Off Scalping': 'strategyScalpingEnabled',
  'Fav/Outsider': 'strategyFavOutsiderEnabled',
  'Steam/Drift': 'strategySteamDriftEnabled',
  'Featherless AI Value Decision Engine': '__featherless__',
};

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[10px] font-mono font-semibold text-foreground text-right truncate">{value}</span>
    </div>
  );
}

function StrategyBlock({ strategy, enabled, onToggle }) {
  const [open, setOpen] = useState(false);
  const Icon = STRATEGY_ICONS[strategy.name] || TrendingUp;
  const isArchived = strategy.status === 'archived';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn(
        'rounded-lg border transition-colors',
        enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
        isArchived && 'opacity-50'
      )}>
        <div className="flex items-center gap-3 p-3">
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            enabled ? 'bg-primary/15 text-primary' : 'bg-muted/30 text-muted-foreground'
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground truncate">{strategy.name}</span>
              <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded shrink-0">{strategy.category}</span>
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{strategy.statusLabel || strategy.riskProfile}</div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={isArchived}
          />
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
  );
}

export default function StrategyControlPanel() {
  const { strategyLibrary, settings, updateSettings, featherlessSettings, setFeatherlessSettings, addAuditLog } = useApp();

  const activeStrategies = strategyLibrary.filter(s => s.status !== 'archived');

  const isEnabled = (name) => {
    const key = STRATEGY_SETTING_KEYS[name];
    if (key === '__featherless__') return featherlessSettings?.enabled || false;
    return settings[key] || false;
  };

  const handleToggle = (name, value) => {
    const key = STRATEGY_SETTING_KEYS[name];
    if (key === '__featherless__') {
      setFeatherlessSettings({ ...featherlessSettings, enabled: value });
    } else {
      updateSettings({ ...settings, [key]: value });
    }
    addAuditLog('Strategy Toggled', 'strategy', value ? 'info' : 'warning', `${name} ${value ? 'enabled' : 'disabled'}`, { objectName: name });
  };

  const enabledCount = activeStrategies.filter(s => isEnabled(s.name)).length;

  return (
    <Panel title="Strategy Controls" action={
      <span className="text-xs text-muted-foreground">{enabledCount} of {activeStrategies.length} active</span>
    }>
      <div className="p-4 space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Toggle each strategy on or off. Enabled strategies are used by the bot scanner and signal engine. Expand a block for full rules and risk profile.
        </p>
        {activeStrategies.map(strategy => (
          <StrategyBlock
            key={strategy.id}
            strategy={strategy}
            enabled={isEnabled(strategy.name)}
            onToggle={(v) => handleToggle(strategy.name, v)}
          />
        ))}
      </div>
    </Panel>
  );
}