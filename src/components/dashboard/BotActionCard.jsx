import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import { Panel } from '@/components/ui/workstation';
import { Button } from '@/components/ui/button';
import { fmtAge } from '@/lib/format';
import { Play, Square, ArrowRight, Bot, Clock, CheckCircle2, AlertTriangle, ShoppingCart, RefreshCw } from 'lucide-react';

function BotMetric({ icon: Icon, label, value, tone }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${toneClass}`} />
      <span className="text-[11px] text-muted-foreground">{label}:</span>
      <span className={`text-[11px] font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

export default function BotActionCard() {
  const { botState, botCycles, paperOrders, settlementRunning, startBot, stopBot } = useApp();
  const botRunning = botState.running && !botState.paused;
  const lastSuccessful = botCycles.find(c => c.status === 'completed');
  const lastFailed = botCycles.find(c => c.status === 'failed');
  const openOrders = paperOrders.filter(o => ['matched', 'partially_matched', 'pending', 'executable'].includes(o.status)).length;

  return (
    <Panel title="Bot Action" subtitle="Start or stop the paper trading bot">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <BotMetric icon={Bot} label="State" value={botRunning ? 'Running' : botState.paused ? 'Paused' : 'Stopped'} tone={botRunning ? 'success' : 'warning'} />
          <BotMetric icon={Clock} label="Next scan" value={botRunning ? `${botState.nextScanCountdown}s` : '—'} />
          <BotMetric icon={CheckCircle2} label="Last success" value={lastSuccessful ? `#${lastSuccessful.cycleNumber}` : '—'} tone={lastSuccessful ? 'success' : undefined} />
          <BotMetric icon={AlertTriangle} label="Last error" value={lastFailed ? `#${lastFailed.cycleNumber}` : 'None'} tone={lastFailed ? 'danger' : undefined} />
          <BotMetric icon={ShoppingCart} label="Open orders" value={String(openOrders)} tone={openOrders > 0 ? 'warning' : undefined} />
          <BotMetric icon={RefreshCw} label="Settlement" value={settlementRunning ? 'Running' : 'Idle'} tone={settlementRunning ? 'warning' : undefined} />
        </div>

        <Button
          size="lg"
          className="w-full"
          variant={botRunning ? 'destructive' : 'default'}
          onClick={botRunning ? stopBot : startBot}
        >
          {botRunning ? <><Square className="h-4 w-4" /> Stop Paper Bot</> : <><Play className="h-4 w-4" /> Start Paper Bot</>}
        </Button>

        <Link to="/controls" className="block text-center text-xs text-info hover:underline">
          Open Controls <ArrowRight className="inline h-3 w-3" />
        </Link>
      </div>
    </Panel>
  );
}