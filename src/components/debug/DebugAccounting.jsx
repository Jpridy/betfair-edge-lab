import React from 'react';
import { useApp } from '@/lib/AppContext';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { Panel } from '@/components/ui/workstation';
import { fmtMoney, plClass } from '@/lib/format';

function AccountingRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono tabular-nums font-semibold ${tone || 'text-foreground'}`}>{value}</span>
    </div>
  );
}

export default function DebugAccounting() {
  const accounting = usePortfolioAccountingDisplay();

  return (
    <Panel title="Accounting" subtitle="Full financial breakdown and reconciliation">
      <div className="p-4 space-y-1">
        <AccountingRow label="Gross Winnings" value={fmtMoney(accounting.grossWinnings)} tone="text-success" />
        <AccountingRow label="Gross Losses" value={fmtMoney(accounting.grossLosses)} tone="text-danger" />
        <AccountingRow label="Gross P/L Before Commission" value={fmtMoney(accounting.grossRealisedPL)} tone={plClass(accounting.grossRealisedPL)} />
        <AccountingRow label="Commission Paid" value={fmtMoney(accounting.commissionPaid)} tone="text-warning" />
        <AccountingRow label="Net Realised P/L" value={fmtMoney(accounting.netRealisedPL)} tone={plClass(accounting.netRealisedPL)} />
        <AccountingRow label="Current Equity" value={fmtMoney(accounting.currentEquity)} />
        <AccountingRow label="Open Exposure" value={fmtMoney(accounting.totalOpenExposure)} tone={accounting.totalOpenExposure > 0 ? 'text-warning' : undefined} />
        <AccountingRow label="Available Bankroll" value={fmtMoney(accounting.availableBankroll)} />
        <AccountingRow label="Reconciliation" value={accounting.reconciliationFailed ? 'FAILED' : 'OK'} tone={accounting.reconciliationFailed ? 'text-danger' : 'text-success'} />
        <AccountingRow label="Reconciliation Errors" value={String(accounting.reconciliationErrors?.length || 0)} tone={accounting.reconciliationErrors?.length > 0 ? 'text-danger' : undefined} />
      </div>
    </Panel>
  );
}