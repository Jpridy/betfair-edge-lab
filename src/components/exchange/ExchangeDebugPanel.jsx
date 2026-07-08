import React from 'react';
import { Panel, StatusBadge, SideBadge } from '@/components/ui/Trading';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Bug, Activity, AlertCircle } from 'lucide-react';

export default function ExchangeDebugPanel({ diagnostics, eventClusters, opportunities }) {
  if (!diagnostics) return null;

  const backCount = opportunities.filter(o => o.side === 'BACK').length;
  const layCount = opportunities.filter(o => o.side === 'LAY').length;
  const positiveEV = opportunities.filter(o => o.decision === 'BET').length;
  const rejected = opportunities.filter(o => o.decision === 'NO_BET').length;
  const winMarkets = eventClusters.reduce((s, c) => s + c.winMarkets.length, 0);
  const placeMarkets = eventClusters.reduce((s, c) => s + c.placeMarkets.length, 0);
  const h2hMarkets = eventClusters.reduce((s, c) => s + c.h2hMarkets.length, 0);
  const topRejected = (diagnostics.topRejected || []).slice(0, 10);
  const best = diagnostics.bestOpportunity || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bug className="h-4 w-4 text-chart-2" />
        <h2 className="text-sm font-bold font-heading">Exchange Engine Debug</h2>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <DebugStat label="Markets Scanned" value={diagnostics.marketsScanned ?? 0} />
        <DebugStat label="Events Found" value={diagnostics.eventsScanned ?? 0} />
        <DebugStat label="Events w/ AI" value={diagnostics.eventsWithAI ?? 0} />
        <DebugStat label="WIN Markets" value={winMarkets} accent="text-chart-3" />
        <DebugStat label="PLACE Markets" value={placeMarkets} accent="text-chart-1" />
        <DebugStat label="H2H Markets" value={h2hMarkets} accent="text-chart-4" />
        <DebugStat label="Total Opps" value={opportunities.length} />
        <DebugStat label="BACK Opps" value={backCount} accent="text-chart-3" />
        <DebugStat label="LAY Opps" value={layCount} accent="text-chart-5" />
        <DebugStat label="Positive EV" value={positiveEV} accent={positiveEV > 0 ? 'text-chart-1' : 'text-muted-foreground'} />
        <DebugStat label="Rejected" value={rejected} accent="text-chart-5" />
        <DebugStat label="Cache Hits" value={diagnostics.cacheHits ?? 0} accent="text-chart-2" />
      </div>

      {/* Best opportunity selected */}
      <Panel title="Best Opportunity Selected">
        <div className="p-4">
          {best ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <SideBadge side={best.side} />
                <StatusBadge status={best.marketType === 'WIN' ? 'info' : best.marketType === 'PLACE' ? 'ok' : 'warning'}>{best.marketType}</StatusBadge>
                <span className="font-semibold text-sm">{best.runnerName}</span>
                <span className="text-xs text-muted-foreground">@ {best.odds?.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div><span className="text-muted-foreground">EV:</span> <span className="font-mono text-chart-1">${best.ev?.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">ROI:</span> <span className="font-mono text-chart-1">{(best.roi * 100)?.toFixed(2)}%</span></div>
                <div><span className="text-muted-foreground">Edge:</span> <span className="font-mono">{(best.edge * 100)?.toFixed(2)}%</span></div>
                <div><span className="text-muted-foreground">Liability:</span> <span className="font-mono">${best.liability?.toFixed(0)}</span></div>
                <div><span className="text-muted-foreground">Delay Risk:</span> <span className="font-mono">{best.delayRiskScore?.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Fill Prob:</span> <span className="font-mono">{(best.fillProbability * 100)?.toFixed(0)}%</span></div>
                <div><span className="text-muted-foreground">Prob:</span> <span className="font-mono">{(best.modelProbability * 100)?.toFixed(1)}%</span></div>
                <div><span className="text-muted-foreground">Confidence:</span> <span className="font-mono">{best.confidence?.toFixed(0)}</span></div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>{diagnostics.noBetReason || 'No positive-EV opportunity found'}</span>
            </div>
          )}
        </div>
      </Panel>

      {/* Market detection log */}
      {diagnostics.marketDetectionLog?.length > 0 && (
        <Panel title="Market Detection Log">
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Market Name</TableHead>
                  <TableHead className="text-xs">Type Code</TableHead>
                  <TableHead className="text-xs">Detected</TableHead>
                  <TableHead className="text-right text-xs">Runners</TableHead>
                  <TableHead className="text-right text-xs">Base Rate</TableHead>
                  <TableHead className="text-right text-xs">Matched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagnostics.marketDetectionLog.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{m.marketName}</TableCell>
                    <TableCell className="text-xs font-mono">{m.marketTypeCode || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={m.detectedMarketType === 'WIN' ? 'info' : m.detectedMarketType === 'PLACE' ? 'ok' : m.detectedMarketType === 'H2H' ? 'warning' : 'neutral'}>
                        {m.detectedMarketType}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">{m.runnerCount}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{m.marketBaseRate ? (m.marketBaseRate * 100).toFixed(1) + '%' : '—'}</TableCell>
                    <TableCell className="text-right text-xs font-mono">${(m.totalMatched || 0).toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      {/* Top 10 rejected opportunities */}
      {topRejected.length > 0 && (
        <Panel title={`Top 10 Rejected Opportunities`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Side</TableHead>
                <TableHead className="text-xs">Runner</TableHead>
                <TableHead className="text-right text-xs">Odds</TableHead>
                <TableHead className="text-right text-xs">Prob</TableHead>
                <TableHead className="text-right text-xs">EV</TableHead>
                <TableHead className="text-right text-xs">ROI</TableHead>
                <TableHead className="text-right text-xs">Conf</TableHead>
                <TableHead className="text-xs">Failed Gate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topRejected.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{r.marketType}</TableCell>
                  <TableCell><SideBadge side={r.side} /></TableCell>
                  <TableCell className="text-xs font-medium">{r.runnerName}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{r.odds?.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{(r.modelProbability * 100)?.toFixed(1)}%</TableCell>
                  <TableCell className="text-right text-xs font-mono">{r.ev?.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{(r.roi * 100)?.toFixed(1)}%</TableCell>
                  <TableCell className="text-right text-xs font-mono">{r.confidence?.toFixed(0)}</TableCell>
                  <TableCell className="text-xs text-chart-5">{r.failedGate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {/* Cache stats */}
      {diagnostics.cacheStats && (
        <Panel title="AI Cache Stats">
          <div className="p-4 text-xs space-y-1">
            <div><span className="text-muted-foreground">Cache entries:</span> <span className="font-mono">{diagnostics.cacheStats.entries}</span></div>
            <div><span className="text-muted-foreground">Cache hits this cycle:</span> <span className="font-mono">{diagnostics.cacheHits || 0}</span></div>
            <div><span className="text-muted-foreground">AI calls this cycle:</span> <span className="font-mono">{diagnostics.eventsWithAI || 0}</span></div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function DebugStat({ label, value, accent }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${accent || 'text-foreground'}`}>{value}</div>
    </div>
  );
}