import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge, SideBadge } from '@/components/ui/Trading';
import { cn } from '@/lib/utils';
import { Target, Ban, TrendingUp, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function LatestDecision() {
  const { botCycles, lastExchangeDiagnostics } = useApp();
  const lastCycle = botCycles[0];

  if (!lastCycle) {
    return (
      <Panel title="Latest Bot Decision">
        <div className="p-6 text-center text-sm text-muted-foreground">
          No bot cycles yet. Start the bot or click "Force Scan" to run a cycle.
        </div>
      </Panel>
    );
  }

  const best = lastCycle.bestCandidate;
  const topOpps = lastCycle.scanSummary?.topOpportunities || [];
  const topRejected = lastCycle.scanSummary?.topRejected || [];
  const bestOpp = best || topOpps[0] || topRejected[0];

  const decision = lastCycle.ordersCreated > 0 ? 'BET' : 'NO_BET';
  const blocker = lastCycle.noBetReason || best?.failedGate || best?.mainBlocker || best?.blockers?.[0] || null;

  // Build plain English reason
  let plainReason = '';
  if (decision === 'BET') {
    plainReason = `Bet placed: ${best?.side || 'BACK'} ${best?.runnerName || 'unknown'} in ${best?.marketName || lastCycle.selectedMarketName || 'unknown market'} at odds ${best?.odds?.toFixed(2) || '—'}.`;
  } else if (blocker) {
    plainReason = `No bet placed because ${blocker}.`;
    if (bestOpp) {
      plainReason += ` The best opportunity was ${bestOpp.side} ${bestOpp.runnerName} at ${bestOpp.odds?.toFixed(2) || '—'} odds with ${(bestOpp.edge || 0).toFixed(2)}% edge.`;
    }
  } else if (lastCycle.scanSummary?.totalOpportunities === 0) {
    plainReason = 'No bet placed because no opportunities were generated. Check market data connection and time windows.';
  } else {
    plainReason = `No bet placed. ${lastCycle.notes || 'Cycle completed without placing an order.'}`;
  }

  return (
    <Panel
      title="Latest Bot Decision"
      action={
        <StatusBadge status={decision === 'BET' ? 'ok' : 'warning'}>
          {decision}
        </StatusBadge>
      }
    >
      <div className="p-4 space-y-4">
        {/* Plain English reason */}
        <div className={cn(
          'rounded-lg p-3 text-sm',
          decision === 'BET' ? 'bg-chart-1/10 text-chart-1' : 'bg-chart-4/10 text-chart-4'
        )}>
          {plainReason}
        </div>

        {/* Selected/Best opportunity details */}
        {bestOpp && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Detail label="Event" value={bestOpp.eventName || bestOpp.marketName || '—'} />
            <Detail label="Market Type" value={bestOpp.marketType || bestOpp.detectedMarketType || '—'} />
            <Detail label="Runner" value={bestOpp.runnerName || '—'} />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Side</span>
              <SideBadge side={bestOpp.side || 'BACK'} />
            </div>
            <Detail label="Odds" value={bestOpp.odds?.toFixed(2) || '—'} mono />
            <Detail label="Stake" value={`$${(bestOpp.stake || 0).toFixed(2)}`} mono />
            <Detail label="Liability" value={`$${(bestOpp.liability || 0).toFixed(2)}`} mono />
            <Detail label="Max Profit" value={`$${(bestOpp.maxProfit || 0).toFixed(2)}`} mono />
            <Detail label="Max Loss" value={`$${(bestOpp.maxLoss || 0).toFixed(2)}`} mono />
            <Detail label="EV" value={`$${(bestOpp.ev || 0).toFixed(2)}`} mono accent="chart-1" />
            <Detail label="ROI" value={`${((bestOpp.roi || bestOpp.expectedROI || 0) * 100).toFixed(1)}%`} mono accent="chart-1" />
            <Detail label="Confidence" value={`${(bestOpp.confidence || 0).toFixed(0)}`} mono />
            <Detail label="Model Prob" value={`${((bestOpp.modelProbability || bestOpp.estimatedProbability || 0) * 100).toFixed(1)}%`} mono />
          </div>
        )}

        {/* Blocker */}
        {blocker && decision === 'NO_BET' && (
          <div className="flex items-start gap-2 text-xs bg-chart-5/10 text-chart-5 rounded-lg p-3">
            <Ban className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Blocked by: {blocker}</div>
              {bestOpp?.blockers?.length > 1 && (
                <div className="mt-1 text-[10px] opacity-80">All blockers: {bestOpp.blockers.join('; ')}</div>
              )}
            </div>
          </div>
        )}

        {/* Cycle stats */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <CycleStat label="Markets" value={lastCycle.marketsScanned || 0} icon={Target} />
          <CycleStat label="Passed" value={lastCycle.marketsPassedFilters || 0} icon={CheckCircle2} />
          <CycleStat label="Signals" value={lastCycle.signalsCreated || 0} icon={TrendingUp} />
          <CycleStat label="Blocked" value={lastCycle.ordersBlocked || 0} icon={ShieldAlert} />
        </div>
      </div>
    </Panel>
  );
}

function Detail({ label, value, mono, accent }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn(
        'text-sm font-semibold',
        mono && 'font-mono',
        accent === 'chart-1' && 'text-chart-1',
        accent === 'chart-5' && 'text-chart-5',
        !accent && 'text-foreground'
      )}>
        {value}
      </div>
    </div>
  );
}

function CycleStat({ label, value, icon: Icon }) {
  return (
    <div className="bg-muted/30 rounded-lg p-2 text-center">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
      <div className="text-lg font-bold font-mono text-foreground">{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}