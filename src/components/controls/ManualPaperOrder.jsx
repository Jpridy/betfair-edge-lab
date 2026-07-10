import React from 'react';
import { useApp } from '@/lib/AppContext';
import useManualPaperOrder from '@/hooks/useManualPaperOrder';
import { Panel } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ManualPaperOrder() {
  const { markets } = useApp();
  const { form, setForm, marketRunners, runner, submit, message, disabled } = useManualPaperOrder();
  const field = (key, value) => setForm(p => ({ ...p, [key]: value }));
  return <Panel title="Manual Paper Order" subtitle="Select a market and runner, review the price, then submit through the standard risk checks">
    <div className="space-y-4 p-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div><Label htmlFor="manual-market"><span className="mr-1 text-primary">1.</span> Market</Label><select id="manual-market" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.marketId} onChange={e => setForm(p => ({ ...p, marketId: e.target.value, runnerId: '' }))}>{markets.map(m => <option key={m.id} value={m.id}>{m.venue} — {m.marketName}</option>)}</select></div>
        <div><Label htmlFor="manual-runner"><span className="mr-1 text-primary">2.</span> Runner</Label><select id="manual-runner" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.runnerId} onChange={e => field('runnerId', e.target.value)}><option value="">Select runner</option>{marketRunners.map(r => <option key={r.id} value={r.id}>{r.runnerName}</option>)}</select></div>
        <div><Label htmlFor="manual-side"><span className="mr-1 text-primary">3.</span> Side</Label><select id="manual-side" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.side} onChange={e => field('side', e.target.value)}><option>BACK</option><option>LAY</option></select></div>
        <div><Label htmlFor="manual-stake"><span className="mr-1 text-primary">4.</span> Stake ($)</Label><Input id="manual-stake" type="number" className="mt-1" value={form.stake} onChange={e => field('stake', +e.target.value)} /></div>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm"><div className="font-medium text-foreground">Order review</div><div className="text-xs text-muted-foreground">{runner ? `${form.side} ${runner.runnerName} at ${form.side === 'BACK' ? runner.bestBackPrice : runner.bestLayPrice} · Paper only` : 'Select a runner to review the available price.'}</div></div>
        <Button className="w-full sm:w-auto sm:min-w-48" onClick={submit} disabled={disabled}>Create Paper Order</Button>
      </div>
      {message && <div role="status" className={`rounded-md border px-3 py-2 text-sm ${message.ok ? 'border-success/20 bg-success/5 text-success' : 'border-danger/20 bg-danger/5 text-danger'}`}>{message.text}</div>}
    </div>
  </Panel>;
}