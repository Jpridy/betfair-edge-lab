import React from 'react';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { Panel } from '@/components/ui/workstation';
import { fmtMoney, fmtPct, plClass } from '@/lib/format';

function Item({ label, value, tone, note }) {
  return (
    <div className="rounded-md border border-border-subtle bg-muted/15 p-3">
      <div className="text-[10px] font-medium uppercase tracking-label text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold tabular-nums ${tone || 'text-foreground'}`}>{value}</div>
      {note && <div className="mt-1 text-[10px] text-muted-foreground">{note}</div>}
    </div>
  );
}

export default function AccountingSummary() {
  const accounting = usePortfolioAccountingDisplay();
  const warning = accounting.accountingDataInconsistent
    ? `${accounting.resolvedButStateInconsistentCount || 0} resolved order(s) have stale status fields.`
    : null;

  return (
    <Panel title="Accounting Summary" subtitle="Authoritative paper bankroll, realised P/L and open exposure">
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-6">
        <Item label="Gross Winnings" value={fmtMoney(accounting.grossWinnings)} tone="text-success" />
        <Item label="Gross Losses" value={fmtMoney(accounting.grossLosses)} tone="text-danger" />
        <Item label="Net P/L" value={fmtMoney(accounting.netRealisedPL, { sign: true })} tone={plClass(accounting.netRealisedPL)} note="After commission" />
        <Item label="Open Exposure" value={fmtMoney(accounting.totalOpenExposure)} tone={accounting.totalOpenExposure > 0 ? 'text-warning' : undefined} />
        <Item label="Available" value={fmtMoney(accounting.availableBankroll)} />
        <Item label="Net ROI" value={accounting.netROI == null ? '—' : fmtPct(accounting.netROI * 100)} tone={plClass(accounting.netROI)} note={warning || undefined} />
      </div>
    </Panel>
  );
}
