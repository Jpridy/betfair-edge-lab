import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Panel, StatusBadge, PLValue, SideBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Archive, Copy, RotateCcw, FileDown, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { STRATEGY_LIBRARY } from '@/lib/strategyLibrary';
import { getLiveAuditData } from '@/lib/liveAuditData';
import { computeTrafficLight, computeDataQuality, getPaperProgress } from '@/lib/strategyValidation';
import { StrategyStatusBadge, DataQualityBadge } from '@/components/strategy/StrategyStatusBadge';
import AuditPanel from '@/components/strategy/AuditPanel';
import StrategyCharts from '@/components/strategy/StrategyCharts';
import FavOutsiderBreakdown from '@/components/strategy/FavOutsiderBreakdown';
import { generateStrategyDocument } from '@/lib/strategyDocument';

const RISK_COLORS = {
  'Low': 'text-success',
  'Medium': 'text-warning',
  'Medium-High': 'text-danger',
  'High': 'text-danger',
};

export default function StrategyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings, paperOrders, strategyStats, addAuditLog } = useApp();
  const [activeTab, setActiveTab] = useState('overview');

  const strategy = useMemo(() => STRATEGY_LIBRARY.find(s => s.id === id), [id]);
  const audit = useMemo(() => strategy ? getLiveAuditData(strategy.name, paperOrders, strategyStats) : null, [strategy, paperOrders, strategyStats]);
  const status = useMemo(() => strategy ? computeTrafficLight(strategy, audit, settings) : null, [strategy, audit, settings]);
  const dataQuality = useMemo(() => strategy ? computeDataQuality(strategy, audit) : null, [strategy, audit]);
  const progress = useMemo(() => getPaperProgress(audit), [audit]);

  const recentOrders = useMemo(() => {
    if (!strategy) return [];
    return paperOrders.filter(o => o.strategyName === strategy.name).slice(0, 10);
  }, [paperOrders, strategy]);

  if (!strategy || !audit || !status) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <div className="text-sm">Strategy not found.</div>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/strategy-library')}>Back to Library</Button>
      </div>
    );
  }

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'audit', label: 'Audit Panel' },
    { key: 'charts', label: 'Performance Charts' },
    { key: 'orders', label: 'Recent Orders' },
    ...(strategy.name === 'Fav/Outsider' ? [{ key: 'breakdown', label: 'Breakdown' }] : []),
    { key: 'controls', label: 'Controls' },
  ];

  const handleClone = () => {
    addAuditLog('Strategy Cloned', 'strategy', 'info', `Cloned "${strategy.name}" as new paper-only test strategy`);
  };

  const handleArchive = () => {
    addAuditLog('Strategy Archived', 'strategy', 'warning', `Archived strategy "${strategy.name}"`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/strategy-library')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">{strategy.name}</h1>
              <StrategyStatusBadge light={status.light} label={status.label} size="md" />
            </div>
            <div className="text-xs text-muted-foreground mt-1">{strategy.category} · {strategy.riskProfile} Risk</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => generateStrategyDocument()}>
            <FileDown className="h-3 w-3" /> Export PDF
          </Button>
          {strategy.status === 'archived' ? (
            <Button variant="outline" size="sm" onClick={handleClone}>
              <Copy className="h-3 w-3" /> Clone as New Test
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="h-3 w-3" /> Archive
            </Button>
          )}
        </div>
      </div>

      {/* Warning banner for failing/archived */}
      {status.light === 'red' && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-danger shrink-0" />
          <div>
            <div className="text-sm font-bold text-danger">This strategy is currently underperforming and is limited to paper testing only.</div>
            <div className="text-xs text-muted-foreground mt-1">{status.reasons.join(' · ')}</div>
          </div>
        </div>
      )}
      {status.light === 'grey' && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 flex items-start gap-3">
          <Archive className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <div className="text-sm font-bold text-muted-foreground">This strategy is archived.</div>
            <div className="text-xs text-muted-foreground mt-1">No new signals or orders will be generated. Past performance is available for review. Clone to create a new paper-only test version.</div>
          </div>
        </div>
      )}
      {status.light === 'yellow' && audit.totalPaperOrders < 200 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-warning shrink-0" />
          <div>
            <div className="text-sm font-bold text-warning">Needs More Data</div>
            <div className="text-xs text-muted-foreground mt-1">Only {audit.totalPaperOrders} paper orders recorded. Minimum 200 recommended for meaningful analysis.</div>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Net P/L</span>
          <div className="text-lg font-bold font-mono mt-1"><PLValue value={audit.netProfit} /></div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ROI</span>
          <div className={`text-lg font-bold font-mono mt-1 ${audit.roi >= 0 ? 'text-success' : 'text-danger'}`}>{audit.roi.toFixed(1)}%</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Strike Rate</span>
          <div className="text-lg font-bold font-mono mt-1">{audit.strikeRate.toFixed(0)}%</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Profit Factor</span>
          <div className={`text-lg font-bold font-mono mt-1 ${audit.profitFactor >= 1.2 ? 'text-success' : 'text-danger'}`}>{audit.profitFactor.toFixed(2)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">CLV</span>
          <div className={`text-lg font-bold font-mono mt-1 ${audit.closingLineValue >= 0 ? 'text-success' : 'text-danger'}`}>{audit.closingLineValue.toFixed(1)}%</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Max DD</span>
          <div className="text-lg font-bold font-mono text-danger mt-1">${audit.maxDrawdown.toFixed(0)}</div>
        </div>
      </div>

      {/* Paper progress */}
      {status.light !== 'grey' && (
        <Panel title="Paper Testing Progress">
          <div className="p-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">{progress.current} / {progress.target} settled trades completed for validation</span>
              <span className="font-mono font-bold">{progress.percent.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progress.percent >= 100 ? 'bg-success' : 'bg-warning'}`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        </Panel>
      )}

      {/* Tabs */}
      <Panel>
        <div className="border-b border-border flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Panel>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel title="Strategy Overview">
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{strategy.description}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pt-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-semibold">{strategy.category}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Risk Profile</span><span className={`font-semibold ${RISK_COLORS[strategy.riskProfile] || ''}`}>{strategy.riskProfile}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Min Edge</span><span className="font-mono font-semibold">{strategy.minEdge.toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Min Liquidity</span><span className="font-mono font-semibold">${strategy.minLiquidity.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Market Types</span><span className="font-semibold">{strategy.marketTypes.join(', ')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Time Window</span><span className="font-semibold text-right">{strategy.timeWindow}</span></div>
              </div>
            </div>
          </Panel>

          <Panel title="Entry Rules">
            <div className="p-4">
              <p className="text-xs text-foreground leading-relaxed">{strategy.entryRules}</p>
            </div>
          </Panel>

          <Panel title="Exit Rules">
            <div className="p-4">
              <p className="text-xs text-foreground leading-relaxed">{strategy.exitRules}</p>
            </div>
          </Panel>

          <Panel title="Data Quality">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <DataQualityBadge status={dataQuality.status} label={dataQuality.label} />
              </div>
              {dataQuality.warnings.length > 0 && (
                <div className="space-y-1">
                  {dataQuality.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
              {dataQuality.warnings.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-success">
                  <CheckCircle2 className="h-3 w-3" /> All data quality checks passed.
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {activeTab === 'audit' && <AuditPanel audit={audit} />}

      {activeTab === 'charts' && <StrategyCharts audit={audit} />}

      {activeTab === 'orders' && (
        <Panel title={`Recent Paper Orders (${recentOrders.length})`}>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Market</TableHead>
                <TableHead className="text-xs">Runner</TableHead>
                <TableHead className="text-xs">Side</TableHead>
                <TableHead className="text-xs text-right">Odds</TableHead>
                <TableHead className="text-xs text-right">Stake</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Result</TableHead>
                <TableHead className="text-xs text-right">Net P/L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">No paper orders for this strategy yet.</TableCell></TableRow>
              ) : recentOrders.map(o => (
                <TableRow key={o.id} className="border-border">
                  <TableCell className="text-xs text-muted-foreground">{new Date(o.created_date).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell className="text-xs">{o.marketName}</TableCell>
                  <TableCell className="text-xs">{o.runnerName}</TableCell>
                  <TableCell><SideBadge side={o.side} /></TableCell>
                  <TableCell className="text-xs text-right font-mono">{o.matchedOdds?.toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-right font-mono">${o.matchedStake}</TableCell>
                  <TableCell><StatusBadge status={o.status === 'matched' ? 'ok' : 'neutral'}>{o.status}</StatusBadge></TableCell>
                  <TableCell><StatusBadge status={o.result === 'won' ? 'ok' : o.result === 'lost' ? 'danger' : 'neutral'}>{o.result}</StatusBadge></TableCell>
                  <TableCell className="text-xs text-right"><PLValue value={o.netProfit} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {activeTab === 'breakdown' && strategy.name === 'Fav/Outsider' && (
        <FavOutsiderBreakdown breakdown={audit.favOutsiderBreakdown} />
      )}

      {activeTab === 'controls' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel title="Paper-Only Status">
            <div className="p-4 space-y-3">
              <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
                This strategy operates in paper-only mode. Advanced review is disabled. No real bets are placed.
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paper Trade Only</span>
                <StatusBadge status="ok">Always On</StatusBadge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Form Data</span>
                <StatusBadge status="neutral">Not Connected</StatusBadge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bookmaker Data</span>
                <StatusBadge status="neutral">Not Connected</StatusBadge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Historical Data</span>
                <StatusBadge status="neutral">Not Connected</StatusBadge>
              </div>
            </div>
          </Panel>

          <Panel title="Admin Controls">
            <div className="p-4 space-y-3">
              <div className="text-xs text-muted-foreground mb-2">Admin actions are logged. Some actions are disabled in paper-only mode.</div>
              <Button variant="outline" size="sm" className="w-full justify-start opacity-50 cursor-not-allowed" disabled>
                <RotateCcw className="h-3 w-3" /> Reset Paper Testing (disabled)
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start opacity-50 cursor-not-allowed" disabled>
                <Archive className="h-3 w-3" /> Archive Strategy (disabled)
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start opacity-50 cursor-not-allowed" disabled>
                <Copy className="h-3 w-3" /> Clone as New Test (disabled)
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start opacity-50 cursor-not-allowed" disabled>
                <FileDown className="h-3 w-3" /> Export PDF (disabled)
              </Button>

              <div className="pt-3 border-t border-border">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Review Notes</div>
                <textarea
                  className="w-full bg-background border border-border rounded-md p-2 text-xs text-foreground resize-none"
                  rows={3}
                  placeholder="Add strategy review notes..."
                  onBlur={(e) => e.target.value && addAuditLog('Review Note Added', 'strategy', 'info', `"${strategy.name}": ${e.target.value}`)}
                />
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}