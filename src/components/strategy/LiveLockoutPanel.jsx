import React from 'react';
import { Panel } from '@/components/ui/Trading';
import { Lock, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { computeTrafficLight } from '@/lib/strategyValidation';
import { StrategyStatusBadge } from './StrategyStatusBadge';

/**
 * Paper-Only Lock Panel (replaces former LiveLockoutPanel).
 * This app is paper-only. No real bets are placed.
 * Shows strategy validation status without implying live betting can be enabled.
 */
export default function LiveLockoutPanel({ strategy, audit, settings }) {
  const status = computeTrafficLight(strategy, audit, settings);
  const validated = status.light === 'green';

  return (
    <Panel title="Paper-Only Status" action={<StrategyStatusBadge light={status.light} label={status.label} />}>
      <div className="p-4 space-y-4">
        <div className={`rounded-lg border p-4 ${validated ? 'border-chart-1/30 bg-chart-1/5' : 'border-chart-4/30 bg-chart-4/5'}`}>
          <div className="flex items-start gap-3">
            {validated ? (
              <CheckCircle2 className="h-5 w-5 text-chart-1 shrink-0 mt-0.5" />
            ) : (
              <Lock className="h-5 w-5 text-chart-4 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className={`text-sm font-bold ${validated ? 'text-chart-1' : 'text-chart-4'}`}>
                {validated ? 'Paper Validated' : 'Paper Testing'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {validated
                  ? 'All validation criteria passed. Strategy is validated for paper trading analysis.'
                  : 'Strategy is still being tested with paper trades. More data needed for validation.'}
              </div>
            </div>
          </div>
        </div>

        {!validated && status.reasons.length > 0 && (
          <div className="space-y-1">
            {status.reasons.map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <XCircle className="h-3 w-3 text-chart-4 shrink-0 mt-0.5" />
                {reason}
              </div>
            ))}
          </div>
        )}

        <div className="bg-muted/30 border border-border rounded-lg p-3 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            Paper-only mode. No real bets are placed. Betfair data connected for analysis only. Advanced review is disabled.
          </div>
        </div>
      </div>
    </Panel>
  );
}