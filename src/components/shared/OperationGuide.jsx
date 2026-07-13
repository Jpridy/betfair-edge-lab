import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import useAuthoritativeTradingState from '@/hooks/useAuthoritativeTradingState';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fmtMoney } from '@/lib/format';
import { CheckCircle2, Circle, AlertTriangle, Wifi, Radio, Bot, ClipboardList, ArrowRight, ShieldCheck } from 'lucide-react';

function Step({ number, title, desc, done, warning, icon: Icon }) {
  const Marker = done ? CheckCircle2 : warning ? AlertTriangle : Circle;
  return (
    <div className={cn(
      'flex gap-3 rounded-lg border p-3 transition-colors',
      done ? 'border-success/20 bg-success/5' : warning ? 'border-warning/25 bg-warning/8' : 'border-border-subtle bg-muted/15',
    )}>
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
        done ? 'border-success/25 bg-success/10 text-success' : warning ? 'border-warning/25 bg-warning/10 text-warning' : 'border-border bg-card text-muted-foreground',
      )}>
        <Marker className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-[10px] uppercase tracking-label text-muted-foreground">Step {number}</span>
        </div>
        <div className="mt-0.5 text-sm font-semibold text-foreground">{title}</div>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

export default function OperationGuide() {
  const { apiConnected, botState, paperOrders } = useApp();
  const state = useAuthoritativeTradingState();
  const accounting = usePortfolioAccountingDisplay();
  const botRunning = botState.running && !botState.paused;
  const hasOrders = paperOrders.length > 0;
  const pricesLive = state.priceFeedStatus === 'LIVE';
  const accountingWarning = accounting.accountingDataInconsistent;
  const validationText = hasOrders
    ? `${accounting.settledOrderCount || 0} settled · ${accounting.unresolvedOrderCount || 0} open · ${fmtMoney(accounting.netRealisedPL, { sign: true })} net P/L`
    : 'No paper orders yet. The app will show orders here after a valid candidate passes every safety check.';

  return (
    <Panel title="Operate in 4 simple steps" subtitle="The shortest safe path from opening the app to collecting clean paper results">
      <div className="grid gap-3 p-4 lg:grid-cols-4">
        <Step
          number="1"
          title="Connect data"
          desc={apiConnected ? 'Betfair data is connected.' : 'Connect Betfair data first. The app cannot scan without market data.'}
          done={apiConnected}
          warning={!apiConnected}
          icon={Wifi}
        />
        <Step
          number="2"
          title="Wait for live prices"
          desc={pricesLive ? `Prices are live. Latest price age: ${state.priceAgeSeconds ?? 0}s.` : 'The bot will not create paper orders from stale or missing prices.'}
          done={pricesLive}
          warning={apiConnected && !pricesLive}
          icon={Radio}
        />
        <Step
          number="3"
          title="Run the paper bot"
          desc={botRunning ? 'The paper bot is scanning and applying safety checks.' : 'Start Paper Bot from Controls when data is live.'}
          done={botRunning}
          warning={pricesLive && !botRunning}
          icon={Bot}
        />
        <Step
          number="4"
          title="Review results"
          desc={accountingWarning ? 'Accounting needs repair. Open Debug > Accounting before trusting totals.' : validationText}
          done={hasOrders && !accountingWarning}
          warning={accountingWarning}
          icon={ClipboardList}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" />
          Paper-only lock is always on. This screen cannot place real Betfair bets.
        </div>
        <Button asChild size="sm">
          <Link to="/controls">Open Paper Bot Controls <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </div>
    </Panel>
  );
}
