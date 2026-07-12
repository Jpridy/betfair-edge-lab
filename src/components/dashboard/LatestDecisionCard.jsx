import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, LiveStatusBadge } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { SideBadge } from '@/components/ui/Trading';
import { fmtMoney, fmtOdds, fmtPct, fmtProb, fmtAge, plClass } from '@/lib/format';
import { CheckCircle2, Ban, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

const GATE_PLAIN_LANGUAGE = {
  NON_POSITIVE_EV: 'The model did not find enough value',
  STALE_PRICE_DATA: 'Price data is too old',
  DUPLICATE_RACE_EXPOSURE: 'Another paper bet already exists for this race',
  ODDS_OUTSIDE_RANGE: 'Odds are outside the allowed range',
  INSUFFICIENT_LIQUIDITY: 'Not enough liquidity at best price',
  SPREAD_TOO_WIDE: 'The spread between back and lay prices is too wide',
  EDGE_BELOW_THRESHOLD: 'Edge too small',
  ROI_BELOW_THRESHOLD: 'Expected return too low',
  CONFIDENCE_BELOW_THRESHOLD: 'Model confidence too low',
  MAX_EXPOSURE_REACHED: 'Maximum exposure limit reached',
  MAX_OPEN_ORDERS: 'Too many open orders',
  DAILY_LOSS_LIMIT_REACHED: 'Daily loss limit reached',
  MAX_DRAWDOWN_REACHED: 'Maximum drawdown reached',
  LOSING_STREAK_REACHED: 'Losing streak limit reached',
  AUTO_PAPER_ORDERING_PAUSED: 'Automatic paper ordering is paused',
  AI_REQUIRED_BUT_NOT_AVAILABLE: 'AI model is required but not available',
  ORDER_AUTHORITY_REJECTED: 'Order validation failed',
  NO_MARKETS_LOADED: 'No markets are loaded',
  NO_CANDIDATES: 'No betting candidates found',
  EMERGENCY_STOP_ACTIVE: 'Emergency stop is active',
};

function plainGate(gate) {
  if (!gate) return 'No specific reason available';
  return GATE_PLAIN_LANGUAGE[gate] || gate.replace(/_/g, ' ').toLowerCase();
}

function Detail({ label, value, mono, tone }) {
  return (
    <div>
      <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${mono ? 'font-mono tabular-nums' : ''} ${tone || 'text-foreground'}`}>{value}</div>
    </div>
  );
}

export default function LatestDecisionCard() {
  const { botCycles } = useApp();
  const [showDetails, setShowDetails] = useState(false);
  const lastCycle = botCycles[0];

  if (!lastCycle) {
    return (
      <Panel title="Latest Decision" action={<LiveStatusBadge status="UNAVAILABLE" />}>
        <div className="p-8 text-center text-sm text-muted-foreground">No bot cycles yet. Start the bot or run a scan.</div>
      </Panel>
    );
  }

  const decision = lastCycle.ordersCreated > 0 ? 'BET' : 'NO_BET';
  const best = lastCycle.bestCandidate;
  const blocker = lastCycle.noBetReason || best?.failedGate || best?.mainBlocker || best?.blockers?.[0];
  const plainReason = decision === 'BET'
    ? `Bet placed: ${best?.side || ''} ${best?.runnerName || 'unknown'} at odds ${fmtOdds(best?.odds)}.`
    : `No bet: ${plainGate(blocker)}`;

  return (
    <Panel
      title="Latest Decision"
      subtitle={`Cycle #${lastCycle.cycleNumber} · ${fmtAge(lastCycle.finishedAt || lastCycle.startedAt)}`}
      action={
        <div className={`rounded-md border px-2 py-0.5 text-[10px] font-body font-semibold tracking-label ${decision === 'BET' ? 'bg-success/10 text-success border-success/25' : 'bg-warning/10 text-warning border-warning/25'}`}>
          {decision === 'BET' ? <><CheckCircle2 className="inline h-3 w-3 mr-1" />Bet</> : <><Ban className="inline h-3 w-3 mr-1" />No Bet</>}
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div className={`rounded-lg p-3 text-sm font-body border ${decision === 'BET' ? 'bg-success/8 text-success border-success/20' : 'bg-warning/8 text-warning border-warning/20'}`}>
          {plainReason}
        </div>

        {best && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label mb-0.5">Runner</div>
              <div className="text-sm font-semibold text-foreground truncate">{best.runnerName || '—'}</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label mb-0.5">Side</div>
              <SideBadge side={best.side || 'BACK'} />
            </div>
            <Detail label="Odds" value={fmtOdds(best.odds)} mono />
            <Detail label="Stake" value={fmtMoney(best.stake)} mono />
            <Detail label="Liability" value={fmtMoney(best.liability)} mono />
            <Detail label="EV" value={fmtMoney(best.ev)} mono tone={plClass(best.ev)} />
            <Detail label="ROI" value={fmtPct((best.roi || best.expectedROI || 0) * 100)} mono tone={plClass(best.roi || best.expectedROI)} />
            <Detail label="Model Prob" value={fmtProb(best.modelProbability || best.estimatedProbability)} mono />
          </div>
        )}

        {showDetails && best && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border-subtle">
            <Detail label="Breakeven Prob" value={fmtProb(best.breakevenProbability || best.impliedProbability)} mono />
            <Detail label="Edge" value={fmtPct((best.edge || 0) * 100)} mono />
            <Detail label="Confidence" value={fmtPct(best.confidence)} mono />
            <Detail label="Max Profit" value={fmtMoney(best.maxProfit)} mono tone="text-success" />
            <Detail label="Max Loss" value={fmtMoney(best.maxLoss)} mono tone="text-danger" />
            <Detail label="Decision Source" value={best.decisionSource || '—'} />
            <Detail label="Market Type" value={best.marketType || best.detectedMarketType || '—'} />
            <Detail label="Spread" value={`${best.spreadTicks ?? best.spread ?? '—'} ticks`} mono />
          </div>
        )}

        {showDetails && decision === 'NO_BET' && blocker && (
          <div className="rounded-lg p-3 text-xs bg-muted/30 border border-border-subtle">
            <div className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-label mb-1">Technical code</div>
            <code className="font-mono text-warning">{blocker}</code>
            {best?.blockers?.length > 1 && (
              <div className="mt-2 text-[11px] text-muted-foreground">All blockers: {best.blockers.join('; ')}</div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? <><ChevronUp className="h-3.5 w-3.5" /> Hide details</> : <><ChevronDown className="h-3.5 w-3.5" /> See Why</>}
          </Button>
        </div>
      </div>
    </Panel>
  );
}