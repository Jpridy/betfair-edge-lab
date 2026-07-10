import React from 'react';
import { StatusBadge } from '@/components/ui/Trading';
import { Globe, ExternalLink, RefreshCw } from 'lucide-react';

export default function WebResearchPanel({ research, loading }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-info/30 bg-info/5 p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-info mb-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Searching the web for race-day information...
        </div>
        <div className="text-xs text-muted-foreground">
          OpenAI is searching for form, scratchings, track conditions, tips, and market news.
        </div>
      </div>
    );
  }

  if (!research) return null;

  const sources = research.sources || [];
  const runnerResearch = research.runnerResearch || [];
  const dataQuality = research.dataQuality || 0;

  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-info">
          <Globe className="h-4 w-4" />
          Web Research Summary
        </div>
        <StatusBadge status={dataQuality >= 70 ? 'ok' : dataQuality >= 40 ? 'info' : 'warning'}>
          {dataQuality}/100 quality · {research.sourceCount || sources.length} sources
        </StatusBadge>
      </div>

      {research.raceLevelNotes && (
        <div className="text-xs text-foreground bg-muted/30 rounded p-2">{research.raceLevelNotes}</div>
      )}

      {sources.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Source Links</div>
          <div className="space-y-0.5">
            {sources.slice(0, 10).map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-info hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3 shrink-0" /> {s.title || s.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {runnerResearch.filter(r => (r.positiveSignals?.length > 0 || r.negativeSignals?.length > 0)).length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Runner Signals</div>
          <div className="space-y-1">
            {runnerResearch.filter(r => r.positiveSignals?.length > 0 || r.negativeSignals?.length > 0).map((r, i) => (
              <div key={i} className="text-xs">
                <span className="font-medium">{r.runnerName}:</span>
                {r.positiveSignals?.length > 0 && (
                  <span className="text-success"> +{r.positiveSignals.join('; ')}</span>
                )}
                {r.negativeSignals?.length > 0 && (
                  <span className="text-danger"> −{r.negativeSignals.join('; ')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground italic">
        Web research is supplementary context only. The exchange engine remains the final authority for BET/NO_BET decisions.
      </div>
    </div>
  );
}