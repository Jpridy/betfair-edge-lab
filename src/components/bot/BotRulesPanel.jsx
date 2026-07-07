import React from 'react';
import { Panel } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { getEnabledStrategies } from '@/lib/botEngine';

export default function BotRulesPanel() {
  const { settings, botSettings, emergencyStop, featherlessSettings } = useApp();

  const enabledStrategies = getEnabledStrategies(settings, featherlessSettings?.enabled);

  const rules = [
    { label: 'Selected Strategies', value: enabledStrategies.length > 0 ? enabledStrategies.join(', ') : 'None enabled' },
    { label: 'Market Filters', value: 'Horse Racing, WIN, Pre-race' },
    { label: 'Time Window Before Start', value: `${settings.defaultTimeWindowStartSeconds}s - ${settings.defaultTimeWindowEndSeconds}s` },
    { label: 'Minimum Liquidity', value: `$${settings.minimumLiquidity.toLocaleString()}` },
    { label: 'Minimum Traded Volume', value: `$${settings.minimumTradedVolume.toLocaleString()}` },
    { label: 'Maximum Spread', value: '5 ticks' },
    { label: 'Minimum Odds', value: settings.minOdds.toFixed(2) },
    { label: 'Maximum Odds', value: settings.maxOdds.toFixed(2) },
    { label: 'Minimum Edge', value: '2.00%' },
    { label: 'Maximum Stake', value: `$${settings.maxStake}` },
    { label: 'Daily Loss Limit', value: `$${settings.dailyLossLimit}` },
    { label: 'Max Trades Per Day', value: settings.maxTradesPerDay },
    { label: 'Max Trades Per Market', value: settings.maxTradesPerMarket },
    { label: 'Max Losing Streak', value: '5' },
    { label: 'Emergency Stop', value: emergencyStop ? 'ACTIVE' : 'Ready' },
  ];

  return (
    <Panel title="Active Bot Rules">
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
        {rules.map(r => (
          <div key={r.label} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-mono font-semibold text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}