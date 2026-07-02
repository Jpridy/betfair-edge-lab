import React, { useState, useMemo } from 'react';
import { Panel, StatusBadge, PLValue } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, BookOpen, Archive, CheckCircle2, Clock, TrendingUp, Shield, Target, Zap, Activity } from 'lucide-react';
import { DEMO_STRATEGY_LIBRARY } from '@/lib/demoData';

const CATEGORY_ICONS = {
  'Value Betting': Target,
  'Scalping': Zap,
  'Directional': TrendingUp,
  'Momentum': Activity,
  'In-Play': Clock,
  'Arbitrage': Shield,
};

const RISK_COLORS = {
  'Low': 'text-chart-1',
  'Medium': 'text-chart-4',
  'Medium-High': 'text-chart-5',
  'High': 'text-chart-5',
};

export default function StrategyLibrary() {
  const { strategyStats } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [view, setView] = useState('grid');
  const [expandedId, setExpandedId] = useState(null);

  const strategies = useMemo(() => {
    return DEMO_STRATEGY_LIBRARY.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, statusFilter, categoryFilter]);

  const categories = [...new Set(DEMO_STRATEGY_LIBRARY.map(s => s.category))];
  const activeCount = DEMO_STRATEGY_LIBRARY.filter(s => s.status === 'active').length;
  const archivedCount = DEMO_STRATEGY_LIBRARY.filter(s => s.status === 'archived').length;

  const getStats = (name) => strategyStats.find(s => s.strategyName === name);

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Strategies</span>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{DEMO_STRATEGY_LIBRARY.length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active</span>
            <CheckCircle2 className="h-4 w-4 text-chart-1" />
          </div>
          <div className="text-2xl font-bold font-mono text-chart-1">{activeCount}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Archived</span>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono text-muted-foreground">{archivedCount}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Categories</span>
            <BookOpen className="h-4 w-4 text-chart-2" />
          </div>
          <div className="text-2xl font-bold font-mono text-chart-2">{categories.length}</div>
        </div>
      </div>

      {/* Filters */}
      <Panel>
        <div className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search strategies by name or description..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
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
          {strategies.map(s => {
            const stats = getStats(s.name);
            const CatIcon = CATEGORY_ICONS[s.category] || BookOpen;
            const isExpanded = expandedId === s.id;
            return (
              <Panel key={s.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.status === 'active' ? 'bg-chart-1/10' : 'bg-muted/20'}`}>
                        <CatIcon className={`h-5 w-5 ${s.status === 'active' ? 'text-chart-1' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.category}</div>
                      </div>
                    </div>
                    <StatusBadge status={s.status === 'active' ? 'ok' : 'neutral'}>{s.status === 'active' ? 'Active' : 'Archived'}</StatusBadge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{s.description}</p>

                  {stats && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-background/50 border border-border rounded p-2 text-center">
                        <div className="text-sm font-bold font-mono text-foreground">{stats.totalPaperOrders}</div>
                        <div className="text-[9px] text-muted-foreground uppercase">Orders</div>
                      </div>
                      <div className="bg-background/50 border border-border rounded p-2 text-center">
                        <div className="text-sm font-bold font-mono text-foreground">{stats.strikeRate.toFixed(0)}%</div>
                        <div className="text-[9px] text-muted-foreground uppercase">Strike</div>
                      </div>
                      <div className="bg-background/50 border border-border rounded p-2 text-center">
                        <div className={`text-sm font-bold font-mono ${stats.netProfit >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>
                          {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(0)}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase">Net P/L</div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Risk Profile</span>
                      <span className={`font-semibold ${RISK_COLORS[s.riskProfile] || 'text-foreground'}`}>{s.riskProfile}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min Edge</span>
                      <span className="font-mono font-semibold text-foreground">{s.minEdge.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min Liquidity</span>
                      <span className="font-mono font-semibold text-foreground">${s.minLiquidity.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Market Types</span>
                      <span className="font-semibold text-foreground">{s.marketTypes.join(', ')}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Entry Rules</div>
                        <div className="text-xs text-foreground leading-relaxed">{s.entryRules}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Exit Rules</div>
                        <div className="text-xs text-foreground leading-relaxed">{s.exitRules}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Time Window</div>
                        <div className="text-xs text-foreground">{s.timeWindow}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Created</div>
                          <div className="text-xs font-mono text-foreground">{new Date(s.createdAt).toLocaleDateString('en-AU')}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Last Run</div>
                          <div className="text-xs font-mono text-foreground">{new Date(s.lastRun).toLocaleDateString('en-AU')}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                    {isExpanded ? 'Show Less' : 'View Full Details'}
                  </Button>
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
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Risk</TableHead>
                <TableHead className="text-xs text-right">Min Edge</TableHead>
                <TableHead className="text-xs text-right">Min Liquidity</TableHead>
                <TableHead className="text-xs">Market Types</TableHead>
                <TableHead className="text-xs">Time Window</TableHead>
                <TableHead className="text-xs text-right">Orders</TableHead>
                <TableHead className="text-xs text-right">Strike</TableHead>
                <TableHead className="text-xs text-right">Net P/L</TableHead>
                <TableHead className="text-xs text-right">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {strategies.map(s => {
                const stats = getStats(s.name);
                return (
                  <TableRow key={s.id} className="border-border">
                    <TableCell className="text-xs font-semibold">{s.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.category}</TableCell>
                    <TableCell><StatusBadge status={s.status === 'active' ? 'ok' : 'neutral'}>{s.status}</StatusBadge></TableCell>
                    <TableCell className={`text-xs font-semibold ${RISK_COLORS[s.riskProfile] || ''}`}>{s.riskProfile}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{s.minEdge.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs text-right font-mono">${s.minLiquidity.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{s.marketTypes.join(', ')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.timeWindow}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{stats?.totalPaperOrders ?? '—'}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{stats ? `${stats.strikeRate.toFixed(0)}%` : '—'}</TableCell>
                    <TableCell className="text-xs text-right">{stats ? <PLValue value={stats.netProfit} /> : '—'}</TableCell>
                    <TableCell className={`text-xs text-right font-mono ${stats && stats.roi >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{stats ? `${stats.roi.toFixed(1)}%` : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      )}

      {strategies.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <div className="text-sm">No strategies match your filters.</div>
        </div>
      )}
    </div>
  );
}