import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, Clock, Zap } from 'lucide-react';

export default function BotSyncControls() {
  const { apiConnected, betfairConnection, refreshMarketState, refreshOrderState, recalculateSettledStats, recalculateRiskState, settings, addAuditLog, appMode, markets, runners } = useApp();

  const isStreaming = betfairConnection?.streamConnectionStatus === 'connected';

  const connectionChecks = [
    { label: 'API Login', ok: betfairConnection?.loginStatus === 'connected' },
    { label: 'Session Token', ok: betfairConnection?.sessionTokenStatus === 'connected' },
    { label: 'Stream API', ok: isStreaming },
    { label: 'Markets Loaded', ok: markets.length > 0 },
    { label: 'Runners Tracked', ok: runners.length > 0 },
    { label: 'Data Fresh', ok: betfairConnection?.dataFresh },
  ];

  const passedChecks = connectionChecks.filter(c => c.ok).length;

  const handleSync = (type) => {
    if (type === 'markets') refreshMarketState?.();
    else if (type === 'orders') refreshOrderState?.();
    else if (type === 'cleared') recalculateSettledStats?.();
    else if (type === 'risk') recalculateRiskState?.();
    addAuditLog?.(`Manual Refresh: ${type}`, 'api', 'info', `Operator triggered ${type} state refresh from Bot Control Centre`);
  };

  return (
    <Panel title="Betfair Data Connection & State Refresh">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {apiConnected ? <Wifi className="h-5 w-5 text-chart-1" /> : <WifiOff className="h-5 w-5 text-chart-5" />}
            <div>
              <div className="text-sm font-bold">{apiConnected ? 'Connected' : 'Disconnected'}</div>
              <div className="text-xs text-muted-foreground">{passedChecks}/{connectionChecks.length} checks passed</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && <StatusBadge status="ok">STREAMING</StatusBadge>}
            <StatusBadge status={apiConnected ? 'ok' : 'info'}>{appMode === 'connected_paper' ? 'PAPER' : 'DEMO'}</StatusBadge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {connectionChecks.map(c => (
            <div key={c.label} className="flex items-center gap-2 text-xs bg-muted/50 rounded p-2">
              <div className={`h-2 w-2 rounded-full ${c.ok ? 'bg-chart-1' : 'bg-chart-5'}`} />
              <span className="text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button size="sm" variant="outline" onClick={() => handleSync('markets')} disabled={!apiConnected}>
            <RefreshCw className="h-3 w-3" /> Refresh Market State
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleSync('orders')} disabled={!apiConnected}>
            <RefreshCw className="h-3 w-3" /> Refresh Order State
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleSync('cleared')} disabled={!apiConnected}>
            <RefreshCw className="h-3 w-3" /> Recalculate Settled Stats
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleSync('risk')} disabled={!apiConnected}>
            <Zap className="h-3 w-3" /> Recalculate Risk
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> Poll: <span className="font-mono text-foreground">{settings.apiPollingInterval}s</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> Refresh: <span className="font-mono text-foreground">{settings.marketRefreshInterval}s</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> Freshness: <span className="font-mono text-foreground">{settings.dataFreshnessLimit}s</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3 w-3" /> Stream: <span className="font-mono text-foreground">{isStreaming ? 'DATA' : 'OFF'}</span>
          </div>
        </div>

        {betfairConnection?.lastMarketSyncTime && (
          <div className="text-xs text-muted-foreground border-t border-border pt-2">
            Last refresh: <span className="font-mono">{new Date(betfairConnection.lastMarketSyncTime).toLocaleString('en-AU')}</span>
          </div>
        )}
      </div>
    </Panel>
  );
}