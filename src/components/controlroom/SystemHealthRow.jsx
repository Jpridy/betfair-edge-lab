import React, { useState } from 'react';
import { Wifi, Activity, Database, Globe, Brain, FileCheck, CheckCircle2, AlertTriangle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { cn } from '@/lib/utils';
import { buildLiveWiringStatus } from '@/lib/wiringAudit';

const statusConfig = {
  healthy: { label: 'Healthy', color: 'text-success', border: 'border-success/15', dot: 'bg-success', icon: CheckCircle2 },
  warning: { label: 'Warning', color: 'text-warning', border: 'border-warning/15', dot: 'bg-warning', icon: AlertTriangle },
  error: { label: 'Error', color: 'text-danger', border: 'border-danger/15', dot: 'bg-danger', icon: XCircle },
  disabled: { label: 'Disabled', color: 'text-muted-foreground', border: 'border-border-subtle', dot: 'bg-muted-foreground', icon: Clock },
  stale: { label: 'Stale', color: 'text-warning', border: 'border-warning/15', dot: 'bg-warning', icon: Clock },
  not_tested: { label: 'Not tested', color: 'text-muted-foreground', border: 'border-border-subtle', dot: 'bg-muted-foreground', icon: Clock },
  not_configured: { label: 'Not configured', color: 'text-muted-foreground', border: 'border-border-subtle', dot: 'bg-muted-foreground', icon: Clock },
  unknown: { label: 'Unknown', color: 'text-muted-foreground', border: 'border-border-subtle', dot: 'bg-muted-foreground', icon: Clock },
};

const nextActionHints = {
  'Betfair Login/Session': {
    not_configured: 'Open Setup to connect',
    error: 'Run Endpoint Diagnostic in Setup',
    disabled: 'Open Setup to connect',
    healthy: 'API validated — session active',
    token_present_not_validated: 'Token present — fetch markets to validate',
  },
  'Betfair Stream/Price Feed': {
    error: 'Fetch markets or connect stream',
    stale: 'Data may be outdated',
    healthy: 'Live prices flowing',
    not_configured: 'Connect Betfair session first',
    disabled: 'Connect Betfair session first',
  },
  'Betfair Market Catalogue': {
    not_configured: 'Fetch markets to load',
    error: 'Fetch markets to load',
    disabled: 'Fetch markets to load',
    healthy: 'Markets loaded',
  },
  'Featherless AI API': {
    disabled: 'Enable in AI & Research settings',
    not_tested: 'Run AI test in Setup',
    error: 'Check API key in settings',
    healthy: 'AI responding',
  },
  'OpenAI External Web Search': {
    disabled: 'Enable in AI & Research settings',
    not_tested: 'Run search test in Setup',
    error: 'Check OpenAI API key',
    healthy: 'Search ready',
  },
  'Database/Entity Writes': {
    healthy: 'Writing normally',
    error: 'Check database connection',
  },
  'Paper Order Creation': {
    healthy: 'Ready',
    disabled: 'Enable auto paper trading',
  },
  'Settlement Service': {
    healthy: 'Monitoring markets',
    not_tested: 'Will settle on market close',
  },
  'Decision Log Export': {
    healthy: 'Ready',
  },
};

function HealthCard({ name, statusKey, lastCall, lastAttempt, error, records, usedByBot, icon: Icon }) {
  const [expanded, setExpanded] = useState(false);
  const c = statusConfig[statusKey] || statusConfig.unknown;
  const StatusIcon = c.icon;
  const hint = nextActionHints[name]?.[statusKey] || '';

  return (
    <div className={cn('rounded-lg border p-2.5 transition-colors hover:border-border', c.border)}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn('h-3.5 w-3.5 shrink-0', c.color)} />
          <span className="text-[11px] font-body font-semibold text-foreground truncate">{name}</span>
        </div>
        <StatusIcon className={cn('h-3.5 w-3.5 shrink-0', c.color)} />
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <div className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
        <span className={cn('text-[10px] font-body font-semibold', c.color)}>{c.label}</span>
      </div>
      {hint && (
        <div className="text-[9px] text-muted-foreground font-body mb-0.5">{hint}</div>
      )}
      {(lastCall || lastAttempt) && (
        <div className="text-[9px] text-muted-foreground/60 font-body">
          {lastCall ? `Checked ${new Date(lastCall).toLocaleTimeString('en-AU')}` : lastAttempt ? `Tried ${new Date(lastAttempt).toLocaleTimeString('en-AU')}` : ''}
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-0.5 text-[9px] text-muted-foreground/50 hover:text-muted-foreground mt-1 transition-colors"
      >
        {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        Details
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-0.5 text-[9px] text-muted-foreground font-body border-t border-border-subtle pt-1.5">
          {records != null && <div>Records: <span className="font-mono">{records}</span></div>}
          <div>{usedByBot ? '✓ Used by bot' : 'Not used by bot'}</div>
          {error && <div className="text-danger break-all">Error: {error}</div>}
        </div>
      )}
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
  if (s === 'token_present_not_validated') return 'warning';
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
          statusKey={mapStatus(svc)}
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