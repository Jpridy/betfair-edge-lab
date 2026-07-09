import React from 'react';
import { Globe, Brain, WifiOff, HelpCircle, AlertTriangle, DollarSign, Clock, Settings2, FlaskConical } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';
import { buildSettingsWiringCheck } from '@/lib/wiringAudit';
import { isPaperProofModeActive } from '@/lib/paperProofDefaults';

const toneStyles = {
  danger: 'bg-danger/8 border-danger/25 text-danger',
  warning: 'bg-warning/8 border-warning/25 text-warning',
  info: 'bg-info/8 border-info/25 text-info',
  success: 'bg-success/8 border-success/25 text-success',
};

function Pill({ icon: Icon, text, tone }) {
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-body font-semibold tracking-label', toneStyles[tone])}>
      <Icon className="h-3 w-3 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export default function SafetyBanners() {
  const { apiConnected, betfairConnection, featherlessSettings, lastExchangeDiagnostics, paperOrders, settings, botSettings, botState } = useApp();

  const proofActive = isPaperProofModeActive(settings, botSettings, featherlessSettings);
  const botRunning = botState.running && !botState.paused;
  const pills = [];

  // Paper Proof Mode — compact pill
  if (proofActive) {
    pills.push(<Pill key="proof" icon={FlaskConical} text="Paper Proof Mode — filters relaxed" tone="warning" />);
  }

  // Risk limits relaxed — compact pill (only when proof mode active)
  if (settings.riskLimitsDisabled && proofActive) {
    pills.push(<Pill key="risk-off" icon={AlertTriangle} text="Risk limits relaxed for proof mode" tone="warning" />);
  }

  // Price feed stale — only when bot is running
  if (botRunning && (!apiConnected || betfairConnection.dataFresh === false)) {
    pills.push(<Pill key="stale" icon={WifiOff} text="Price feed stale — bot running without live data" tone="danger" />);
  }

  // Delayed API mode
  if (apiConnected && betfairConnection.streamConnectionStatus !== 'connected' && betfairConnection.streamConnectionStatus !== 'polling') {
    pills.push(<Pill key="delayed" icon={Clock} text="Delayed API mode" tone="warning" />);
  }

  // OpenAI search errors
  if (featherlessSettings?.externalSearchEnabled) {
    const searchDiag = lastExchangeDiagnostics?.externalSearchDiagnostics;
    if (searchDiag && searchDiag.errors > 0) {
      pills.push(<Pill key="openai-err" icon={Globe} text={`OpenAI search errors (${searchDiag.errors} this cycle)`} tone="danger" />);
    }
  }

  // AI errors
  if (featherlessSettings?.enabled) {
    const aiError = lastExchangeDiagnostics?.aiStatusLog?.find(s => s.status === 'ai_error');
    if (aiError) {
      pills.push(<Pill key="ai-err" icon={Brain} text={`AI error: ${aiError.reason || 'Unknown'}`} tone="danger" />);
    }
  }

  // Settlement result unknown for matched orders
  const matchedAwaiting = paperOrders.filter(o => o.status === 'awaiting_result');
  if (matchedAwaiting.length > 0) {
    pills.push(<Pill key="result-unknown" icon={HelpCircle} text={`${matchedAwaiting.length} order(s) awaiting result`} tone="warning" />);
  }

  // LAY liability active
  const layOrders = paperOrders.filter(o => o.side === 'LAY' && ['matched', 'partially_matched', 'pending', 'executable'].includes(o.status));
  if (layOrders.length > 0) {
    const totalLiability = layOrders.reduce((s, o) => s + (o.liability || 0), 0);
    pills.push(<Pill key="lay-liab" icon={DollarSign} text={`LAY liability: $${totalLiability.toFixed(2)} at risk`} tone="danger" />);
  }

  // Settings mismatch
  const wiringRows = buildSettingsWiringCheck(settings, featherlessSettings, botSettings);
  const mismatchCount = wiringRows.filter(r => r.status === 'mismatch' || r.status === 'missing').length;
  if (mismatchCount > 0) {
    pills.push(<Pill key="mismatch" icon={Settings2} text={`Settings mismatch — ${mismatchCount} setting(s) differ`} tone="warning" />);
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills}
    </div>
  );
}