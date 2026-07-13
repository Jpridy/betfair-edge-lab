import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import useAuthoritativeTradingState from '@/hooks/useAuthoritativeTradingState';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';
import { Button } from '@/components/ui/button';
import { LiveStatusBadge } from '@/components/ui/workstation';
import { fmtMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AlertOctagon, ArrowRight, Bot, CheckCircle2, Pause, Play, Radio, ShieldCheck, Square, Wifi, WifiOff } from 'lucide-react';

function HealthPill({ icon: Icon, label, ok, text }) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
      ok ? 'border-success/20 bg-success/6 text-success' : 'border-warning/25 bg-warning/8 text-warning',
    )}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-semibold">{label}</span>
      <span className="hidden text-muted-foreground sm:inline">{text}</span>
    </div>
  );
}

export default function CommandCentre() {
  const { apiConnected, botState, startBot, stopBot, emergencyStop, triggerEmergencyStop } = useApp();
  const state = useAuthoritativeTradingState();
  const accounting = usePortfolioAccountingDisplay();
  const running = botState.running && !botState.paused;
  const ready = apiConnected && state.priceFeedStatus === 'LIVE' && !emergencyStop;
  const primaryLabel = emergencyStop ? 'Emergency Stop Active' : running ? 'Stop Paper Bot' : ready ? 'Start Paper Bot' : 'Open Setup';
  const primaryIcon = emergencyStop ? AlertOctagon : running ? Square : ready ? Play : ArrowRight;
  const PrimaryIcon = primaryIcon;
  const primaryAction = running ? stopBot : ready ? startBot : null;
  const primaryTo = !running && !ready ? '/settings' : null;
  const currentState = emergencyStop
    ? 'Stopped for safety'
    : running
      ? 'Scanning for paper-only opportunities'
      : ready
        ? 'Ready to start'
        : apiConnected
          ? 'Waiting for live prices'
          : 'Needs Betfair connection';

  return (
    <section className="overflow-hidden rounded-xl border border-border-subtle bg-card shadow-premium">
      <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <LiveStatusBadge status={state.priceFeedStatus} age={state.priceAgeSeconds != null ? `${state.priceAgeSeconds}s` : undefined} source={state.dataSource} />
            <span className="inline-flex items-center gap-1.5 rounded-md border border-success/25 bg-success/8 px-2 py-0.5 text-[10px] font-semibold tracking-label text-success">
              <ShieldCheck className="h-3 w-3" /> PAPER ONLY
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-heading font-semibold tracking-tight-brand text-foreground md:text-3xl">{currentState}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              This app watches Betfair data, checks every safety gate, and records paper orders only. Start here, then use Controls when you want the full race and candidate view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {primaryTo ? (
              <Button asChild size="lg">
                <Link to={primaryTo}>{primaryLabel} <PrimaryIcon className="h-4 w-4" /></Link>
              </Button>
            ) : (
              <Button size="lg" variant={running ? 'destructive' : 'default'} onClick={primaryAction} disabled={emergencyStop}>
                <PrimaryIcon className="h-4 w-4" /> {primaryLabel}
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link to="/controls">See Current Race <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            {!emergencyStop && (
              <Button size="lg" variant="destructive" onClick={triggerEmergencyStop}>
                <AlertOctagon className="h-4 w-4" /> Emergency Stop
              </Button>
            )}
          </div>
        </div>
        <div className="border-t border-border-subtle bg-muted/15 p-5 md:p-6 lg:border-l lg:border-t-0">
          <div className="grid gap-2">
            <HealthPill icon={apiConnected ? Wifi : WifiOff} label="Betfair" ok={apiConnected} text={apiConnected ? 'connected' : 'not connected'} />
            <HealthPill icon={Radio} label="Prices" ok={state.priceFeedStatus === 'LIVE'} text={state.priceFeedStatus === 'LIVE' ? `${state.priceAgeSeconds ?? 0}s old` : state.priceFeedStatus} />
            <HealthPill icon={running ? Bot : Pause} label="Bot" ok={running} text={running ? 'running' : botState.paused ? 'paused' : 'stopped'} />
            <div className="mt-2 rounded-lg border border-border-subtle bg-card p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-label text-muted-foreground"><CheckCircle2 className="h-3 w-3" />Simple result check</div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Net P/L</span><div className="font-mono font-semibold tabular-nums text-foreground">{fmtMoney(accounting.netRealisedPL, { sign: true })}</div></div>
                <div><span className="text-muted-foreground">Open risk</span><div className="font-mono font-semibold tabular-nums text-foreground">{fmtMoney(accounting.totalOpenExposure)}</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
