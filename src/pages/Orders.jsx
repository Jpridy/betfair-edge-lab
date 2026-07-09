import React, { useState, useMemo } from 'react';
import { Panel, StatusBadge, SideBadge, PLValue } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, AlertTriangle, Inbox } from 'lucide-react';
import { exportToCSV } from '@/lib/csvExport';
import EmptyState from '@/components/EmptyState';

export default function Orders() {
  const { paperOrders, dataLoading } = useApp();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sideFilter, setSideFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [venueFilter, setVenueFilter] = useState('all');
  const [warningOnly, setWarningOnly] = useState(false);
  const [modeFilter, setModeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const strategies = useMemo(
    () => [...new Set(paperOrders.map(o => o.strategyName).filter(Boolean))].sort(),
    [paperOrders]
  );

  const venues = useMemo(
    () => [...new Set(paperOrders.map(o => o.venue).filter(Boolean))].sort(),
    [paperOrders]
  );

  const hasWarning = (o) => {
    return o.status === 'failed' || o.status === 'cancelled' || o.status === 'unmatched' || o.status === 'lapsed' ||
      (o.result === 'lost' && o.netProfit < -50);
  };

  const filtered = paperOrders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (sideFilter !== 'all' && o.side !== sideFilter) return false;
    if (strategyFilter !== 'all' && o.strategyName !== strategyFilter) return false;
    if (resultFilter !== 'all' && o.result !== resultFilter) return false;
    if (venueFilter !== 'all' && o.venue !== venueFilter) return false;
    if (warningOnly && !hasWarning(o)) return false;
    if (modeFilter === 'paper' && !o.paper_mode) return false;
    if (modeFilter === 'live' && !o.liveMode) return false;
    if (search && !o.runnerName?.toLowerCase().includes(search.toLowerCase()) && !o.marketName?.toLowerCase().includes(search.toLowerCase()) && !o.customerRef?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleExportCSV = () => {
    const columns = [
      { key: 'created_date', label: 'Time' },
      { key: 'strategyName', label: 'Strategy' },
      { key: 'marketName', label: 'Market' },
      { key: 'runnerName', label: 'Runner' },
      { key: 'marketStartTime', label: 'Race Start' },
      { key: 'selectionId', label: 'Selection ID' },
      { key: 'side', label: 'Side' },
      { key: 'persistenceType', label: 'Persistence' },
      { key: 'customerRef', label: 'Customer Ref' },
      { key: 'proofMode', label: 'Proof Mode' },
      { key: 'dataSource', label: 'Data Source' },
      { key: 'requestedOdds', label: 'Req Odds' },
      { key: 'matchedOdds', label: 'Match Odds' },
      { key: 'matchedStake', label: 'Stake' },
      { key: 'liability', label: 'Liability' },
      { key: 'status', label: 'Status' },
      { key: 'settlementStatus', label: 'Settlement Status' },
      { key: 'result', label: 'Result' },
      { key: 'resultSource', label: 'Result Source' },
      { key: 'resultConfidence', label: 'Result Confidence' },
      { key: 'grossProfit', label: 'Gross' },
      { key: 'commission', label: 'Commission' },
      { key: 'commissionSource', label: 'Comm Source' },
      { key: 'netProfit', label: 'Net P/L' },
      { key: 'clv', label: 'CLV %' },
      { key: 'slippage', label: 'Slippage' },
      { key: 'entryReason', label: 'Entry Reason' },
      { key: 'exitReason', label: 'Exit Reason' },
      { key: 'rejection_reason', label: 'Rejection Reason' },
      { key: 'warningFlags', label: 'Warning Flags' },
      { key: 'paperSimulationQuality', label: 'Sim Quality' },
    ];
    exportToCSV(`paper-orders-${new Date().toISOString().slice(0, 10)}.csv`, filtered, columns);
  };

  // Only count matched/partially_matched orders in staked totals — rejected/unmatched don't stake real funds
  const stakedOrders = filtered.filter(o => o.status === 'matched' || o.status === 'partially_matched' || o.status === 'settled');
  const totalStake = stakedOrders.reduce((sum, o) => sum + (o.matchedStake || 0), 0);
  const totalUnmatched = filtered.filter(o => o.status !== 'rejected').reduce((sum, o) => sum + ((o.requestedStake || 0) - (o.matchedStake || 0)), 0);
  const totalPL = filtered.reduce((sum, o) => sum + (o.netProfit || 0), 0);
  const matched = filtered.filter(o => o.status === 'matched').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Orders</span>
          <div className="text-xl font-bold font-mono mt-1">{filtered.length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Matched</span>
          <div className="text-xl font-bold font-mono text-chart-1 mt-1">{matched}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Matched Stake</span>
          <div className="text-xl font-bold font-mono mt-1">${totalStake.toFixed(2)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Unmatched Stake</span>
          <div className="text-xl font-bold font-mono text-chart-4 mt-1">${totalUnmatched.toFixed(2)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Net P/L</span>
          <div className={`text-xl font-bold font-mono mt-1 ${totalPL > 0 ? 'text-chart-1' : 'text-chart-5'}`}>{totalPL > 0 ? '+' : ''}${totalPL.toFixed(2)}</div>
        </div>
      </div>

      <Panel title="Order Filters">
        <div className="p-4 flex flex-wrap gap-4">
          <div className="w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="partially_matched">Partially Matched</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
                <SelectItem value="lapsed">Lapsed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={sideFilter} onValueChange={setSideFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sides</SelectItem>
                <SelectItem value="BACK">BACK</SelectItem>
                <SelectItem value="LAY">LAY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={strategyFilter} onValueChange={setStrategyFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Strategies</SelectItem>
                {strategies.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={venueFilter} onValueChange={setVenueFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Venues</SelectItem>
                {venues.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="paper">Paper Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Search runner, market, ref..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 w-64 text-xs" />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="warningOnly" checked={warningOnly} onChange={e => setWarningOnly(e.target.checked)} className="accent-chart-4" />
            <label htmlFor="warningOnly" className="text-xs text-muted-foreground cursor-pointer">Warnings only</label>
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </Panel>

      <Panel title={`Orders — Betfair Exchange Structure (${filtered.length})`}>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs">Strategy</TableHead>
              <TableHead className="text-xs">Market</TableHead>
              <TableHead className="text-xs">Runner</TableHead>
              <TableHead className="text-xs">Race Start</TableHead>
              <TableHead className="text-xs">Side</TableHead>
              <TableHead className="text-xs">Persist</TableHead>
              <TableHead className="text-xs">Mode</TableHead>
              <TableHead className="text-xs">Proof</TableHead>
              <TableHead className="text-xs text-right">Req Odds</TableHead>
              <TableHead className="text-xs text-right">Match Odds</TableHead>
              <TableHead className="text-xs text-right">Req Stake</TableHead>
              <TableHead className="text-xs text-right">Match Stake</TableHead>
              <TableHead className="text-xs text-right">Unmatched</TableHead>
              <TableHead className="text-xs text-right">Liability</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Settlement</TableHead>
              <TableHead className="text-xs">Result</TableHead>
              <TableHead className="text-xs">Result Source</TableHead>
              <TableHead className="text-xs text-right">CLV</TableHead>
              <TableHead className="text-xs text-right">Gross</TableHead>
              <TableHead className="text-xs text-right">Comm</TableHead>
              <TableHead className="text-xs text-right">Net P/L</TableHead>
              <TableHead className="text-xs">Flags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={23} className="py-0">
                  {paperOrders.length === 0 && !dataLoading ? (
                    <EmptyState
                      icon={Inbox}
                      title="No paper orders yet"
                      message="Orders will appear here once the bot creates paper trades or you place manual orders from the Paper Trading page."
                    />
                  ) : (
                    <EmptyState icon={Inbox} title="No orders match your filters" message="Try clearing some filters to see more orders." />
                  )}
                </TableCell>
              </TableRow>
            ) : filtered.map(o => (
              <TableRow key={o.id} className="border-border">
                <TableCell className="text-xs text-muted-foreground">{new Date(o.created_date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                <TableCell className="text-xs">{o.strategyName}</TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium">{o.venue || '—'}</div>
                  <div className="text-muted-foreground">{o.raceNumber ? `R${o.raceNumber} · ` : ''}{o.marketName || '—'}</div>
                </TableCell>
                <TableCell className="text-xs">{o.runnerName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{o.marketStartTime ? new Date(o.marketStartTime).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                <TableCell><SideBadge side={o.side} /></TableCell>
                <TableCell className="text-xs">
                  <StatusBadge status={o.persistenceType === 'PERSIST' ? 'warning' : o.persistenceType === 'MARKET_ON_CLOSE' ? 'info' : 'neutral'}>{o.persistenceType || 'LAPSE'}</StatusBadge>
                </TableCell>
                <TableCell className="text-xs">
                  <StatusBadge status={o.liveMode ? 'danger' : 'info'}>{o.liveMode ? 'LIVE' : 'PAPER'}</StatusBadge>
                </TableCell>
                <TableCell className="text-xs">
                  {o.proofMode ? <StatusBadge status="info">PROOF</StatusBadge> : <span className="text-muted-foreground text-[10px]">—</span>}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">{o.requestedOdds?.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right font-mono">{o.matchedOdds?.toFixed(2) || '—'}</TableCell>
                <TableCell className="text-xs text-right font-mono">${(o.requestedStake || 0).toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right font-mono text-chart-1">${(o.matchedStake || 0).toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right font-mono text-chart-4">${((o.requestedStake || 0) - (o.matchedStake || 0)).toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right font-mono text-muted-foreground">
                  ${(o.side === 'LAY' ? ((o.matchedStake || o.requestedStake || 0) * ((o.matchedOdds || o.requestedOdds || 0) - 1)) : (o.matchedStake || o.requestedStake || 0)).toFixed(2)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={
                    o.status === 'matched' ? 'ok' :
                    o.status === 'rejected' || o.status === 'cancelled' || o.status === 'failed' || o.status === 'lapsed' ? 'danger' :
                    o.status === 'partially_matched' || o.status === 'unmatched' ? 'warning' : 'info'
                  }>{o.status}</StatusBadge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={
                    o.settlementStatus === 'settled' ? 'ok' :
                    o.settlementStatus === 'result_unknown' ? 'warning' :
                    o.settlementStatus === 'voided' || o.settlementStatus === 'lapsed' ? 'neutral' :
                    o.settlementStatus === 'awaiting_result' ? 'warning' : 'neutral'
                  }>{o.settlementStatus || '—'}</StatusBadge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={o.result === 'won' ? 'ok' : o.result === 'lost' ? 'danger' : 'neutral'}>{o.result}</StatusBadge>
                </TableCell>
                <TableCell className="text-[10px] text-muted-foreground">{o.resultSource || '—'}</TableCell>
                <TableCell className={`text-xs text-right font-mono ${(o.clv || 0) >= 0 ? 'text-chart-1' : 'text-chart-5'}`}>{o.clv != null ? `${o.clv >= 0 ? '+' : ''}${o.clv.toFixed(1)}%` : '—'}</TableCell>
                <TableCell className="text-xs text-right font-mono">${o.grossProfit?.toFixed(2) || '0.00'}</TableCell>
                <TableCell className="text-xs text-right font-mono text-muted-foreground">${o.commission?.toFixed(2) || '0.00'}</TableCell>
                <TableCell className="text-xs text-right"><PLValue value={o.netProfit || 0} /></TableCell>
                <TableCell className="text-xs">
                  {o.warningFlags?.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-chart-4" title={o.warningFlags.join('; ')}>
                      <AlertTriangle className="h-3 w-3" />{o.warningFlags.length}
                    </span>
                  ) : o.rejection_reason ? (
                    <span className="inline-flex items-center gap-1 text-chart-5" title={o.rejection_reason}>
                      <AlertTriangle className="h-3 w-3" />!
                    </span>
                  ) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}