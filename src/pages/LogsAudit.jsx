import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, XCircle, CheckCircle2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const CATEGORY_ICONS = {
  api: '🔌',
  mode: '🔄',
  settings: '⚙️',
  strategy: '📊',
  risk: '🛡️',
  order: '📋',
  emergency: '🚨',
  system: '💻',
};

export default function LogsAudit() {
  const { auditLogs, clearLogs } = useApp();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filtered = auditLogs.filter(l => {
    if (categoryFilter !== 'all' && l.category !== categoryFilter) return false;
    if (severityFilter !== 'all' && l.severity !== severityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${l.action} ${l.details || ''} ${l.reason || ''} ${l.objectName || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Logs</span>
          <div className="text-xl font-bold font-mono mt-1">{auditLogs.length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Info</span>
          <div className="text-xl font-bold font-mono text-info mt-1">{auditLogs.filter(l => l.severity === 'info').length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Warnings</span>
          <div className="text-xl font-bold font-mono text-warning mt-1">{auditLogs.filter(l => l.severity === 'warning').length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Errors</span>
          <div className="text-xl font-bold font-mono text-danger mt-1">{auditLogs.filter(l => l.severity === 'error').length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Critical</span>
          <div className="text-xl font-bold font-mono text-danger mt-1">{auditLogs.filter(l => l.severity === 'critical').length}</div>
        </div>
      </div>

      <Panel title="Filters">
        <div className="p-4 flex flex-wrap gap-4 items-center">
          <div className="w-48">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="mode">Mode Changes</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="strategy">Strategy</SelectItem>
                <SelectItem value="risk">Risk</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-9 text-xs" />
          </div>
          <div className="ml-auto">
            {showClearConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-danger font-medium hidden sm:inline">Clear all logs?</span>
                <Button variant="destructive" size="sm" onClick={() => { clearLogs(); setShowClearConfirm(false); }}>
                  <CheckCircle2 className="h-3 w-3" /> Confirm
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)}>
                  <XCircle className="h-3 w-3" /> Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)} disabled={auditLogs.length === 0}>
                <Trash2 className="h-3 w-3" /> Clear Logs
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-2">
        Clearing logs only removes audit log entries. It does not delete paper orders, settings, or trading history.
      </div>
      <Panel title={`Audit Log (${filtered.length})`} action={<span className="text-xs text-muted-foreground">Showing before/after values and reasons</span>}>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">Timestamp</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Action</TableHead>
              <TableHead className="text-xs">Object</TableHead>
              <TableHead className="text-xs">Before</TableHead>
              <TableHead className="text-xs">After</TableHead>
              <TableHead className="text-xs">Reason</TableHead>
              <TableHead className="text-xs">Severity</TableHead>
              <TableHead className="text-xs">User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">No log entries match your filters.</TableCell></TableRow>
            ) : filtered.map(log => (
              <TableRow key={log.id} className="border-border">
                <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleString('en-AU', { hour12: false })}</TableCell>
                <TableCell className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>{CATEGORY_ICONS[log.category] || '•'}</span>
                    <span className="capitalize">{log.category}</span>
                  </span>
                </TableCell>
                <TableCell className="text-xs font-medium whitespace-nowrap">{log.action}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{log.objectName || log.details?.split(' ')[0] || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{log.beforeValue || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{log.afterValue || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{log.reason || log.details}</TableCell>
                <TableCell>
                  <StatusBadge status={
                    log.severity === 'info' ? 'info' :
                    log.severity === 'warning' ? 'warning' :
                    log.severity === 'error' || log.severity === 'critical' ? 'danger' : 'neutral'
                  }>{log.severity.toUpperCase()}</StatusBadge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{log.user}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}