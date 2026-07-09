import React from 'react';
import { Shield, ShieldOff, Globe, Brain, WifiOff, HelpCircle, AlertTriangle, DollarSign, Clock, Settings2 } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';
import { buildSettingsWiringCheck } from '@/lib/wiringAudit';

const toneStyles = {
  danger: 'bg-danger/8 border-danger/25 text-danger',
  warning: 'bg-warning/8 border-warning/25 text-warning',
  info: 'bg-info/8 border-info/25 text-info',
  success: 'bg-success/8 border-success/25 text-success',
};

function Banner({ icon: Icon, text, tone }) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md border text-[11px] font-body font-semibold tracking-label', toneStyles[tone])}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export default function SafetyBanners() {
  const { apiConnected, betfairConnection, featherlessSettings, lastExchangeDiagnostics, paperOrders, settings, botSettings } = useApp();

  const banners = [];

  banners.push(<Banner key="paper" icon={Shield} text="PAPER MODE ACTIVE" tone="success" />);
  banners.push(<Banner key="live-off" icon={ShieldOff} text="LIVE BETTING DISABLED" tone="info" />);

  if (!apiConnected || betfairConnection.dataFresh === false) {
    banners.push(<Banner key="stale" icon={WifiOff} text="PRICE FEED STALE — Connect Betfair for live data" tone="warning" />);
  }

  if (apiConnected && betfairConnection.streamConnectionStatus !== 'connected' && betfairConnection.streamConnectionStatus !== 'polling') {
    banners.push(<Banner key="delayed" icon={Clock} text={`DELAYED API MODE — Stream: ${betfairConnection.streamConnectionStatus}`} tone="warning" />);
  }

  if (featherlessSettings?.externalSearchEnabled) {
    const searchDiag = lastExchangeDiagnostics?.externalSearchDiagnostics;
    if (searchDiag && searchDiag.errors > 0) {
      banners.push(<Banner key="openai-err" icon={Globe} text={`OPENAI SEARCH ERRORS (${searchDiag.errors} this cycle)`} tone="danger" />);
    }
  } else if (!featherlessSettings?.externalSearchEnabled) {
    banners.push(<Banner key="openai-off" icon={Globe} text="OPENAI SEARCH NOT ENABLED" tone="warning" />);
  }

  if (!featherlessSettings?.enabled) {
    banners.push(<Banner key="ai-off" icon={Brain} text="FEATHERLESS AI NOT ENABLED" tone="warning" />);
  } else {
    const aiError = lastExchangeDiagnostics?.aiStatusLog?.find(s => s.status === 'ai_error');
    if (aiError) {
      banners.push(<Banner key="ai-err" icon={Brain} text={`FEATHERLESS AI ERROR: ${aiError.reason || 'Unknown'}`} tone="danger" />);
    }
  }

  const awaitingResult = paperOrders.filter(o => o.status === 'awaiting_result').length;
  if (awaitingResult > 0) {
    banners.push(<Banner key="result-unknown" icon={HelpCircle} text={`${awaitingResult} ORDER(S) AWAITING RESULT`} tone="warning" />);
  }

  const layOrders = paperOrders.filter(o => o.side === 'LAY' && ['matched', 'partially_matched', 'pending', 'executable'].includes(o.status));
  if (layOrders.length > 0) {
    const totalLiability = layOrders.reduce((s, o) => s + (o.liability || 0), 0);
    banners.push(<Banner key="lay-liab" icon={DollarSign} text={`LAY LIABILITY ACTIVE: $${totalLiability.toFixed(2)} at risk`} tone="danger" />);
  }

  const wiringRows = buildSettingsWiringCheck(settings, featherlessSettings, botSettings);
  const mismatchCount = wiringRows.filter(r => r.status === 'mismatch' || r.status === 'missing').length;
  if (mismatchCount > 0) {
    banners.push(<Banner key="mismatch" icon={Settings2} text={`SETTINGS MISMATCH — ${mismatchCount} setting(s) differ between saved and bot-used values`} tone="danger" />);
  }

  if (settings.riskLimitsDisabled) {
    banners.push(<Banner key="risk-off" icon={AlertTriangle} text="RISK LIMITS DISABLED — Testing mode active" tone="danger" />);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {banners}
    </div>
  );
}