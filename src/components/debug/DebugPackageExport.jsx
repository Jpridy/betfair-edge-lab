import React from 'react';
import { Download, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/Trading';
import useDebugPackageExport from '@/hooks/useDebugPackageExport';

export default function DebugPackageExport() {
  const {busy,progress,downloadFull,downloadMinimal}=useDebugPackageExport();
  return <Panel className="p-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2"><Package className="h-4 w-4 text-primary"/><h2 className="font-heading text-sm font-semibold">Debug testing package</h2></div>
        <p className="mt-1 text-xs text-muted-foreground">Exports logs, settings, race data, opportunities, paper orders and diagnostics for testing.</p>
        {progress && <p className="mt-2 text-xs text-primary" aria-live="polite">{progress}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={downloadMinimal}><Download/>Download Minimal Debug Package</Button>
        <Button disabled={busy} onClick={downloadFull}><Download/>Download Debug Package</Button>
      </div>
    </div>
  </Panel>;
}