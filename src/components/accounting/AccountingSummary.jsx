import React from 'react';
import { AlertTriangle } from 'lucide-react';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import useAccountingRepair from '@/hooks/useAccountingRepair';
import { Button } from '@/components/ui/button';
const money=value=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value);
const definitions={
  'Gross Winnings':'Positive gross results from settled winning orders.',
  'Gross Losses':'Negative gross results from settled losing orders.',
  'Gross P/L Before Commission':'Gross winnings plus gross losses.',
  'Commission Paid':'Commission charged only on profitable settled results.',
  'Net Realised P/L':'Gross realised P/L less commission.',
  'Current Equity':'Starting bankroll plus net realised P/L.',
  'Open Exposure':'Capital reserved by unresolved orders.',
  'Available Bankroll':'Current equity less open exposure.'
};
export default function AccountingSummary(){const a=usePortfolioAccountingDisplay();const {repair,repairing,canRepair}=useAccountingRepair();if(!a.accountingReconciliationPassed)return <div className="flex items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>ACCOUNTING DATA INCONSISTENT</span>{canRepair&&<Button size="sm" variant="destructive" disabled={repairing} onClick={repair}>{repairing?'Repairing…':'Repair settlement state'}</Button>}</div>;const rows=[['Gross Winnings',a.grossWinnings],['Gross Losses',a.grossLosses],['Gross P/L Before Commission',a.grossRealisedPL],['Commission Paid',-a.commissionPaid],['Net Realised P/L',a.netRealisedPL],['Current Equity',a.currentEquity],['Open Exposure',a.totalOpenExposure],['Available Bankroll',a.availableBankroll]];return <section aria-label="Portfolio accounting"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{rows.map(([label,value])=><div key={label} title={definitions[label]} className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] uppercase tracking-label text-muted-foreground">{label}</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{money(value)}</div></div>)}</div><div className="mt-2 text-right text-[10px] text-muted-foreground">{a.wonOrderCount} wins · {a.lostOrderCount} losses · Generated {new Date(a.generatedAt).toLocaleString('en-AU')}</div></section>}