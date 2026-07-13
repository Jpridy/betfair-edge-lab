import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, LiveStatusBadge } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { SideBadge } from '@/components/ui/Trading';
import { fmtMoney, fmtOdds, fmtPct, fmtProb, fmtAge, plClass } from '@/lib/format';
import { CheckCircle2, Ban, ChevronDown, ChevronUp } from 'lucide-react';

const GATE_PLAIN_LANGUAGE = {
  NON_POSITIVE_EV: 'the model did not find enough value',
  NON_POSITIVE_ROI: 'the expected return was not positive',
  STALE_PRICE_DATA: 'price data is too old',
  DUPLICATE_RACE_EXPOSURE: 'another paper bet already exists for this race',
  ODDS_OUTSIDE_RANGE: 'odds are outside the allowed range',
  ODDS_OUTSIDE_MARKET_RANGE: 'odds are outside the allowed range',
  INSUFFICIENT_LIQUIDITY: 'not enough liquidity is available at the current price',
  LIQUIDITY_BELOW_MINIMUM: 'not enough liquidity is available at the current price',
  SPREAD_TOO_WIDE: 'the spread between BACK and LAY prices is too wide',
  EDGE_BELOW_THRESHOLD: 'the commission-adjusted edge is too small',
  EDGE_BELOW_MINIMUM: 'the commission-adjusted edge is too small',
  ROI_BELOW_THRESHOLD: 'the expected return is too low',
  ROI_BELOW_MINIMUM: 'the expected return is too low',
  CONFIDENCE_BELOW_THRESHOLD: 'model confidence is too low',
  CONFIDENCE_BELOW_MINIMUM: 'model confidence is too low',
  MAX_EXPOSURE_REACHED: 'the maximum exposure limit has been reached',
  MAX_OPEN_ORDERS: 'too many paper orders are unresolved',
  DAILY_LOSS_LIMIT_REACHED: 'the daily loss limit has been reached',
  MAX_DRAWDOWN_REACHED: 'the maximum drawdown limit has been reached',
  LOSING_STREAK_REACHED: 'the losing-streak limit has been reached',
  AUTO_PAPER_ORDERING_PAUSED: 'automatic paper ordering is paused',
  AI_REQUIRED_BUT_NOT_AVAILABLE: 'the required probability model is unavailable',
  ORDER_AUTHORITY_REJECTED: 'the final order safety check rejected the candidate',
  NO_MARKETS_LOADED: 'no Betfair markets are loaded',
  NO_CANDIDATES: 'no eligible candidates were found',
  EMERGENCY_STOP_ACTIVE: 'the emergency stop is active',
  PRICE_MOVED: 'the executable price moved after the candidate was ranked',
};

function plainGate(gate) {
  if (!gate) return 'no specific reason was recorded';
  if (GATE_PLAIN_LANGUAGE[gate]) return GATE_PLAIN_LANGUAGE[gate];
  if (String(gate).includes(' ')) return String(gate);
  return String(gate).replace(/_/g, ' ').toLowerCase();
}

