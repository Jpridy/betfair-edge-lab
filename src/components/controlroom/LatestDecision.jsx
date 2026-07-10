import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge, SideBadge } from '@/components/ui/Trading';
import { cn } from '@/lib/utils';
import { Target, Ban, TrendingUp, ShieldAlert, CheckCircle2, WifiOff } from 'lucide-react';

export default function LatestDecision() {
  const { botCycles, lastExchangeDiagnostics, apiConnected, markets, runners } = useApp();
  const lastCycle = botCycles[0];

  if (!lastCycle) {
    let message = 'No bot cycles yet. Start the bot or click "Debug Scan" to run a diagnostic cycle.';
    if (!apiConnected) {
      message = 'No markets loaded. Betfair session is not connected. Paste a session token or complete login to load live market data.';
    } else if (markets.length === 0) {
      message = 'Markets loaded but no market data received. Check stream/price feed connection.';
    } else if (!runners.some(r => r.bestBackPrice || r.bestLayPrice)) {
      message = 'Markets loaded but no runner prices received. Check stream/price feed connection.';
    }
    return (
      <Panel title="Latest Bot Decision" action={<StatusBadge status="neutral">No cycle yet</StatusBadge>}>
        <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
          <WifiOff className="h-8 w-8 text-muted-foreground/40" />
          <span className="font-body">{message}</span>
        </div>
      </Panel>
    );
  }

  const best = lastCycle.bestCandidate;
  const topOpps = lastCycle.scanSummary?.topOpportunities || [];
  const topRejected = lastCycle.scanSummary?.topRejected || [];
  const bestOpp = best || topOpps[0] || topRejected[0];

  // Detect stale cycle — ran when 0 markets were loaded, but markets are now available
  const cycleSawZeroMarkets = (lastCycle.marketsScanned || 0) === 0 && (lastCycle.scanSummary?.totalMarketsLoaded || 0) === 0;
  const marketsNowLoaded = markets.length > 0;
  const isStaleCycle = cycleSawZeroMarkets && marketsNowLoaded;

  const decision = lastCycle.ordersCreated > 0 ? 'BET' : 'NO_BET';
  const blocker = lastCycle.noBetReason || best?.failedGate || best?.mainBlocker || best?.blockers?.[0] || null;

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
          {decision === 'BET' ? 'Bet' : 'No bet'}
        </StatusBadge>
      }
    >
      <div className="p-5 space-y-4">
        {/* Stale cycle banner */}
        {isStaleCycle && (
          <div className="flex items-start gap-2.5 text-xs bg-info/8 text-info border border-info/20 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-body font-semibold">Markets are now loaded ({markets.length} in memory) — this cycle ran before data was available.</div>
              <div className="mt-0.5 text-[10px] opacity-80 font-body">Click "Debug Scan" or start the bot to run a fresh scan against live market data.</div>
            </div>
          </div>
        )}

        {/* Plain English reason — hide when stale (banner already explains) */}
        {!isStaleCycle && (
        <div className={cn(
          'rounded-lg p-4 text-sm font-body border',
          decision === 'BET' ? 'bg-success/8 text-success border-success/20' : 'bg-warning/8 text-warning border-warning/20'
        )}>
          {plainReason}
        </div>
        )}

        {/* Best opportunity details */}
        {bestOpp && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <Detail label="Event" value={bestOpp.eventName || bestOpp.marketName || '—'} />
            <Detail label="Market Type" value={bestOpp.marketType || bestOpp.detectedMarketType || '—'} />
            <Detail label="Runner" value={bestOpp.runnerName || '—'} />
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label">Side</div>
              <SideBadge side={bestOpp.side || 'BACK'} />
            </div>
            <Detail label="Odds" value={bestOpp.odds?.toFixed(2) || '—'} mono />
            <Detail label="Stake" value={`$${(bestOpp.stake || 0).toFixed(2)}`} mono />
            <Detail label="Liability" value={`$${(bestOpp.liability || 0).toFixed(2)}`} mono />
            <Detail label="Max Profit" value={`$${(bestOpp.maxProfit || 0).toFixed(2)}`} mono />
            <Detail label="Max Loss" value={`$${(bestOpp.maxLoss || 0).toFixed(2)}`} mono />
            <Detail label="EV" value={`$${(bestOpp.ev || 0).toFixed(2)}`} mono accent="success" />
            <Detail label="ROI" value={`${((bestOpp.roi || bestOpp.expectedROI || 0) * 100).toFixed(1)}%`} mono accent="success" />
            <Detail label="Confidence" value={`${(bestOpp.confidence || 0).toFixed(0)}`} mono />
            <Detail label="Model Prob" value={`${((bestOpp.modelProbability || bestOpp.estimatedProbability || 0) * 100).toFixed(1)}%`} mono />
          </div>
        )}

        {/* Blocker — hide when stale */}
        {blocker && decision === 'NO_BET' && !isStaleCycle && (
          <div className="flex items-start gap-2.5 text-xs bg-danger/8 text-danger border border-danger/20 rounded-lg p-3">
            <Ban className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-body font-semibold">Blocked by: {blocker}</div>
              {bestOpp?.blockers?.length > 1 && (
                <div className="mt-1 text-[10px] opacity-80 font-body">All blockers: {bestOpp.blockers.join('; ')}</div>
              )}
            </div>
          </div>
        )}

        {/* Cycle stats */}
        <div className="grid grid-cols-4 gap-2.5">
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
      <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label mb-1">{label}</div>
      <div className={cn(
        'text-sm font-semibold',
        mono && 'font-mono tabular-nums',
        accent === 'success' && 'text-success',
        accent === 'danger' && 'text-danger',
        !accent && 'text-foreground'
      )}>
        {value}
      </div>
    </div>
  );
}

function CycleStat({ label, value, icon: Icon }) {
  return (
    <div className="bg-muted/30 border border-border-subtle rounded-lg p-2.5 text-center">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
      <div className="text-lg font-heading font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-label font-body">{label}</div>
    </div>
  );
}