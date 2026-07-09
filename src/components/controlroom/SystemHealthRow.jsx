import React from 'react';
import { Wifi, Activity, Database, Globe, Brain, FileCheck, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';
import { buildLiveWiringStatus } from '@/lib/wiringAudit';

function HealthCard({ name, status, lastCall, error, records, usedByBot, icon: Icon }) {
  const config = {
    healthy: { color: 'text-chart-1', bg: 'bg-chart-1/10', border: 'border-chart-1/30', icon: CheckCircle2 },
    warning: { color: 'text-chart-4', bg: 'bg-chart-4/10', border: 'border-chart-4/30', icon: AlertTriangle },
    error: { color: 'text-chart-5', bg: 'bg-chart-5/10', border: 'border-chart-5/30', icon: XCircle },
    disabled: { color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', icon: Clock },
    stale: { color: 'text-chart-4', bg: 'bg-chart-4/10', border: 'border-chart-4/30', icon: Clock },
  };
  const c = config[status] || config.disabled;
  const StatusIcon = c.icon;

  return (
    <div className={cn('rounded-lg border p-3', c.border, c.bg)}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5', c.color)} />
          <span className="text-[10px] font-bold text-foreground truncate">{name}</span>
        </div>
        <StatusIcon className={cn('h-3.5 w-3.5', c.color)} />
      </div>
      <div className={cn('text-[10px] font-bold uppercase', c.color)}>{status}</div>
      <div className="mt-1.5 space-y-0.5 text-[9px] text-muted-foreground">
        {lastCall && <div>Last: {new Date(lastCall).toLocaleTimeString('en-AU')}</div>}
        {records != null && <div>Records: {records}</div>}
        {error && <div className="text-chart-5 truncate" title={error}>Err: {error}</div>}
        <div className={usedByBot ? 'text-chart-1' : 'text-muted-foreground'}>{usedByBot ? '✓ Used by bot' : 'Not used'}</div>
      </div>
    </div>
  );
}

function mapStatus(svc) {
  if (!svc) return 'disabled';
  if (svc.status === 'connected' || svc.status === 'enabled' || svc.status === 'connected') return 'healthy';
  if (svc.status === 'disconnected' || svc.status === 'error') return 'error';
  if (svc.status === 'disabled') return 'disabled';
  return 'warning';
}

export default function SystemHealthRow() {
  const app = useApp();
  const services = buildLiveWiringStatus(app);

  const iconMap = {
    'Betfair Login/Session': Wifi,
    'Betfair Stream/Price Feed': Activity,
    'Betfair Market Catalogue': Database,
    'Featherless AI API': Brain,
    'OpenAI External Web Search': Globe,
    'Database/Entity Writes': Database,
    'Paper Order Creation': FileCheck,
    'Settlement Service': FileCheck,
    'Decision Log Export': FileCheck,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
      {services.map(svc => (
        <HealthCard
          key={svc.serviceName}
          name={svc.serviceName}
          status={mapStatus(svc)}
          lastCall={svc.lastSuccessfulCallAt}
          error={svc.lastError}
          records={svc.recordsReturned}
          usedByBot={svc.dataUsedByBot}
          icon={iconMap[svc.serviceName] || Activity}
        />
      ))}
    </div>
  );
}