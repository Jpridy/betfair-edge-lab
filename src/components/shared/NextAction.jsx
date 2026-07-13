import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import useAuthoritativeTradingState from '@/hooks/useAuthoritativeTradingState';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle, Play, Wifi, Clock, CheckCircle2 } from 'lucide-react';

export default function NextAction() {
  const {
    apiConnected,
    botState,
    paperOrders,
    settlementRunning,
    runSettlementCheckNow,
  } = useApp();
  const accounting = usePortfolioAccountingDisplay();
  const liveState = useAuthoritativeTradingState();
  const botRunning = botState.running && !botState.paused;
  const awaitingResult = paperOrders.filter(order => {
    const status = String(order.status || '').toLowerCase();
    const settlementStatus = String(order.settlementStatus || '').toLowerCase();
    return ['matched', 'partially_matched', 'awaiting_result', 'result_unknown'].includes(status)
      || ['awaiting_result', 'result_unknown'].includes(settlementStatus);
  }).length;

  let action = {
    icon: CheckCircle2,
    label: 'No action needed',
    desc: 'The paper system is running normally.',
    to: null,
    onClick: null,
    tone: 'success',
  };

  if (accounting.accountingDataInconsistent) {
    action = {
      icon: AlertTriangle,
      label: 'Fix accounting inconsistency',
      desc: `${accounting.resolvedButStateInconsistentCount || 0} resolved order(s) need their settlement status repaired. P/L already includes their economic result.`,
      to: '/debug',
      onClick: null,
      tone: 'danger',
    };
  } else if (!apiConnected) {
    action = {
      icon: Wifi,
      label: 'Connect to Betfair',
      desc: 'Open Settings and connect a valid Betfair session before starting the paper bot.',
      to: '/settings',
      onClick: null,
      tone: 'warning',
    };
  } else if (liveState.priceFeedStatus !== 'LIVE') {
    action = {
      icon: Clock,
      label: liveState.priceFeedStatus === 'STALE' ? 'Refresh stale prices' : 'Wait for live prices',
      desc: liveState.priceFeedStatus === 'STALE'
        ? `The latest executable price is ${liveState.priceAgeSeconds ?? 'unknown'} seconds old.`
        : 'Market data is connected, but no fresh executable prices are available yet.',
      to: '/controls',
      onClick: null,
      tone: 'warning',
    };
  } else if (!botRunning && !botState.paused) {
    action = {
      icon: Play,
      label: 'Start Paper Bot',
      desc: 'The price feed is live and the paper bot is ready to scan.',
      to: '/controls',
      onClick: null,
      tone: 'info',
    };
  } else if (awaitingResult > 0 && !settlementRunning) {
    action = {
      icon: AlertTriangle,
      label: 'Check completed races',
      desc: `${awaitingResult} unresolved matched order(s) are waiting for a result. Future races will be skipped automatically.`,
      to: null,
      onClick: runSettlementCheckNow,
      tone: 'warning',
    };
  }

  const Icon = action.icon;
  const toneClass = action.tone === 'success'
    ? 'text-success'
    : action.tone === 'danger'
      ? 'text-danger'
      : action.tone === 'warning'
        ? 'text-warning'
        : 'text-info';

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
