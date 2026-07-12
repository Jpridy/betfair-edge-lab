import React from 'react';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { fmtMoney, plClass } from '@/lib/format';
import { TrendingUp, Wallet, AlertCircle, Banknote } from 'lucide-react';

const EXPLANATIONS = {
  'Net Realised P/L': 'Profit or loss from settled paper bets after commission.',
  'Current Equity': 'Starting bankroll plus realised P/L.',
  'Open Exposure': 'Money currently at risk in unsettled paper bets.',
  'Available Bankroll': 'Equity minus open exposure.',
};

function MoneyCard({ label, value, icon: Icon, tone }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`text-xl font-heading font-semibold tabular-nums tracking-tight-brand ${tone || 'text-foreground'}`}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{EXPLANATIONS[label]}</div>
    </div>
  );
}

export default function MainMoneyRow() {
  const accounting = usePortfolioAccountingDisplay();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <MoneyCard label="Net Realised P/L" value={fmtMoney(accounting.netRealisedPL, { sign: true })} icon={TrendingUp} tone={plClass(accounting.netRealisedPL)} />
      <MoneyCard label="Current Equity" value={fmtMoney(accounting.currentEquity)} icon={Wallet} />
      <MoneyCard label="Open Exposure" value={fmtMoney(accounting.totalOpenExposure)} icon={AlertCircle} tone={accounting.totalOpenExposure > 0 ? 'text-warning' : undefined} />
      <MoneyCard label="Available Bankroll" value={fmtMoney(accounting.availableBankroll)} icon={Banknote} />
    </div>
  );
}