import React from 'react';
import { StatusBadge } from '@/components/ui/Trading';
import { Globe, ExternalLink, RefreshCw } from 'lucide-react';

export default function WebResearchPanel({ research, loading }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-chart-3/30 bg-chart-3/5 p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-chart-3 mb-2">
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

  const sources = research.source_links || [];

  return (
    <div className="rounded-lg border border-chart-3/30 bg-chart-3/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-chart-3">
          <Globe className="h-4 w-4" />
          Web Research Summary
        </div>
        <StatusBadge status={research.data_quality === 'good' ? 'ok' : research.data_quality === 'partial' ? 'info' : 'warning'}>
          {research.data_quality || 'unknown'} data
        </StatusBadge>
      </div>

      {research.research_summary && (
        <div className="text-xs text-foreground bg-muted/30 rounded p-2">{research.research_summary}</div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {research.track_condition && <ResearchField label="Track Condition" value={research.track_condition} />}
        {research.weather && <ResearchField label="Weather" value={research.weather} />}
      </div>

      {research.scratchings?.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Scratchings</div>
          <div className="flex flex-wrap gap-1">
            {research.scratchings.map((s, i) => (
              <span key={i} className="text-xs bg-chart-5/10 text-chart-5 border border-chart-5/30 rounded px-1.5 py-0.5">{s}</span>
            ))}
          </div>
        </div>
      )}

      {research.runner_notes?.filter(n => n.runner).length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Runner Notes</div>
          <div className="space-y-1">
            {research.runner_notes.filter(n => n.runner).map((n, i) => (
              <div key={i} className="text-xs">
                <span className="font-medium">{n.runner}:</span> <span className="text-muted-foreground">{n.notes}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {research.form_comments && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Form Comments</div>
          <div className="text-xs text-muted-foreground">{research.form_comments}</div>
        </div>
      )}

      {research.trainer_jockey_notes && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Trainer / Jockey Notes</div>
          <div className="text-xs text-muted-foreground">{research.trainer_jockey_notes}</div>
        </div>
      )}

      {research.public_tips?.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Public Tips</div>
          <div className="space-y-0.5">
            {research.public_tips.map((t, i) => (
              <div key={i} className="text-xs text-muted-foreground">• {t}</div>
            ))}
          </div>
        </div>
      )}

      {research.market_news && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Market News</div>
          <div className="text-xs text-muted-foreground">{research.market_news}</div>
        </div>
      )}

      {research.risk_warnings?.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Risk Warnings</div>
          <div className="space-y-0.5">
            {research.risk_warnings.map((r, i) => (
              <div key={i} className="text-xs text-chart-4">⚠ {r}</div>
            ))}
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Source Links</div>
          <div className="space-y-0.5">
            {sources.slice(0, 10).map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-chart-3 hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3 shrink-0" /> {s.title || s.url}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground italic">
        Web research is supplementary context only. The AI must not bet based solely on public tips.
      </div>
    </div>
  );
}

function ResearchField({ label, value }) {
  return (
    <div className="bg-muted/30 rounded p-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-xs font-medium mt-0.5">{value}</div>
    </div>
  );
}