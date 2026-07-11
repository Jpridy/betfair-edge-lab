import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/Trading';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function ResetAppData() {
  const [confirmation, setConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (event) => {
    event.preventDefault();
    setResetting(true);
    setError('');
    try {
      const response = await base44.functions.invoke('resetAllAppData', { confirmation });
      if (!response.data?.success) throw new Error(response.data?.error || 'Reset failed');
      window.location.href = '/';
    } catch (resetError) {
      setError(resetError.response?.data?.error || resetError.message);
      setResetting(false);
    }
  };

  return (
    <Panel title="Danger Zone" className="mt-5 border-danger/40">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-medium">Reset all app data</p><p className="mt-1 text-xs text-muted-foreground">Permanently deletes orders, decisions, markets, runners, logs, analytics, and settings. User accounts and connection secrets are preserved.</p></div>
        <AlertDialog onOpenChange={(open) => { if (!open && !resetting) setConfirmation(''); }}>
          <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 /> Reset all data</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete all app data?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Type <strong className="text-foreground">RESET ALL DATA</strong> to confirm.</AlertDialogDescription></AlertDialogHeader>
            <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="RESET ALL DATA" autoComplete="off" />
            {error && <p className="text-sm text-danger">{error}</p>}
            <AlertDialogFooter><AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleReset} disabled={confirmation !== 'RESET ALL DATA' || resetting} className="bg-danger text-danger-foreground hover:bg-danger/90">{resetting ? 'Resetting…' : 'Delete everything'}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Panel>
  );
}