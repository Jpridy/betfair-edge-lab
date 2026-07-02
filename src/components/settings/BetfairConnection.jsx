import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link2, Unlink, CheckCircle2, AlertCircle, KeyRound, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BetfairConnection() {
  const { apiConnected, setApiConnected, betfairAccount, setBetfairAccount, setBetfairSessionToken, setDemoMode, addAuditLog } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ssoidInput, setSsoidInput] = useState('');

  const handleConnect = async () => {
    if (!ssoidInput.trim()) {
      setError('Please enter your Betfair SSOID');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('betfairLogin', { ssoid: ssoidInput.trim() });
      if (res.data?.status === 'success') {
        setApiConnected(true);
        setBetfairSessionToken(res.data.sessionToken);
        setDemoMode(false);
        setBetfairAccount({
          username: 'SSOID User',
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
        addAuditLog('Betfair Account Linked', 'api', 'info', `Connected via SSOID (${res.data.jurisdiction})`);
      } else {
        setError(res.data?.error || 'Connection failed');
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
    setBetfairSessionToken(null);
    setSsoidInput('');
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
                <div className="text-xs text-muted-foreground mt-1">Connect using your Betfair SSOID (session token from your browser).</div>
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
                <span className="text-muted-foreground">Auth Method</span>
                <span className="font-mono text-foreground">SSOID Key</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Required Secret</span>
                <span className="font-mono text-foreground">BETFAIR_APP_KEY</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssoid" className="text-xs font-medium">Betfair SSOID</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ssoid"
                  type="password"
                  placeholder="Paste your SSOID here..."
                  value={ssoidInput}
                  onChange={(e) => setSsoidInput(e.target.value)}
                  className="pl-9 font-mono text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                />
              </div>
            </div>

            <details className="bg-muted/20 border border-border rounded-lg p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold text-foreground">How to get your SSOID</summary>
              <div className="mt-2 space-y-1.5 pl-2">
                <div>1. Log in to <a href="https://www.betfair.com" target="_blank" rel="noopener noreferrer" className="text-chart-3 inline-flex items-center gap-0.5 hover:underline">betfair.com <ExternalLink className="h-3 w-3" /></a> in your browser</div>
                <div>2. Open DevTools (press F12) → Application tab → Cookies → betfair.com</div>
                <div>3. Find the cookie named <span className="font-mono text-chart-3">ssoid</span></div>
                <div>4. Copy its value and paste it above</div>
                <div className="text-muted-foreground/70 italic mt-2">The SSOID is your active session token. It expires when you log out of Betfair — just paste a new one to reconnect.</div>
              </div>
            </details>

            <Button onClick={handleConnect} disabled={loading || !ssoidInput.trim()} className="w-full h-11 font-medium">
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
                  <div className="text-xs text-muted-foreground">Connected via SSOID{betfairAccount?.firstName ? ` — ${betfairAccount.firstName} ${betfairAccount.lastName}` : ''}</div>
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