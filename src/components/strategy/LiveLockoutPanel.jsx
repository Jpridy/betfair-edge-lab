import React, { useState } from 'react';
import { Panel } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Unlock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { checkLiveLockout } from '@/lib/strategyValidation';
import { StrategyStatusBadge } from './StrategyStatusBadge';

export default function LiveLockoutPanel({ strategy, audit, settings, onApprove, onRevoke, isAdmin = true }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [approved, setApproved] = useState(false);
  const [userConfirmed, setUserConfirmed] = useState(false);

  const adminState = { liveApproved: approved, userConfirmed };
  const lockout = checkLiveLockout(strategy, audit, settings, adminState);

  const handleConfirm = () => {
    if (confirmText === 'ENABLE LIVE TRADING') {
      setUserConfirmed(true);
      setShowConfirm(false);
      setConfirmText('');
      onApprove?.();
    }
  };

  return (
    <Panel title="Live Mode Lockout" action={<StrategyStatusBadge light={lockout.locked ? 'red' : 'green'} label={lockout.locked ? 'Locked' : 'Live Ready'} />}>
      <div className="p-4 space-y-4">
        <div className={`rounded-lg border p-4 ${lockout.locked ? 'border-chart-5/30 bg-chart-5/5' : 'border-chart-1/30 bg-chart-1/5'}`}>
          <div className="flex items-start gap-3">
            {lockout.locked ? (
              <Lock className="h-5 w-5 text-chart-5 shrink-0 mt-0.5" />
            ) : (
              <Unlock className="h-5 w-5 text-chart-1 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className={`text-sm font-bold ${lockout.locked ? 'text-chart-5' : 'text-chart-1'}`}>
                {lockout.locked ? 'Live mode locked' : 'Live mode available'}
              </div>
              {lockout.locked ? (
                <div className="mt-2 space-y-1">
                  {lockout.reasons.map((reason, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <XCircle className="h-3 w-3 text-chart-5 shrink-0 mt-0.5" />
                      {reason}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mt-1">
                  All validation criteria passed. Admin can enable live trading with confirmation.
                </div>
              )}
            </div>
          </div>
        </div>

        {isAdmin && !lockout.locked && !userConfirmed && (
          <div>
            <Button variant="destructive" className="w-full" onClick={() => setShowConfirm(true)}>
              <AlertTriangle className="h-4 w-4" />
              Request Live Mode Activation
            </Button>
          </div>
        )}

        {isAdmin && !lockout.locked && userConfirmed && (
          <div className="rounded-lg border border-chart-1/30 bg-chart-1/5 p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-chart-1" />
            <span className="text-xs text-chart-1 font-semibold">Live mode confirmed. Ready for admin activation.</span>
          </div>
        )}

        {showConfirm && (
          <div className="rounded-lg border border-chart-4/30 bg-chart-4/5 p-4 space-y-3">
            <div className="text-sm font-bold text-chart-4">⚠ Live Trading Confirmation</div>
            <div className="text-xs text-muted-foreground">
              You are about to enable <strong>LIVE BETTING</strong> with real money for the <strong>{strategy?.name}</strong> strategy.
              This means real bets will be placed on your Betfair account. Type <strong>ENABLE LIVE TRADING</strong> to confirm.
            </div>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type: ENABLE LIVE TRADING"
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" disabled={confirmText !== 'ENABLE LIVE TRADING'} onClick={handleConfirm}>
                Confirm Live Mode
              </Button>
              <Button variant="outline" onClick={() => { setShowConfirm(false); setConfirmText(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isAdmin && approved && (
          <Button variant="outline" className="w-full text-xs" onClick={() => { setApproved(false); setUserConfirmed(false); onRevoke?.(); }}>
            Revoke Live Approval
          </Button>
        )}
      </div>
    </Panel>
  );
}