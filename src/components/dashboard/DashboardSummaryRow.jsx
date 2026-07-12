import React from 'react';
import { useApp } from '@/lib/AppContext';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { MetricCard } from '@/components/ui/workstation';
import { fmtMoney } from '@/lib/format';
import { TrendingUp, Wallet, AlertCircle, Banknote, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function DashboardSummaryRow() {
  const accounting = usePortfolioAccountingDisplay();
  const { statisticalValidation, paperOrders } = useApp();

  const settledCount = paperOrders.filter(o => o.status === 'settled' && !o.proofMode && !o.excludeFromPerformance && !o.invalidTestRecord).length;
  const validationStatus = statisticalValidation?.overallStatus || 'INSUFFICIENT_DATA';

  const cards = [
    { label: 'Net Realised P/L', value: fmtMoney(accounting.netRealisedPL, { sign: true }), tone: accounting.netRealisedPL > 0 ? 'success' : accounting.netRealisedPL < 0 ? 'danger' : undefined, icon: TrendingUp, sublabel: `Gross: ${fmtMoney(accounting.grossRealisedPL)}` },
    { label: 'Current Equity', value: fmtMoney(accounting.currentEquity), icon: Wallet },
    { label: 'Open Exposure', value: fmtMoney(accounting.totalOpenExposure), tone: accounting.totalOpenExposure > 0 ? 'warning' : undefined, icon: AlertCircle },
    { label: 'Available', value: fmtMoney(accounting.availableBankroll), icon: Banknote },
    { label: 'Settled Bets', value: String(settledCount), icon: CheckCircle2, sublabel: `${accounting.wonOrderCount || 0}W / ${accounting.lostOrderCount || 0}L` },
    { label: 'Validation', value: validationStatus.replace(/_/g, ' '), icon: ShieldCheck, tone: validationStatus === 'VALIDATED' ? 'success' : validationStatus === 'INSUFFICIENT_DATA' ? 'warning' : undefined },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(card => <MetricCard key={card.label} {...card} />)}
    </div>
  );
}