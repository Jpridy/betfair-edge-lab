import React from 'react';
import { Shield, ShieldOff, Globe, Brain, WifiOff, HelpCircle, AlertTriangle, DollarSign } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';

function Banner({ icon: Icon, text, tone }) {
  const tones = {
    danger: 'bg-chart-5/15 border-chart-5/40 text-chart-5',
    warning: 'bg-chart-4/15 border-chart-4/40 text-chart-4',
    info: 'bg-chart-3/15 border-chart-3/40 text-chart-3',
    success: 'bg-chart-1/15 border-chart-1/40 text-chart-1',
  };
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold', tones[tone])}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export default function SafetyBanners() {
  const { apiConnected, betfairConnection, featherlessSettings, lastExchangeDiagnostics, paperOrders, settings } = useApp();

  const banners = [];

  // Paper mode active
  banners.push(<Banner key="paper" icon={Shield} text="PAPER MODE ACTIVE" tone="success" />);

  // Live betting disabled
  banners.push(<Banner key="live-off" icon={ShieldOff} text="LIVE BETTING DISABLED" tone="info" />);

  // Price feed stale
  if (!apiConnected || betfairConnection.dataFresh === false) {
    banners.push(<Banner key="stale" icon={WifiOff} text="PRICE FEED STALE — Connect Betfair for live data" tone="warning" />);
  }

  // OpenAI search not working
  if (featherlessSettings?.externalSearchEnabled) {
    const searchDiag = lastExchangeDiagnostics?.externalSearchDiagnostics;
    if (searchDiag && searchDiag.errors > 0) {
      banners.push(<Banner key="openai-err" icon={Globe} text={`OPENAI SEARCH ERRORS (${searchDiag.errors} this cycle)`} tone="danger" />);
    }
  } else if (!featherlessSettings?.externalSearchEnabled) {
    banners.push(<Banner key="openai-off" icon={Globe} text="OPENAI SEARCH NOT ENABLED" tone="warning" />);
  }

  // Featherless AI not working
  if (!featherlessSettings?.enabled) {
    banners.push(<Banner key="ai-off" icon={Brain} text="FEATHERLESS AI NOT ENABLED" tone="warning" />);
  } else {
    const aiError = lastExchangeDiagnostics?.aiStatusLog?.find(s => s.status === 'ai_error');
    if (aiError) {
      banners.push(<Banner key="ai-err" icon={Brain} text={`FEATHERLESS AI ERROR: ${aiError.reason || 'Unknown'}`} tone="danger" />);
    }
  }

  // Result unknown
  const awaitingResult = paperOrders.filter(o => o.status === 'awaiting_result').length;
  if (awaitingResult > 0) {
    banners.push(<Banner key="result-unknown" icon={HelpCircle} text={`${awaitingResult} ORDER(S) AWAITING RESULT`} tone="warning" />);
  }

  // LAY liability warning
  const layOrders = paperOrders.filter(o => o.side === 'LAY' && ['matched', 'partially_matched', 'pending', 'executable'].includes(o.status));
  if (layOrders.length > 0) {
    const totalLiability = layOrders.reduce((s, o) => s + (o.liability || 0), 0);
    banners.push(<Banner key="lay-liab" icon={DollarSign} text={`LAY LIABILITY ACTIVE: $${totalLiability.toFixed(2)} at risk`} tone="danger" />);
  }

  // Settings mismatch
  if (settings.riskLimitsDisabled) {
    banners.push(<Banner key="risk-off" icon={AlertTriangle} text="RISK LIMITS DISABLED — Testing mode active" tone="danger" />);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {banners}
    </div>
  );
}