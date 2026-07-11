import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, RefreshCw, Radio } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { getBetfairDiagnosticsVerification } from '@/lib/betfairDiagnostics';

const Metric = ({ label, value }) => <div className="rounded border border-border-subtle bg-muted/20 p-2"><div className="text-[9px] uppercase text-muted-foreground">{label}</div><div className="font-mono text-sm font-semibold">{value ?? 0}</div></div>;
const stateBadge = (state) => state === 'CONNECTED' || state === 'LIVE' ? 'ok' : state === 'ERROR' || state === 'UNAVAILABLE' ? 'danger' : state === 'CONNECTING' || state === 'STALE' || state === 'CACHED' ? 'warning' : 'neutral';

export default function BetfairDataDiagnostics() {
  const { betfairDiagnostics: d, refreshBetfairData, reconnectBetfairStream, rebuildBetfairDiagnostics } = useApp();
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState('');
  const run = async (name, fn) => { setAction(name); setMessage(''); try { const result = await fn(); if (result?.error) throw new Error(result.error); setMessage(`${name} succeeded`); } catch (error) { setMessage(`${name} failed: ${error.message}`); } finally { setAction(null); } };
  const copy = async () => { try { await navigator.clipboard.writeText(JSON.stringify(getBetfairDiagnosticsVerification(d), null, 2)); setMessage('Diagnostics JSON copied'); } catch (error) { setMessage(`Copy failed: ${error.message}`); } };
  const layers = [
    ['Catalogue', [['Records returned', d.catalogueRecordsReturned], ['Unique markets', d.uniqueCatalogueMarketIds], ['Last refresh', d.timestamps.lastCatalogueRefreshAt || '—'], ['Last error', d.errors.catalogue || 'None']]],
    ['Market books', [['Books returned', d.marketBooksReturned], ['Open', d.statusCounts.open], ['Suspended', d.statusCounts.suspended], ['Closed', d.statusCounts.closed], ['Last refresh', d.timestamps.lastMarketBookRefreshAt || '—'], ['Last error', d.errors.marketBooks || 'None']]],
    ['Stream', [['State', d.connectionStates.stream], ['Subscribed', d.stream.subscribedMarkets], ['Markets updated', d.stream.marketsUpdated], ['Last update', d.timestamps.lastStreamUpdateAt || '—'], ['Last error', d.errors.stream || 'None']]],
    ['Merged market state', [['Hydrated', d.mergedHydratedMarkets], ['Valid', d.validHydratedMarkets], ['With runners', d.marketsWithRunners], ['With prices', d.marketsWithPriceData], ['Missing prices', d.missingPriceData], ['Inside window', d.insideTimeWindow]]],
  ];
  return <Panel title="Betfair Data Diagnostics" action={<div className="flex gap-1"><StatusBadge status={stateBadge(d.snapshotStatus)}>{d.snapshotStatus}</StatusBadge><StatusBadge status={stateBadge(d.priceFeedStatus)}>PRICE {d.priceFeedStatus}</StatusBadge></div>}>
    {d.snapshotStatus === 'CACHED' && <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning">Cached snapshot — Betfair currently disconnected · captured {d.snapshotCapturedAt}</div>}
    <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-5"><Metric label="Valid markets" value={d.validHydratedMarkets} /><Metric label="Open" value={d.statusCounts.open} /><Metric label="Unknown status" value={d.statusCounts.unknown} /><Metric label="Unknown in-play" value={d.inPlayCounts.unknownInPlay} /><Metric label="Without start time" value={d.startTimeCounts.withoutStartTime} /></div>
    <div className="grid gap-3 border-t border-border-subtle p-4 md:grid-cols-2">{layers.map(([title, rows]) => <div key={title} className="rounded-lg border border-border-subtle p-3"><h4 className="mb-2 text-xs font-semibold">{title}</h4><dl className="space-y-1">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3 text-[11px]"><dt className="text-muted-foreground">{label}</dt><dd className="max-w-[65%] break-words text-right font-mono">{String(value)}</dd></div>)}</dl></div>)}</div>
    {d.consistencyErrors.length > 0 ? <div className="mx-4 mb-4 rounded border border-danger/30 bg-danger/10 p-3 text-xs text-danger"><div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Consistency errors</div>{d.consistencyErrors.map(error => <div key={error}>• {error}</div>)}</div> : <div className="mx-4 mb-4 flex items-center gap-2 text-xs text-success"><CheckCircle2 className="h-4 w-4" />Snapshot is internally consistent</div>}
    <div className="flex flex-wrap gap-2 border-t border-border-subtle p-4"><Button size="sm" variant="outline" disabled={!!action} onClick={() => run('Refresh Catalogue', refreshBetfairData)}><RefreshCw />Refresh Catalogue</Button><Button size="sm" variant="outline" disabled={!!action} onClick={() => run('Reconnect Stream', reconnectBetfairStream)}><Radio />Reconnect Stream</Button><Button size="sm" variant="outline" disabled={!!action} onClick={() => run('Rebuild Diagnostics', rebuildBetfairDiagnostics)}><RefreshCw />Rebuild Diagnostics</Button><Button size="sm" variant="outline" onClick={copy}><Copy />Copy Diagnostics JSON</Button>{message && <span className="self-center text-xs text-muted-foreground">{message}</span>}</div>
    <details className="border-t border-border-subtle p-4"><summary className="cursor-pointer text-xs font-semibold">Counter data sources</summary><pre className="mt-3 overflow-auto rounded bg-muted/30 p-2 text-[10px]">{JSON.stringify(d.sourceMap, null, 2)}</pre></details>
    <details className="border-t border-border-subtle p-4"><summary className="cursor-pointer text-xs font-semibold">Sanitized raw sample records</summary><div className="mt-3 grid gap-3 md:grid-cols-2">{Object.entries(d.samples).map(([name, sample]) => <div key={name}><div className="mb-1 text-[10px] uppercase text-muted-foreground">{name}</div><pre className="max-h-56 overflow-auto rounded bg-muted/30 p-2 text-[10px]">{JSON.stringify(sample, null, 2)}</pre></div>)}</div></details>
  </Panel>;
}