function Detail({ label, value, mono, tone }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-label text-muted-foreground">{label}</div>
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
        <div className="p-8 text-center text-sm text-muted-foreground">No bot cycles yet. Start the paper bot or run a scan.</div>
      </Panel>
    );
  }

  const decision = Number(lastCycle.ordersCreated || 0) > 0 ? 'BET' : 'NO_BET';
  const best = lastCycle.bestCandidate;
  const blocker = lastCycle.cycleFailedGate
    ?? lastCycle.noBetReason
    ?? best?.failedGate
    ?? best?.mainBlocker
    ?? best?.blockers?.[0]
    ?? null;
  const roi = best?.roi ?? best?.expectedROI ?? null;
  const probability = best?.finalProbabilityUsedInEV ?? best?.modelProbability ?? best?.estimatedProbability ?? null;
  const breakeven = best?.breakevenProbability ?? best?.commissionAwareBreakevenProbability ?? best?.impliedProbability ?? null;
  const edge = best?.commissionAdjustedEdge ?? best?.edge ?? null;
  const plainReason = decision === 'BET'
    ? `Paper bet created: ${best?.side || ''} ${best?.runnerName || 'unknown runner'} at ${fmtOdds(best?.odds)}.`
    : `No bet: ${plainGate(blocker)}.`;

  return (
    <Panel
      title="Latest Decision"
      subtitle={`Cycle #${lastCycle.cycleNumber} · ${fmtAge(lastCycle.finishedAt || lastCycle.startedAt)}`}
      action={
        <div className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-label ${decision === 'BET' ? 'border-success/25 bg-success/10 text-success' : 'border-warning/25 bg-warning/10 text-warning'}`}>
          {decision === 'BET' ? <><CheckCircle2 className="mr-1 inline h-3 w-3" />Bet</> : <><Ban className="mr-1 inline h-3 w-3" />No Bet</>}
        </div>
      }
    >
      <div className="space-y-3 p-4">
        <div className={`rounded-lg border p-3 text-sm ${decision === 'BET' ? 'border-success/20 bg-success/8 text-success' : 'border-warning/20 bg-warning/8 text-warning'}`}>
          {plainReason}
        </div>

        {best && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Detail label="Runner" value={best.runnerName || '—'} />
            <div className="flex flex-col gap-1"><div className="mb-0.5 text-[10px] font-medium uppercase tracking-label text-muted-foreground">Side</div><SideBadge side={best.side || 'BACK'} /></div>
            <Detail label="Odds" value={fmtOdds(best.odds)} mono />
            <Detail label="Stake" value={fmtMoney(best.stake)} mono />
            <Detail label="Liability" value={fmtMoney(best.liability)} mono />
            <Detail label="EV" value={fmtMoney(best.ev)} mono tone={plClass(best.ev)} />
            <Detail label="ROI" value={roi == null ? '—' : fmtPct(roi * 100)} mono tone={plClass(roi)} />
            <Detail label="Model Probability" value={fmtProb(probability)} mono />
          </div>
        )}

        {showDetails && best && (
          <div className="grid grid-cols-2 gap-3 border-t border-border-subtle pt-2 md:grid-cols-4">
            <Detail label="Breakeven Probability" value={fmtProb(breakeven)} mono />
            <Detail label="Commission-Adjusted Edge" value={edge == null ? '—' : fmtPct(edge * 100)} mono tone={plClass(edge)} />
            <Detail label="Confidence" value={best.confidence == null ? '—' : fmtPct(best.confidence)} mono />
            <Detail label="Max Profit" value={fmtMoney(best.maxProfit)} mono tone="text-success" />
            <Detail label="Max Loss" value={fmtMoney(best.maxLoss)} mono tone="text-danger" />
            <Detail label="Decision Source" value={best.decisionSource || '—'} />
            <Detail label="Market Type" value={best.marketType || best.detectedMarketType || '—'} />
            <Detail label="Spread" value={`${best.spreadTicks ?? best.spread ?? '—'} ticks`} mono />
          </div>
        )}

        {showDetails && decision === 'NO_BET' && blocker && (
          <div className="rounded-lg border border-border-subtle bg-muted/30 p-3 text-xs">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-label text-muted-foreground">Recorded blocker</div>
            <code className="font-mono text-warning">{String(blocker)}</code>
            {best?.blockers?.length > 1 && <div className="mt-2 text-[11px] text-muted-foreground">All checks: {best.blockers.join('; ')}</div>}
          </div>
        )}

        <Button size="sm" variant="outline" onClick={() => setShowDetails(value => !value)}>
          {showDetails ? <><ChevronUp className="h-3.5 w-3.5" />Hide details</> : <><ChevronDown className="h-3.5 w-3.5" />See why</>}
        </Button>
      </div>
    </Panel>
  );
}
