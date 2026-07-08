import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/lib/AppContext';
import { base44 } from '@/api/base44Client';
import { scanEligibleMarkets, runExchangeCycle, opportunityToSignal } from '@/lib/exchangeOpportunityEngine';
import { getBestByCategory, MARKET_TYPE_THRESHOLDS } from '@/lib/crossMarketValueScanner';
import { clusterMarketsByEvent, detectMarketType } from '@/lib/marketClusterer';
import { Panel, StatCard, StatusBadge, SideBadge, PLValue } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { RefreshCw, TrendingUp, TrendingDown, Zap, Shield, AlertTriangle, Target } from 'lucide-react';

export default function ExchangeOpportunities() {
  const { markets, runners, settings, featherlessSettings, bankrollStats, paperOrders, emergencyStop, addAuditLog } = useApp();
  const [scanning, setScanning] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [eventClusters, setEventClusters] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [lastScan, setLastScan] = useState(null);

  const eligibleMarkets = useMemo(() => scanEligibleMarkets(markets, runners, settings), [markets, runners, settings]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await runExchangeCycle({
        markets, runners, settings, featherlessSettings, bankrollStats, paperOrders, emergencyStop,
        callAI: async (cluster, primaryMarket, marketRunners) => {
          const resp = await base44.functions.invoke('featherlessAI', {
            market: primaryMarket,
            runners: marketRunners,
            settings,
            strategySettings: featherlessSettings,
            bankrollStats,
            raceFormProfiles: marketRunners.map(r => r.raceFormProfile).filter(Boolean),
            allEventMarkets: [...cluster.winMarkets, ...cluster.placeMarkets, ...cluster.h2hMarkets],
          });
          return resp.data?.aiResult || null;
        },
      });
      setOpportunities(result.allOpportunities);
      setEventClusters(result.eventClusters);
      setDiagnostics(result.diagnostics);
      setLastScan(new Date().toISOString());
      addAuditLog('Exchange Scan', 'strategy', 'info', `Scanned ${result.diagnostics.marketsScanned} markets across ${result.diagnostics.eventsScanned} events. ${result.diagnostics.positiveEVOpportunities} positive-EV opportunities found.`);
    } catch (err) {
      addAuditLog('Exchange Scan Error', 'strategy', 'error', err.message);
    } finally {
      setScanning(false);
    }
  };

  const bestByCategory = useMemo(() => getBestByCategory(opportunities), [opportunities]);
  const betOpportunities = opportunities.filter(o => o.decision === 'BET');
  const blockedOpportunities = opportunities.filter(o => o.decision === 'NO_BET');

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading">Exchange Opportunities</h1>
          <p className="text-sm text-muted-foreground mt-1">Multi-market value scanner: WIN, PLACE & H2H — BACK and LAY</p>
        </div>
        <Button onClick={handleScan} disabled={scanning || emergencyStop}>
          <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Scan All Markets'}
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Markets Scanned" value={diagnostics?.marketsScanned || eligibleMarkets.length} icon={Target} accent="text-chart-3" />
        <StatCard label="Events Found" value={diagnostics?.eventsScanned || eventClusters.length} icon={Zap} accent="text-chart-2" />
        <StatCard label="Opportunities" value={opportunities.length} icon={TrendingUp} accent="text-chart-3" />
        <StatCard label="Positive EV" value={betOpportunities.length} icon={Shield} accent={betOpportunities.length > 0 ? 'text-chart-1' : 'text-muted-foreground'} />
      </div>

      {/* Best by category */}
      <Panel title="Best Opportunities by Category">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {[
            { key: 'BACK_WIN', label: 'Best BACK (WIN)' },
            { key: 'LAY_WIN', label: 'Best LAY (WIN)' },
            { key: 'BACK_PLACE', label: 'Best BACK (PLACE)' },
            { key: 'LAY_PLACE', label: 'Best LAY (PLACE)' },
            { key: 'BACK_H2H', label: 'Best BACK (H2H)' },
            { key: 'LAY_H2H', label: 'Best LAY (H2H)' },
          ].map(({ key, label }) => {
            const opp = bestByCategory[key];
            return (
              <div key={key} className={`border rounded-lg p-3 ${opp ? 'border-chart-1/30 bg-chart-1/5' : 'border-border bg-muted/30'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase">{label}</span>
                  {opp && <SideBadge side={opp.side} />}
                </div>
                {opp ? (
                  <div className="space-y-1">
                    <div className="font-semibold text-sm">{opp.runnerName}</div>
                    <div className="text-xs text-muted-foreground">{opp.marketName}</div>
                    <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                      <div><span className="text-muted-foreground">Odds:</span> <span className="font-mono">{opp.odds.toFixed(2)}</span></div>
                      <div><span className="text-muted-foreground">EV:</span> <span className="font-mono text-chart-1">${opp.ev.toFixed(2)}</span></div>
                      <div><span className="text-muted-foreground">ROI:</span> <span className="font-mono text-chart-1">{(opp.roi * 100).toFixed(2)}%</span></div>
                      <div><span className="text-muted-foreground">Edge:</span> <span className="font-mono">{(opp.edge * 100).toFixed(2)}%</span></div>
                      <div><span className="text-muted-foreground">Prob:</span> <span className="font-mono">{(opp.modelProbability * 100).toFixed(1)}%</span></div>
                      <div><span className="text-muted-foreground">Fair:</span> <span className="font-mono">{opp.fairOdds.toFixed(2)}</span></div>
                      <div><span className="text-muted-foreground">Liab:</span> <span className="font-mono">${opp.liability.toFixed(0)}</span></div>
                      <div><span className="text-muted-foreground">Comm:</span> <span className="font-mono">{(opp.commissionRate * 100).toFixed(1)}%</span></div>
                      <div><span className="text-muted-foreground">Conf:</span> <span className="font-mono">{opp.confidence.toFixed(0)}</span></div>
                      <div><span className="text-muted-foreground">DQ:</span> <span className="font-mono">{opp.dataQuality}</span></div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 italic truncate">{opp.reasons[0]}</div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic py-4 text-center">No qualifying opportunity</div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Event clusters overview */}
      {eventClusters.length > 0 && (
        <Panel title={`Event Clusters (${eventClusters.length})`}>
          <div className="p-4 space-y-2">
            {eventClusters.map(cluster => (
              <div key={cluster.eventId} className="flex items-center justify-between border border-border rounded-md p-2 text-sm">
                <div>
                  <span className="font-semibold">{cluster.venue || cluster.eventName || 'Unknown'}</span>
                  {cluster.startTime && <span className="text-muted-foreground ml-2 text-xs">{new Date(cluster.startTime).toLocaleTimeString()}</span>}
                </div>
                <div className="flex gap-2">
                  {cluster.winMarkets.length > 0 && <StatusBadge status="info">WIN ×{cluster.winMarkets.length}</StatusBadge>}
                  {cluster.placeMarkets.length > 0 && <StatusBadge status="ok">PLACE ×{cluster.placeMarkets.length}</StatusBadge>}
                  {cluster.h2hMarkets.length > 0 && <StatusBadge status="warning">H2H ×{cluster.h2hMarkets.length}</StatusBadge>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* All positive-EV opportunities table */}
      {betOpportunities.length > 0 && (
        <Panel title={`Positive-EV Opportunities (${betOpportunities.length})`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead>Runner</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Odds</TableHead>
                <TableHead className="text-right">Prob</TableHead>
                <TableHead className="text-right">Fair</TableHead>
                <TableHead className="text-right">EV</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Edge</TableHead>
                <TableHead className="text-right">Liability</TableHead>
                <TableHead className="text-right">Comm</TableHead>
                <TableHead className="text-right">Conf</TableHead>
                <TableHead className="text-right">DQ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {betOpportunities.map(opp => (
                <TableRow key={opp.opportunityId}>
                  <TableCell className="text-xs">{opp.marketName}</TableCell>
                  <TableCell className="font-medium text-sm">{opp.runnerName}</TableCell>
                  <TableCell><SideBadge side={opp.side} /></TableCell>
                  <TableCell><StatusBadge status={opp.marketType === 'WIN' ? 'info' : opp.marketType === 'PLACE' ? 'ok' : 'warning'}>{opp.marketType}</StatusBadge></TableCell>
                  <TableCell className="text-right font-mono text-sm">{opp.odds.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{(opp.modelProbability * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-mono text-xs">{opp.fairOdds.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-chart-1">${opp.ev.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-chart-1">{(opp.roi * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-mono text-xs">{(opp.edge * 100).toFixed(2)}%</TableCell>
                  <TableCell className="text-right font-mono text-xs">${opp.liability.toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{(opp.commissionRate * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-mono text-xs">{opp.confidence.toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{opp.dataQuality}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {/* Blocked opportunities */}
      {blockedOpportunities.length > 0 && (
        <Panel title={`Blocked Opportunities (${blockedOpportunities.length})`}>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead>Runner</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Blocker</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockedOpportunities.slice(0, 50).map(opp => (
                  <TableRow key={opp.opportunityId}>
                    <TableCell className="text-xs">{opp.marketName}</TableCell>
                    <TableCell className="font-medium text-sm">{opp.runnerName}</TableCell>
                    <TableCell><SideBadge side={opp.side} /></TableCell>
                    <TableCell className="text-xs">{opp.marketType}</TableCell>
                    <TableCell className="text-xs text-chart-5">{opp.blockers[0]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      {/* Empty state */}
      {!scanning && opportunities.length === 0 && (
        <Panel>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No opportunities scanned yet. Click "Scan All Markets" to find value across WIN, PLACE, and H2H markets.</p>
          </div>
        </Panel>
      )}

      {/* Market type thresholds reference */}
      <Panel title="Safety Gate Thresholds by Market Type">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {Object.entries(MARKET_TYPE_THRESHOLDS).map(([type, t]) => (
            <div key={type} className="border border-border rounded-lg p-3">
              <div className="text-sm font-bold mb-2">{type}</div>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <div>Min Odds: <span className="font-mono text-foreground">{t.minOdds}</span></div>
                <div>Max Odds: <span className="font-mono text-foreground">{t.maxOdds}</span></div>
                <div>Min Liquidity: <span className="font-mono text-foreground">${t.minLiquidity}</span></div>
                <div>Max Spread: <span className="font-mono text-foreground">{t.maxSpreadTicks} ticks</span></div>
                <div>Min Edge: <span className="font-mono text-foreground">{t.minEdge}%</span></div>
                <div>Min ROI: <span className="font-mono text-foreground">{t.minROI}%</span></div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}