import React from 'react';
import { WalletCards } from 'lucide-react';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { cn } from '@/lib/utils';

const money=value=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(Number.isFinite(Number(value))?Number(value):0);
const plClass = (value) => Number(value) > 0 ? 'text-success' : Number(value) < 0 ? 'text-danger' : 'text-sidebar-foreground';

export default function BankrollPanel() {
  const accounting=usePortfolioAccountingDisplay();
  const rows=[
    {label:'Current Equity',value:accounting.currentEquity},
    {label:'Net Realised P/L',value:accounting.netRealisedPL,profitLoss:true},
    {label:'Open Exposure',value:accounting.totalOpenExposure},
    {label:'Available',value:accounting.availableBankroll},
  ];

  return (
    <section aria-label="Bankroll statistics" className="mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-sidebar-foreground"><WalletCards className="h-4 w-4 text-primary" />Bankroll</div>
      <dl className="space-y-1.5">{rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-2 text-[11px]"><dt className="text-muted-foreground">{row.label}</dt><dd className={cn('font-mono font-semibold tabular-nums text-sidebar-foreground', row.profitLoss && plClass(row.value))}>{money(row.value)}</dd></div>)}</dl>
    </section>
  );
}