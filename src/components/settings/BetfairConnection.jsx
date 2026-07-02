import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link2, Unlink, CheckCircle2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BetfairConnection() {
  const { apiConnected, setApiConnected, betfairAccount, setBetfairAccount, addAuditLog } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('betfairLogin', {});
      if (res.data?.status === 'success') {
        setApiConnected(true);
        setBetfairAccount({
          username: res.data.username,
          jurisdiction: res.data.jurisdiction,
          balance: res.data.balance,
          exposure: res.data.exposure,
          exposureLimit: res.data.exposureLimit,
          discountRate: res.data.discountRate,
          pointsBalance: res.data.pointsBalance,
          currency: res.data.currency,
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          locale: res.data.locale,
          connectedAt: new Date().toISOString(),
        });
        addAuditLog('Betfair Account Linked', 'api', 'info', `Connected to Betfair account: ${res.data.username} (${res.data.jurisdiction})`);
      } else {
        setError(res.data?.error || 'Login failed');
        addAuditLog('Betfair Login Failed', 'api', 'error', res.data?.error || 'Unknown error');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setApiConnected(false);
    setBetfairAccount(null);
    addAuditLog('Betfair Account Unlinked', 'api', 'warning', 'Betfair account disconnected');
  };

  return (
    <Panel title="Betfair Account Connection">
      <div className="p-4 space-y-4">
        {!apiConnected ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Connect Your Betfair Account</div>
                <div className="text-xs text-muted-foreground mt-1">Log in to Betfair using your stored credentials to link your exchange account.</div>
              </div>
              <StatusBadge status="warning">Not Connected</StatusBadge>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Connection Failed</div>
                  <div className="mt-0.5">{error}</div>
                </div>
              </div>
            )}

            <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Credentials Source</span>
                <span className="font-mono text-foreground">App Secrets</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Required Secrets</span>
                <span className="font-mono text-foreground">BETFAIR_USERNAME, BETFAIR_PASSWORD, BETFAIR_APP_KEY</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Jurisdiction</span>
                <span className="font-mono text-foreground">BETFAIR_JURISDICTION</span>
              </div>
            </div>

            <Button onClick={handleConnect} disabled={loading} className="w-full h-11 font-medium">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting to Betfair...</>
              ) : (
                <><Link2 className="h-4 w-4 mr-2" /> Connect to Betfair</>
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-chart-1" />
                <div>
                  <div className="text-sm font-semibold text-foreground">Betfair Account Connected</div>
                  <div className="text-xs text-muted-foreground">Logged in as {betfairAccount?.firstName} {betfairAccount?.lastName} ({betfairAccount?.username})</div>
                </div>
              </div>
              <StatusBadge status="ok">Connected</StatusBadge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Available Balance</div>
                <div className="text-lg font-bold font-mono text-chart-1 mt-1">
                  {betfairAccount?.currency || '$'}{(betfairAccount?.balance ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Current Exposure</div>
                <div className="text-lg font-bold font-mono text-foreground mt-1">
                  {betfairAccount?.currency || '$'}{(betfairAccount?.exposure ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Exposure Limit</div>
                <div className="text-lg font-bold font-mono text-foreground mt-1">
                  {betfairAccount?.currency || '$'}{Math.abs(betfairAccount?.exposureLimit ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Discount Rate</div>
                <div className="text-lg font-bold font-mono text-foreground mt-1">{((betfairAccount?.discountRate ?? 0) * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Points Balance</div>
                <div className="text-lg font-bold font-mono text-foreground mt-1">{betfairAccount?.pointsBalance ?? 0}</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Jurisdiction</div>
                <div className="text-lg font-bold font-mono text-foreground mt-1">{betfairAccount?.jurisdiction}</div>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground">
              Connected at {betfairAccount?.connectedAt ? new Date(betfairAccount.connectedAt).toLocaleString('en-AU') : '—'}
            </div>

            <Button variant="outline" onClick={handleDisconnect} className="w-full h-10 text-sm">
              <Unlink className="h-4 w-4 mr-2" /> Disconnect Betfair Account
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
}