import React from 'react';
import { Wifi, Activity, Database, Globe, Brain, FileCheck, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';
import { buildLiveWiringStatus } from '@/lib/wiringAudit';

const statusConfig = {
  healthy: { color: 'text-success', bg: 'bg-success/8', border: 'border-success/20', dot: 'bg-success', icon: CheckCircle2 },
  warning: { color: 'text-warning', bg: 'bg-warning/8', border: 'border-warning/20', dot: 'bg-warning', icon: AlertTriangle },
  error: { color: 'text-danger', bg: 'bg-danger/8', border: 'border-danger/20', dot: 'bg-danger', icon: XCircle },
  disabled: { color: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-border', dot: 'bg-muted-foreground', icon: Clock },
  stale: { color: 'text-warning', bg: 'bg-warning/8', border: 'border-warning/20', dot: 'bg-warning', icon: Clock },
  not_tested: { color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border-subtle', dot: 'bg-muted-foreground', icon: Clock },
  not_configured: { color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border-subtle', dot: 'bg-muted-foreground', icon: Clock },
  unknown: { color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border-subtle', dot: 'bg-muted-foreground', icon: Clock },
};

function HealthCard({ name, status, lastCall, lastAttempt, error, records, usedByBot, icon: Icon }) {
  const c = statusConfig[status] || statusConfig.unknown;
  const StatusIcon = c.icon;

  return (
    <div className={cn('rounded-lg border p-3 transition-colors hover:border-border', c.border, c.bg)}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn('h-3.5 w-3.5 shrink-0', c.color)} />
          <span className="text-[11px] font-body font-semibold text-foreground truncate">{name}</span>
        </div>
        <StatusIcon className={cn('h-3.5 w-3.5 shrink-0', c.color)} />
      </div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
        <div className={cn('text-[9px] font-body font-semibold uppercase tracking-label', c.color)}>{status}</div>
      </div>
      <div className="space-y-0.5 text-[9px] text-muted-foreground font-body">
        {lastCall && <div>Last OK: <span className="font-mono">{new Date(lastCall).toLocaleTimeString('en-AU')}</span></div>}
        {lastAttempt && !lastCall && <div>Last attempt: <span className="font-mono">{new Date(lastAttempt).toLocaleTimeString('en-AU')}</span></div>}
        {records != null && <div>Records: <span className="font-mono">{records}</span></div>}
        {error && <div className="text-danger truncate" title={error}>Err: {error}</div>}
        <div className={cn('font-medium', usedByBot ? 'text-success' : 'text-muted-foreground')}>{usedByBot ? '✓ Used by bot' : 'Not used'}</div>
      </div>
    </div>
  );
}

function mapStatus(svc) {
  if (!svc) return 'unknown';
  const s = svc.status;
  if (s === 'connected' || s === 'enabled' || s === 'polling') return 'healthy';
  if (s === 'disconnected' || s === 'error') return 'error';
  if (s === 'disabled') return 'disabled';
  if (s === 'stale') return 'stale';
  if (s === 'not_tested') return 'not_tested';
  if (s === 'not_configured') return 'not_configured';
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {services.map(svc => (
        <HealthCard
          key={svc.serviceName}
          name={svc.serviceName}
          status={mapStatus(svc)}
          lastCall={svc.lastSuccessfulCallAt}
          lastAttempt={svc.lastAttemptedCallAt}
          error={svc.lastError}
          records={svc.recordsReturned}
          usedByBot={svc.dataUsedByBot}
          icon={iconMap[svc.serviceName] || Activity}
        />
      ))}
    </div>
  );
}