import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel, PLValue } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, BookOpen, Archive, CheckCircle2, Clock, TrendingUp, Shield, Target, Zap, Activity, Download, ChevronRight, Copy, XCircle, RotateCcw } from 'lucide-react';
import { STRATEGY_LIBRARY } from '@/lib/strategyLibrary';
import { getLiveAuditData } from '@/lib/liveAuditData';
import { computeTrafficLight, computeDataQuality, getPaperProgress, reconcileMetrics } from '@/lib/strategyValidation';
import { StrategyStatusBadge, DataQualityBadge, MetricWarningBadge } from '@/components/strategy/StrategyStatusBadge';
import { generateStrategyDocument } from '@/lib/strategyDocument';

const CATEGORY_ICONS = {
  'Value Betting': Target,
  'Scalping': Zap,
  'Directional': TrendingUp,
  'Momentum': Activity,
  'In-Play': Clock,
  'Arbitrage': Shield,
};

const TABS = [
  { key: 'all', label: 'All Strategies' },
  { key: 'green', label: 'Paper Validated' },
  { key: 'yellow', label: 'Paper Testing' },
  { key: 'red', label: 'Failing' },
  { key: 'grey', label: 'Archived' },
];

export default function StrategyLibrary() {
  const navigate = useNavigate();
  const { settings, paperOrders, strategyStats, addAuditLog, resetStrategyData } = useApp();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [view, setView] = useState('grid');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetStrategyData = async () => {
    await resetStrategyData();
    setShowResetConfirm(false);
  };

  const strategiesWithStatus = useMemo(() => {
    return STRATEGY_LIBRARY.map(s => {
      const audit = getLiveAuditData(s.name, paperOrders, strategyStats);
      const status = computeTrafficLight(s, audit, settings);
      const dq = computeDataQuality(s, audit);
      const progress = getPaperProgress(audit);
      const recon = reconcileMetrics(audit);
      return { ...s, audit, status, dataQuality: dq, progress, reconValid: recon.valid };
    });
  }, [settings, paperOrders, strategyStats]);

  const filtered = useMemo(() => {
    return strategiesWithStatus.filter(s => {
      if (tab !== 'all' && s.status.light !== tab) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [strategiesWithStatus, search, tab]);

  const counts = useMemo(() => {
    const c = { all: strategiesWithStatus.length, green: 0, yellow: 0, red: 0, grey: 0 };
    strategiesWithStatus.forEach(s => c[s.status.light]++);
    return c;
  }, [strategiesWithStatus]);

  const handleClone = (s) => {
    addAuditLog('Strategy Cloned', 'strategy', 'info', `Cloned "${s.name}" as new paper-only test strategy`);
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total</span>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{counts.all}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Paper Validated</span>
            <CheckCircle2 className="h-4 w-4 text-chart-1" />
          </div>
          <div className="text-2xl font-bold font-mono text-chart-1">{counts.green}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Paper Testing</span>
            <Clock className="h-4 w-4 text-chart-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-chart-4">{counts.yellow}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Failing / Locked</span>
            <XCircle className="h-4 w-4 text-chart-5" />
          </div>
          <div className="text-2xl font-bold font-mono text-chart-5">{counts.red}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Archived</span>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono text-muted-foreground">{counts.grey}</div>
        </div>
      </div>

      {/* Tabs + Filters */}
      <Panel>
        <div className="border-b border-border px-4 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label} <span className="ml-1 text-muted-foreground">({counts[t.key]})</span>
            </button>
          ))}
        </div>
        <div className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search strategies..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Button variant="outline" onClick={() => generateStrategyDocument(paperOrders, strategyStats)}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download Document</span>
          </Button>
          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-chart-5 font-medium hidden sm:inline">Reset all strategy stats, signals & AI decisions?</span>
              <Button variant="destructive" size="sm" onClick={handleResetStrategyData}>
                <CheckCircle2 className="h-3 w-3" /> Confirm
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(false)}>
                <XCircle className="h-3 w-3" /> Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowResetConfirm(true)}>
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset Strategy Data</span>
            </Button>
          )}
          <div className="flex gap-1">
            <Button variant={view === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setView('grid')}>
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button variant={view === 'table' ? 'default' : 'outline'} size="icon" onClick={() => setView('table')}>
              <Archive className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Panel>

      {/* Strategy Cards */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map(s => {
            const CatIcon = CATEGORY_ICONS[s.category] || BookOpen;
            return (
              <Panel key={s.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/strategy/${s.id}`)}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.status === 'active' ? 'bg-chart-1/10' : 'bg-muted/20'}`}>
                        <CatIcon className={`h-5 w-5 ${s.status === 'active' ? 'text-chart-1' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground hover:text-primary transition-colors">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.category}</div>
                      </div>
                    </div>
                    <StrategyStatusBadge light={s.status.light} label={s.status.label} />
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">{s.description}</p>

                  {/* Paper progress bar */}
                  {s.status.light !== 'grey' && (
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Paper Trading Progress</span>
                        <span className="font-mono">{s.progress.current} / {s.progress.target}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.progress.percent >= 100 ? 'bg-chart-1' : 'bg-chart-4'}`}
                          style={{ width: `${s.progress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Key metrics */}
                  {s.audit && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-background/50 border border-border rounded p-2 text-center">
                        <div className="text-sm font-bold font-mono text-foreground">{s.audit.strikeRate.toFixed(0)}%</div>
                        <div className="text-[9px] text-muted-foreground uppercase">Strike</div>
                      </div>
                      <div className="bg-background/50 border border-border rounded p-2 text-center">
                        <div className={`text-sm font-bold font-mono ${s.audit.netProfit >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>
                          {s.audit.netProfit >= 0 ? '+' : ''}${s.audit.netProfit.toFixed(0)}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase">Net P/L</div>
                      </div>
                      <div className="bg-background/50 border border-border rounded p-2 text-center">
                        <div className={`text-sm font-bold font-mono ${s.audit.roi >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>
                          {s.audit.roi.toFixed(1)}%
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase">ROI</div>
                      </div>
                    </div>
                  )}

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <DataQualityBadge status={s.dataQuality.status} label={s.dataQuality.label} />
                    {!s.reconValid && <MetricWarningBadge />}
                    {s.audit?.closingLineValue < 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-chart-5/10 text-chart-5 border-chart-5/30">Negative CLV</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => navigate(`/strategy/${s.id}`)}>
                      View Details <ChevronRight className="h-3 w-3" />
                    </Button>
                    {s.status.light === 'grey' && (
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => handleClone(s)}>
                        <Copy className="h-3 w-3" /> Clone
                      </Button>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      ) : (
        <Panel title="Strategy Catalogue">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Strategy</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Data Quality</TableHead>
                <TableHead className="text-xs text-right">Orders</TableHead>
                <TableHead className="text-xs text-right">Progress</TableHead>
                <TableHead className="text-xs text-right">Strike</TableHead>
                <TableHead className="text-xs text-right">Net P/L</TableHead>
                <TableHead className="text-xs text-right">ROI</TableHead>
                <TableHead className="text-xs text-right">CLV</TableHead>
                <TableHead className="text-xs text-right">PF</TableHead>
                <TableHead className="text-xs"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id} className="border-border cursor-pointer hover:bg-accent/30" onClick={() => navigate(`/strategy/${s.id}`)}>
                  <TableCell className="text-xs font-semibold">{s.name}</TableCell>
                  <TableCell><StrategyStatusBadge light={s.status.light} label={s.status.label} /></TableCell>
                  <TableCell><DataQualityBadge status={s.dataQuality.status} label={s.dataQuality.label} /></TableCell>
                  <TableCell className="text-xs text-right font-mono">{s.audit?.totalPaperOrders ?? '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{s.audit ? `${s.progress.current}/${s.progress.target}` : '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{s.audit ? `${s.audit.strikeRate.toFixed(0)}%` : '—'}</TableCell>
                  <TableCell className="text-xs text-right">{s.audit ? <PLValue value={s.audit.netProfit} /> : '—'}</TableCell>
                  <TableCell className={`text-xs text-right font-mono ${s.audit && s.audit.roi >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{s.audit ? `${s.audit.roi.toFixed(1)}%` : '—'}</TableCell>
                  <TableCell className={`text-xs text-right font-mono ${s.audit && s.audit.closingLineValue >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{s.audit ? `${s.audit.closingLineValue.toFixed(1)}%` : '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{s.audit?.profitFactor?.toFixed(2) ?? '—'}</TableCell>
                  <TableCell><ChevronRight className="h-3 w-3 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <div className="text-sm">No strategies match your filters.</div>
        </div>
      )}
    </div>
  );
}