import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle, Play, Wifi, Clock, CheckCircle2, FlaskConical } from 'lucide-react';

export default function NextAction() {
  const { apiConnected, botState, betfairConnection, paperOrders, settlementRunning, runSettlementCheckNow } = useApp();
  const accounting = usePortfolioAccountingDisplay();
  const botRunning = botState.running && !botState.paused;
  const hasPrices = betfairConnection?.lastActualPriceUpdateAt != null;
  const awaitingResult = paperOrders.filter(o => o.status === 'awaiting_result').length;
  const openOrders = paperOrders.filter(o => ['matched', 'partially_matched', 'pending', 'executable'].includes(o.status)).length;

  let action = { icon: CheckCircle2, label: 'No action needed', desc: 'The system is running normally.', to: null, onClick: null, tone: 'success' };

  if (!apiConnected) {
    action = { icon: Wifi, label: 'Connect to Betfair', desc: 'Paste your session token in Settings to load live market data.', to: '/settings', onClick: null, tone: 'warning' };
  } else if (!hasPrices) {
    action = { icon: Clock, label: 'Wait for live prices', desc: 'Markets are loading. Prices will appear shortly.', to: null, onClick: null, tone: 'warning' };
  } else if (!botRunning && !botState.paused) {
    action = { icon: Play, label: 'Start Paper Bot', desc: 'Bot is stopped. Start scanning for betting opportunities.', to: '/controls', onClick: null, tone: 'info' };
  } else if (awaitingResult > 0 && !settlementRunning) {
    action = { icon: AlertTriangle, label: 'Settle completed race', desc: `${awaitingResult} order(s) waiting for settlement.`, to: null, onClick: runSettlementCheckNow, tone: 'warning' };
  } else if (accounting.reconciliationFailed) {
    action = { icon: AlertTriangle, label: 'Fix accounting inconsistency', desc: 'Accounting data is inconsistent. Review in Debug > Accounting.', to: '/debug', onClick: null, tone: 'danger' };
  }

  const Icon = action.icon;
  const toneClass = action.tone === 'success' ? 'text-success' : action.tone === 'danger' ? 'text-danger' : action.tone === 'warning' ? 'text-warning' : 'text-info';

  return (
    <Panel>
      <div className="flex items-center gap-4 p-4">
        <div className={`shrink-0 rounded-lg p-3 ${action.tone === 'success' ? 'bg-success/10' : action.tone === 'danger' ? 'bg-danger/10' : action.tone === 'warning' ? 'bg-warning/10' : 'bg-info/10'}`}>
          <Icon className={`h-6 w-6 ${toneClass}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">Next Action</div>
          <div className="text-base font-heading font-semibold text-foreground">{action.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{action.desc}</div>
        </div>
        {(action.to || action.onClick) && (
          action.to ? (
            <Button asChild size="sm" variant={action.tone === 'danger' ? 'destructive' : 'default'} className="shrink-0">
              <Link to={action.to}>Go <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          ) : (
            <Button size="sm" variant={action.tone === 'danger' ? 'destructive' : 'default'} onClick={action.onClick} className="shrink-0">
              Run Now <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )
        )}
      </div>
    </Panel>
  );
}