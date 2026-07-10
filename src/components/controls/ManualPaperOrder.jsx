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
  return <Panel title="Manual Paper Order" subtitle="Uses the same validation and risk checks as automated orders"><div className="grid gap-4 p-4 md:grid-cols-5">
    <div><Label htmlFor="manual-market">Market</Label><select id="manual-market" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.marketId} onChange={e => setForm(p => ({ ...p, marketId: e.target.value, runnerId: '' }))}>{markets.map(m => <option key={m.id} value={m.id}>{m.venue} — {m.marketName}</option>)}</select></div>
    <div><Label htmlFor="manual-runner">Runner</Label><select id="manual-runner" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.runnerId} onChange={e => field('runnerId', e.target.value)}><option value="">Select runner</option>{marketRunners.map(r => <option key={r.id} value={r.id}>{r.runnerName}</option>)}</select></div>
    <div><Label htmlFor="manual-side">Side</Label><select id="manual-side" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.side} onChange={e => field('side', e.target.value)}><option>BACK</option><option>LAY</option></select></div>
    <div><Label htmlFor="manual-stake">Stake ($)</Label><Input id="manual-stake" type="number" className="mt-1" value={form.stake} onChange={e => field('stake', +e.target.value)} /></div>
    <div className="flex items-end"><Button className="w-full" onClick={submit} disabled={disabled}>Create Paper Order</Button></div>
    {runner && <div className="md:col-span-5 text-sm text-muted-foreground">Price: {form.side === 'BACK' ? runner.bestBackPrice : runner.bestLayPrice} · This order remains paper-only.</div>}
    {message && <div className={`md:col-span-5 text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>{message.text}</div>}
  </div></Panel>;
}