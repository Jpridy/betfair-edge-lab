import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/lib/AppContext';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

// Evaluates each global stop rule against live state to determine if it's currently triggered.
function evaluateStopRules(botSettings, settings, bankrollStats, emergencyStop, apiConnected) {
  const bankroll = bankrollStats.bankroll || 1;
  const dailyLossUsed = bankrollStats.todayPL < 0 ? Math.abs(bankrollStats.todayPL) : 0;
  const drawdownPercent = Math.abs(bankrollStats.maxDrawdown) / bankroll * 100;

  return [
    {
      key: 'stopOnEmergency',
      label: 'Emergency Stop',
      description: 'Halts all trading immediately, cancels open orders, disables live mode.',
      enabled: botSettings.stopOnEmergency,
      triggered: emergencyStop,
      triggerDetail: emergencyStop ? 'Emergency stop is ACTIVE' : 'Not triggered',
    },
    {
      key: 'stopOnDailyLoss',
      label: 'Daily Loss Limit',
      description: `Stops trading when daily losses reach $${settings.dailyLossLimit}.`,
      enabled: botSettings.stopOnDailyLoss,
      triggered: dailyLossUsed >= settings.dailyLossLimit,
      triggerDetail: `$${dailyLossUsed.toFixed(2)} of $${settings.dailyLossLimit} used (${((dailyLossUsed / settings.dailyLossLimit) * 100).toFixed(1)}%)`,
    },
    {
      key: 'stopOnMaxDrawdown',
      label: 'Max Drawdown',
      description: `Stops trading when drawdown exceeds ${10}% of bankroll ($${(bankroll * 0.1).toFixed(2)}).`,
      enabled: botSettings.stopOnMaxDrawdown,
      triggered: drawdownPercent >= 10,
      triggerDetail: `Drawdown at ${drawdownPercent.toFixed(2)}% of bankroll`,
    },
    {
      key: 'stopOnLosingStreak',
      label: 'Losing Streak',
      description: 'Stops trading after 5 consecutive losses.',
      enabled: botSettings.stopOnLosingStreak,
      triggered: bankrollStats.longestLosingStreak >= 5,
      triggerDetail: `Current worst streak: ${bankrollStats.longestLosingStreak}`,
    },
    {
      key: 'stopOnApiError',
      label: 'API Error / Disconnection',
      description: 'Stops trading when the Betfair API is degraded or disconnected.',
      enabled: botSettings.stopOnApiError,
      triggered: !apiConnected,
      triggerDetail: apiConnected ? 'API connected' : 'API disconnected',
    },
  ];
}

export default function GlobalStopRules() {
  const { botSettings, updateBotSettings, settings, bankrollStats, emergencyStop, apiConnected } = useApp();

  const rules = evaluateStopRules(botSettings, settings, bankrollStats, emergencyStop, apiConnected);
  const anyTriggered = rules.some(r => r.enabled && r.triggered);

  const handleToggle = (key, enabled) => {
    updateBotSettings({ ...botSettings, [key]: enabled });
  };

  return (
    <Panel
      title="Global Stop Rules"
      action={
        anyTriggered
          ? <StatusBadge status="danger"><ShieldAlert className="h-3 w-3 mr-1" />STOP TRIGGERED</StatusBadge>
          : <StatusBadge status="ok"><CheckCircle2 className="h-3 w-3 mr-1" />ALL CLEAR</StatusBadge>
      }
    >
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          These rules are evaluated before every bot cycle. If any enabled rule is triggered, the bot stops automatically and an audit log entry is written.
        </p>
        {rules.map(rule => {
          const active = rule.enabled && rule.triggered;
          return (
            <div
              key={rule.key}
              className={`flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors ${
                active ? 'border-danger/50 bg-danger/5' : 'border-border bg-muted/30'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={`mt-0.5 shrink-0 ${active ? 'text-danger' : rule.enabled ? 'text-success' : 'text-muted-foreground'}`}>
                  {active ? <AlertTriangle className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{rule.label}</span>
                    {active && <StatusBadge status="danger">TRIGGERED</StatusBadge>}
                    {!rule.enabled && <StatusBadge status="neutral">DISABLED</StatusBadge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{rule.triggerDetail}</p>
                </div>
              </div>
              <Switch checked={rule.enabled} onCheckedChange={(v) => handleToggle(rule.key, v)} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}