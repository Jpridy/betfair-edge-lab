import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, Clock, Zap } from 'lucide-react';

export default function BotSyncControls() {
  const { betfairConnection, syncBetfairData, settings, addAuditLog, mode } = useApp();

  const handleSync = async (type) => {
    if (syncBetfairData) {
      await syncBetfairData(type);
    }
    addAuditLog?.(`Manual Sync: ${type}`, 'api', 'info', `Operator triggered ${type} sync from Bot Control Centre`);
  };

  const connectionChecks = [
    { label: 'API Login', ok: betfairConnection?.loggedIn || false },
    { label: 'App Key', ok: betfairConnection?.appKeyValid || false },
    { label: 'Session Token', ok: betfairConnection?.sessionValid || false },
    { label: 'Stream API', ok: betfairConnection?.streamEnabled || false },
    { label: 'Markets Synced', ok: betfairConnection?.marketsSynced || false },
    { label: 'Orders Synced', ok: betfairConnection?.ordersSynced || false },
  ];

  const passedChecks = connectionChecks.filter(c => c.ok).length;

  return (
    <Panel title="Betfair API Connection & Sync Controls">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {betfairConnection?.loggedIn ? <Wifi className="h-5 w-5 text-chart-1" /> : <WifiOff className="h-5 w-5 text-chart-5" />}
            <div>
              <div className="text-sm font-bold">{betfairConnection?.loggedIn ? 'Connected' : 'Disconnected'}</div>
              <div className="text-xs text-muted-foreground">{passedChecks}/{connectionChecks.length} checks passed</div>
            </div>
          </div>
          <StatusBadge status={mode === 'live_locked' ? 'warning' : mode === 'paper' ? 'info' : 'neutral'}>{mode?.toUpperCase()}</StatusBadge>
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
          <Button size="sm" variant="outline" onClick={() => handleSync('markets')} disabled={!betfairConnection?.loggedIn}>
            <RefreshCw className="h-3 w-3" /> Sync Markets
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleSync('orders')} disabled={!betfairConnection?.loggedIn}>
            <RefreshCw className="h-3 w-3" /> Sync Orders
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleSync('cleared')} disabled={!betfairConnection?.loggedIn}>
            <RefreshCw className="h-3 w-3" /> Sync Settled
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleSync('risk')} disabled={!betfairConnection?.loggedIn}>
            <Zap className="h-3 w-3" /> Sync Risk
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
            <Zap className="h-3 w-3" /> Stream: <span className="font-mono text-foreground">{settings.streamApiEnabled ? 'ON' : 'OFF'}</span>
          </div>
        </div>

        {settings.lastSyncTime && (
          <div className="text-xs text-muted-foreground border-t border-border pt-2">
            Last sync: <span className="font-mono">{new Date(settings.lastSyncTime).toLocaleString('en-AU')}</span>
          </div>
        )}
      </div>
    </Panel>
  );
}