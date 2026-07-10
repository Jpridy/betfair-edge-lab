import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';

export default function RacePackDebugViewer({ diagnostics: propDiagnostics }) {
  const { lastExchangeDiagnostics } = useApp();
  const [expanded, setExpanded] = useState(false);

  const source = propDiagnostics || lastExchangeDiagnostics;
  const racePackSummary = source?.raceAssessmentDiagnostics?.lastRacePack;

  if (!racePackSummary) {
    return null;
  }

  return (
    <Panel
      title="Race Pack Debug Viewer"
      subtitle="Data payload sent to Featherless AI for the most recent race assessment"
      action={
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      }
    >
      {expanded && (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-xs font-heading font-semibold text-foreground">{racePackSummary.eventName || 'Unknown Race'}</span>
            <StatusBadge status="info">{racePackSummary.raceId || '—'}</StatusBadge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px]">
            <Field label="Venue" value={racePackSummary.venue || '—'} />
            <Field label="Seconds to Jump" value={racePackSummary.secondsToJump ?? '—'} />
            <Field label="Total Markets" value={racePackSummary.marketCount} />
            <Field label="Total Runners" value={racePackSummary.runnerCount} />
            <Field label="Total Matched" value={`$${(racePackSummary.totalMatched || 0).toLocaleString()}`} />
            <Field label="H2H Markets" value={racePackSummary.h2hMarketCount || 0} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <Flag label="WIN Market" present={racePackSummary.winMarketPresent} />
            <Flag label="PLACE Market" present={racePackSummary.placeMarketPresent} />
            <Flag label="External Research" present={racePackSummary.externalResearchUsed} />
            <Flag label="Risk Context" present={racePackSummary.riskContextIncluded} />
          </div>

          <div className="bg-background/50 rounded-md p-3">
            <div className="text-[9px] font-body font-medium text-muted-foreground uppercase tracking-label mb-1">Full Race Pack Summary JSON</div>
            <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-64">{JSON.stringify(racePackSummary, null, 2)}</pre>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[9px] font-body font-medium text-muted-foreground uppercase tracking-label">{label}</div>
      <div className="font-mono tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function Flag({ label, present }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${present ? 'bg-success/5 border-success/20' : 'bg-muted border-border'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${present ? 'bg-success' : 'bg-muted-foreground'}`} />
      <span className={`text-[10px] font-body font-medium ${present ? 'text-success' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );
}