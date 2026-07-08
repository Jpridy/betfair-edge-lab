import React from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe, Search, AlertTriangle, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useApp } from '@/lib/AppContext';

export default function OpenAISearchDebugPanel() {
  const { lastExchangeDiagnostics, featherlessSettings } = useApp();

  const searchDiag = lastExchangeDiagnostics?.externalSearchDiagnostics;
  if (!searchDiag) {
    return (
      <Panel title="OpenAI External Search">
        <div className="p-6 text-center text-sm text-muted-foreground">
          No external search data yet. Run a scan cycle to see OpenAI web search activity.
        </div>
      </Panel>
    );
  }

  const {
    enabled,
    cacheHits = 0,
    cacheMisses = 0,
    callsThisCycle = 0,
    timeouts = 0,
    errors = 0,
    totalSourcesFound = 0,
    runnersAffected = 0,
    probabilityChanges = [],
    decisionChanges = [],
    latestSearchQuery = '',
    latestSearchSummary = '',
    latestSearchStatus = 'not_called',
    perEventResults = [],
  } = searchDiag;

  const openaiConnected = featherlessSettings?.externalSearchEnabled === true;
  const webSearchEnabled = openaiConnected;

  const statusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-3.5 w-3.5 text-chart-1" />;
      case 'timeout': return <AlertTriangle className="h-3.5 w-3.5 text-chart-4" />;
      case 'error': return <XCircle className="h-3.5 w-3.5 text-chart-5" />;
      case 'no_results': return <AlertTriangle className="h-3.5 w-3.5 text-chart-4" />;
      default: return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const statusBadge = (status) => {
    const map = { success: 'ok', timeout: 'warning', error: 'danger', no_results: 'warning', not_called: 'neutral', disabled: 'neutral' };
    return <StatusBadge status={map[status] || 'neutral'}>{status?.toUpperCase().replace(/_/g, ' ')}</StatusBadge>;
  };

  return (
    <Panel
      title="OpenAI External Search"
      action={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {openaiConnected ? <CheckCircle2 className="h-3.5 w-3.5 text-chart-1" /> : <XCircle className="h-3.5 w-3.5 text-chart-5" />}
            <span className="text-[10px] font-medium text-muted-foreground">API {openaiConnected ? 'Connected' : 'Disabled'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {webSearchEnabled ? <Globe className="h-3.5 w-3.5 text-chart-3" /> : <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-[10px] font-medium text-muted-foreground">Web Search {webSearchEnabled ? 'On' : 'Off'}</span>
          </div>
        </div>
      }
    >
      {/* Stats grid */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-px bg-border">
        {[
          { label: 'Calls', value: callsThisCycle, color: 'text-foreground' },
          { label: 'Cache Hits', value: cacheHits, color: 'text-chart-3' },
          { label: 'Cache Miss', value: cacheMisses, color: 'text-chart-4' },
          { label: 'Timeouts', value: timeouts, color: 'text-chart-4' },
          { label: 'Errors', value: errors, color: 'text-chart-5' },
          { label: 'Sources', value: totalSourcesFound, color: 'text-chart-1' },
          { label: 'Runners', value: runnersAffected, color: 'text-foreground' },
          { label: 'Decisions', value: decisionChanges.length, color: 'text-chart-2' },
        ].map(s => (
          <div key={s.label} className="bg-card p-2 text-center">
            <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Latest search */}
      {latestSearchQuery && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Latest Search Query</span>
            {statusIcon(latestSearchStatus)}
          </div>
          <div className="text-xs font-mono text-foreground bg-muted/50 rounded px-2 py-1.5 mb-2">{latestSearchQuery}</div>
          {latestSearchSummary && (
            <div className="text-xs text-muted-foreground">{latestSearchSummary}</div>
          )}
        </div>
      )}

      {/* Per-event results */}
      {perEventResults.length > 0 && (
        <div className="border-b border-border">
          <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
            Per-Event Search Results
          </div>
          <div className="max-h-48 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px] h-7 px-2">Event</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Status</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Sources</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Runners</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Quality</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Cache</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perEventResults.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[10px] px-2 py-1 truncate max-w-[160px]">{r.eventName || r.eventId}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1">{statusBadge(r.searchStatus)}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{r.sourceCount || 0}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{r.runnersResearched || 0}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{r.dataQuality || 0}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1">{r.cacheHit ? <StatusBadge status="info">HIT</StatusBadge> : <StatusBadge status="neutral">MISS</StatusBadge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Probability changes */}
      {probabilityChanges.length > 0 && (
        <div className="border-b border-border">
          <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
            Probability Changes Caused by External Search
          </div>
          <div className="max-h-48 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px] h-7 px-2">Runner</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Pre</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Post</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Δ</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {probabilityChanges.map((pc, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[10px] px-2 py-1 truncate max-w-[120px]">{pc.runnerName}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{(pc.preSearchProbability * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{(pc.postSearchProbability * 100).toFixed(1)}%</TableCell>
                    <TableCell className={`text-[10px] px-2 py-1 text-right font-mono ${pc.probabilityDelta > 0 ? 'text-chart-1' : pc.probabilityDelta < 0 ? 'text-chart-5' : 'text-muted-foreground'}`}>
                      {pc.probabilityDelta > 0 ? '+' : ''}{(pc.probabilityDelta * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-[10px] px-2 py-1">
                      <StatusBadge status={pc.decisionImpact?.includes('increased') ? 'ok' : pc.decisionImpact?.includes('decreased') ? 'danger' : 'neutral'}>
                        {pc.decisionImpact?.replace(/_/g, ' ')}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Decision changes */}
      {decisionChanges.length > 0 && (
        <div className="px-4 py-3">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Decision Changes</div>
          <div className="space-y-1">
            {decisionChanges.map((dc, i) => (
              <div key={i} className="text-xs flex items-center gap-2">
                <StatusBadge status={dc.changedTo === 'BET' ? 'ok' : dc.changedTo === 'NO_BET' ? 'danger' : 'warning'}>
                  {dc.changedTo}
                </StatusBadge>
                <span className="text-foreground">{dc.runnerName}</span>
                <span className="text-muted-foreground">was {dc.was}</span>
                {dc.reason && <span className="text-muted-foreground">— {dc.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disabled notice */}
      {!openaiConnected && (
        <div className="px-4 py-3 bg-muted/30 text-xs text-muted-foreground">
          External search is disabled. Enable it in Settings → Featherless AI → External Search to allow OpenAI web search to provide evidence and probability adjustments.
        </div>
      )}

      {/* Authority notice */}
      <div className="px-4 py-2 bg-chart-2/5 border-t border-chart-2/20 text-[10px] text-muted-foreground">
        Exchange engine remains the final authority. OpenAI provides evidence only — EV, ROI, spread, liquidity, exposure, and BET/NO_BET are calculated deterministically every cycle.
      </div>
    </Panel>
  );
}