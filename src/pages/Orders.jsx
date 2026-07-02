import React, { useState } from 'react';
import { Panel, StatusBadge, SideBadge, PLValue } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function Orders() {
  const { paperOrders } = useApp();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sideFilter, setSideFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = paperOrders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (sideFilter !== 'all' && o.side !== sideFilter) return false;
    if (search && !o.runnerName?.toLowerCase().includes(search.toLowerCase()) && !o.marketName?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalStake = filtered.reduce((sum, o) => sum + (o.matchedStake || 0), 0);
  const totalPL = filtered.reduce((sum, o) => sum + (o.netProfit || 0), 0);
  const matched = filtered.filter(o => o.status === 'matched').length;
  const pending = filtered.filter(o => o.result === 'pending').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Orders</span>
          <div className="text-xl font-bold font-mono mt-1">{filtered.length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Matched</span>
          <div className="text-xl font-bold font-mono text-chart-1 mt-1">{matched}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Stake</span>
          <div className="text-xl font-bold font-mono mt-1">${totalStake.toFixed(2)}</div>
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
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
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
          <Input placeholder="Search runner or market..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 w-64 text-xs" />
        </div>
      </Panel>

      <Panel title={`Paper Orders (${filtered.length})`}>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs">Strategy</TableHead>
              <TableHead className="text-xs">Market</TableHead>
              <TableHead className="text-xs">Runner</TableHead>
              <TableHead className="text-xs">Side</TableHead>
              <TableHead className="text-xs text-right">Req Odds</TableHead>
              <TableHead className="text-xs text-right">Match Odds</TableHead>
              <TableHead className="text-xs text-right">Stake</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Result</TableHead>
              <TableHead className="text-xs text-right">Gross</TableHead>
              <TableHead className="text-xs text-right">Comm</TableHead>
              <TableHead className="text-xs text-right">Net P/L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(o => (
              <TableRow key={o.id} className="border-border">
                <TableCell className="text-xs text-muted-foreground">{new Date(o.created_date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                <TableCell className="text-xs">{o.strategyName}</TableCell>
                <TableCell className="text-xs">{o.marketName}</TableCell>
                <TableCell className="text-xs">{o.runnerName}</TableCell>
                <TableCell><SideBadge side={o.side} /></TableCell>
                <TableCell className="text-xs text-right font-mono">{o.requestedOdds?.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right font-mono">{o.matchedOdds?.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right font-mono">${o.matchedStake}</TableCell>
                <TableCell>
                  <StatusBadge status={
                    o.status === 'matched' ? 'ok' :
                    o.status === 'cancelled' || o.status === 'failed' || o.status === 'lapsed' ? 'danger' :
                    o.status === 'partially_matched' || o.status === 'unmatched' ? 'warning' : 'info'
                  }>{o.status}</StatusBadge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={o.result === 'won' ? 'ok' : o.result === 'lost' ? 'danger' : 'neutral'}>{o.result}</StatusBadge>
                </TableCell>
                <TableCell className="text-xs text-right font-mono">${o.grossProfit?.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right font-mono text-muted-foreground">${o.commission?.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right"><PLValue value={o.netProfit} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}