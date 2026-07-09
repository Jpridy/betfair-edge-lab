import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { cn } from '@/lib/utils';
import { resolveMarketTypeThresholds } from '@/lib/crossMarketValueScanner';

function SettingRow({ label, savedValue, botValue, oppValue, passed, blockedCount, hint }) {
  const mismatch = String(savedValue) !== String(botValue);
  return (
    <div className="grid grid-cols-6 gap-2 items-center px-3 py-1.5 border-b border-border text-xs">
      <div className="col-span-2">
        <div className="font-medium text-foreground">{label}</div>
        {hint && <div className="text-[9px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="font-mono text-muted-foreground">{savedValue ?? '—'}</div>
      <div className={cn('font-mono', mismatch ? 'text-danger' : 'text-foreground')}>{botValue ?? '—'}</div>
      <div className={cn('font-mono', oppValue != null ? (passed ? 'text-success' : 'text-danger') : 'text-muted-foreground')}>{oppValue ?? '—'}</div>
      <div className="flex items-center gap-1.5">
        <StatusBadge status={passed ? 'ok' : 'danger'}>{passed ? 'PASS' : 'FAIL'}</StatusBadge>
        {blockedCount > 0 && <span className="text-[9px] text-danger">({blockedCount} blocked)</span>}
      </div>
    </div>
  );
}

export default function SettingsImpactPanel() {
  const { settings, featherlessSettings, botSettings, botCycles, lastExchangeDiagnostics } = useApp();

  const lastCycle = botCycles[0];
  const bestOpp = lastCycle?.bestCandidate || lastExchangeDiagnostics?.topOpportunities?.[0] || null;
  const allOpps = lastExchangeDiagnostics?.topOpportunities || lastCycle?.scanSummary?.topOpportunities || [];
  const rejectedOpps = lastExchangeDiagnostics?.topRejected || lastCycle?.scanSummary?.topRejected || [];

  const marketType = bestOpp?.marketType || bestOpp?.detectedMarketType || 'WIN';
  const thresholds = resolveMarketTypeThresholds(marketType, featherlessSettings);

  // Count blocked by each setting
  const countBlocked = (checkFn) => [...allOpps, ...rejectedOpps].filter(o => !checkFn(o)).length;

  const rows = [
    {
      label: 'Min Edge', savedValue: thresholds.minEdge, botValue: thresholds.minEdge,
      oppValue: bestOpp?.edge?.toFixed(2), passed: bestOpp ? bestOpp.edge >= thresholds.minEdge : null,
      blockedCount: countBlocked(o => (o.edge || 0) >= thresholds.minEdge),
      hint: `Required edge for ${marketType} markets`,
    },
    {
      label: 'Min ROI', savedValue: thresholds.minROI, botValue: thresholds.minROI,
      oppValue: bestOpp ? ((bestOpp.roi || bestOpp.expectedROI || 0) * 100).toFixed(1) : null,
      passed: bestOpp ? (bestOpp.roi || bestOpp.expectedROI || 0) * 100 >= thresholds.minROI : null,
      blockedCount: countBlocked(o => (o.roi || o.expectedROI || 0) * 100 >= thresholds.minROI),
      hint: `Required ROI for ${marketType} markets`,
    },
    {
      label: 'Min Liquidity', savedValue: thresholds.minLiquidity, botValue: thresholds.minLiquidity,
      oppValue: bestOpp?.availableSize?.toFixed(0) || bestOpp?.liquidity?.toFixed(0),
      passed: bestOpp ? (bestOpp.availableSize || bestOpp.liquidity || 0) >= thresholds.minLiquidity : null,
      blockedCount: countBlocked(o => (o.availableSize || o.liquidity || 0) >= thresholds.minLiquidity),
      hint: 'Minimum available size at best price',
    },
    {
      label: 'Max Spread (ticks)', savedValue: thresholds.maxSpreadTicks || thresholds.maxSpread, botValue: thresholds.maxSpreadTicks || thresholds.maxSpread,
      oppValue: bestOpp?.spreadTicks || bestOpp?.spread,
      passed: bestOpp ? (bestOpp.spreadTicks || bestOpp.spread || 0) <= (thresholds.maxSpreadTicks || thresholds.maxSpread || 99) : null,
      blockedCount: countBlocked(o => (o.spreadTicks || o.spread || 0) <= (thresholds.maxSpreadTicks || thresholds.maxSpread || 99)),
      hint: 'Maximum back/lay spread',
    },
    {
      label: 'Min Confidence', savedValue: featherlessSettings?.minConfidence, botValue: featherlessSettings?.minConfidence,
      oppValue: bestOpp?.confidence?.toFixed(0),
      passed: bestOpp ? (bestOpp.confidence || 0) >= (featherlessSettings?.minConfidence || 0) : null,
      blockedCount: countBlocked(o => (o.confidence || 0) >= (featherlessSettings?.minConfidence || 0)),
      hint: 'Minimum AI confidence score',
    },
    {
      label: 'Min Odds', savedValue: thresholds.minOdds, botValue: thresholds.minOdds,
      oppValue: bestOpp?.odds?.toFixed(2),
      passed: bestOpp ? (bestOpp.odds || 0) >= thresholds.minOdds : null,
      blockedCount: countBlocked(o => (o.odds || 0) >= thresholds.minOdds),
      hint: `Minimum odds for ${marketType} markets`,
    },
    {
      label: 'Max Odds', savedValue: thresholds.maxOdds, botValue: thresholds.maxOdds,
      oppValue: bestOpp?.odds?.toFixed(2),
      passed: bestOpp ? (bestOpp.odds || 0) <= thresholds.maxOdds : null,
      blockedCount: countBlocked(o => (o.odds || 0) <= thresholds.maxOdds),
      hint: `Maximum odds for ${marketType} markets`,
    },
    {
      label: 'Max Stake', savedValue: settings.maxStake, botValue: settings.maxStake,
      oppValue: bestOpp?.stake?.toFixed(0),
      passed: bestOpp ? (bestOpp.stake || 0) <= (settings.maxStake || 500) : null,
      blockedCount: 0, hint: 'Maximum stake per order',
    },
    {
      label: 'Max Lay Liability', savedValue: settings.maxLayLiability, botValue: settings.maxLayLiability,
      oppValue: bestOpp?.liability?.toFixed(0),
      passed: bestOpp ? (bestOpp.liability || 0) <= (settings.maxLayLiability || 1500) : null,
      blockedCount: 0, hint: 'Maximum LAY liability',
    },
    {
      label: 'Time Window Start (s)', savedValue: settings.defaultTimeWindowStartSeconds, botValue: settings.defaultTimeWindowStartSeconds,
      oppValue: null, passed: null, blockedCount: 0, hint: 'Seconds before race start to begin scanning',
    },
    {
      label: 'Time Window End (s)', savedValue: settings.defaultTimeWindowEndSeconds, botValue: settings.defaultTimeWindowEndSeconds,
      oppValue: null, passed: null, blockedCount: 0, hint: 'Seconds before race start to stop scanning',
    },
    {
      label: 'Featherless AI', savedValue: featherlessSettings?.enabled ? 'On' : 'Off', botValue: featherlessSettings?.enabled ? 'On' : 'Off',
      oppValue: null, passed: null, blockedCount: 0, hint: 'AI probability engine',
    },
    {
      label: 'Debug Scan Mode', savedValue: featherlessSettings?.debugScanMode ? 'On' : 'Off', botValue: featherlessSettings?.debugScanMode ? 'On' : 'Off',
      oppValue: null, passed: null, blockedCount: 0, hint: 'Scan all markets regardless of time window',
    },
  ];

  // Impact preview
  const impactPreviews = [];
  if (bestOpp && bestOpp.edge != null && bestOpp.edge < thresholds.minEdge) {
    impactPreviews.push(`If min edge was lowered from ${thresholds.minEdge}% to ${(bestOpp.edge - 0.01).toFixed(2)}%, this opportunity would have passed edge.`);
  }
  if (bestOpp && bestOpp.availableSize != null && bestOpp.availableSize < thresholds.minLiquidity) {
    impactPreviews.push(`If min liquidity was lowered from $${thresholds.minLiquidity} to $${Math.floor(bestOpp.availableSize)}, this opportunity would have passed liquidity.`);
  }
  if (bestOpp && bestOpp.odds != null && bestOpp.odds < thresholds.minOdds) {
    impactPreviews.push(`If min odds was lowered from ${thresholds.minOdds} to ${bestOpp.odds.toFixed(2)}, this opportunity would have passed odds.`);
  }
  const liquidityBlocked = countBlocked(o => (o.availableSize || o.liquidity || 0) < thresholds.minLiquidity);
  if (liquidityBlocked > 1) {
    impactPreviews.push(`If min liquidity was lowered from $${thresholds.minLiquidity} to $${Math.max(1, thresholds.minLiquidity / 2)}, ${liquidityBlocked} more opportunities would have passed.`);
  }

  return (
    <Panel title={`Settings Impact (Market Type: ${marketType})`}>
      {/* Header */}
      <div className="grid grid-cols-6 gap-2 px-3 py-1.5 bg-muted/30 border-b border-border text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
        <div className="col-span-2">Setting</div>
        <div>Saved</div>
        <div>Bot Uses</div>
        <div>Best Opp</div>
        <div>Result</div>
      </div>

      {/* Rows */}
      {rows.map((r, i) => <SettingRow key={i} {...r} />)}

      {/* Impact preview */}
      {impactPreviews.length > 0 && (
        <div className="p-3 space-y-1.5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Impact Preview (does not change settings)</div>
          {impactPreviews.map((p, i) => (
            <div key={i} className="text-xs text-info bg-info/5 rounded px-2 py-1">{p}</div>
          ))}
        </div>
      )}
    </Panel>
  );
}