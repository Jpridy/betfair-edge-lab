import React from 'react';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { Panel } from '@/components/ui/workstation';
import { fmtMoney, plClass } from '@/lib/format';

function AccountingRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono font-semibold tabular-nums ${tone || 'text-foreground'}`}>{value}</span>
    </div>
  );
}

export default function DebugAccounting() {
  const accounting = usePortfolioAccountingDisplay();
  const failed = accounting.accountingReconciliationPassed !== true;

  return (
    <Panel title="Accounting" subtitle="Authoritative realised P/L, exposure and reconciliation">
      <div className="space-y-1 p-4">
        <AccountingRow label="Gross Winnings" value={fmtMoney(accounting.grossWinnings)} tone="text-success" />
        <AccountingRow label="Gross Losses" value={fmtMoney(accounting.grossLosses)} tone="text-danger" />
        <AccountingRow label="Gross P/L Before Commission" value={fmtMoney(accounting.grossRealisedPL)} tone={plClass(accounting.grossRealisedPL)} />
        <AccountingRow label="Commission Paid" value={fmtMoney(accounting.commissionPaid)} tone="text-warning" />
        <AccountingRow label="Net Realised P/L" value={fmtMoney(accounting.netRealisedPL)} tone={plClass(accounting.netRealisedPL)} />
        <AccountingRow label="Current Equity" value={fmtMoney(accounting.currentEquity)} />
        <AccountingRow label="Matched BACK Exposure" value={fmtMoney(accounting.matchedBackExposure)} />
        <AccountingRow label="Matched LAY Liability" value={fmtMoney(accounting.matchedLayLiability)} />
        <AccountingRow label="Unmatched Reserved Exposure" value={fmtMoney(accounting.unmatchedReservedExposure)} />
        <AccountingRow label="Open Exposure" value={fmtMoney(accounting.totalOpenExposure)} tone={accounting.totalOpenExposure > 0 ? 'text-warning' : undefined} />
        <AccountingRow label="Available Bankroll" value={fmtMoney(accounting.availableBankroll)} />
        <AccountingRow label="Economically Resolved Orders" value={String(accounting.economicallyResolvedOrderCount ?? accounting.settledOrderCount ?? 0)} />
        <AccountingRow label="Resolved With Stale Status" value={String(accounting.resolvedButStateInconsistentCount || 0)} tone={accounting.resolvedButStateInconsistentCount > 0 ? 'text-danger' : undefined} />
        <AccountingRow label="Reconciliation" value={failed ? 'FAILED' : 'OK'} tone={failed ? 'text-danger' : 'text-success'} />
        <AccountingRow label="Reconciliation Errors" value={String(accounting.reconciliationErrors?.length || 0)} tone={accounting.reconciliationErrors?.length > 0 ? 'text-danger' : undefined} />
        {accounting.reconciliationErrors?.length > 0 && (
          <div className="mt-3 rounded-lg border border-danger/25 bg-danger/5 p-3">
            <div className="mb-1 text-xs font-semibold text-danger">Accounting data needs repair</div>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {accounting.reconciliationErrors.map(error => <li key={error} className="font-mono">{error}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
