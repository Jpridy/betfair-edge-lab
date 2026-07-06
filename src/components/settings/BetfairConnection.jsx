import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link2, Unlink, CheckCircle2, AlertCircle, User, ExternalLink } from 'lucide-react';
import { connectToBetfair } from '@/lib/betfairApi';

export default function BetfairConnection() {
  const { apiConnected, setApiConnected, betfairAccount, setBetfairAccount, setBetfairSessionToken, setMode, addAuditLog } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const handleQuickConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const account = await connectToBetfair();
      finishConnect(account, '(stored credentials)');
    } catch (err) {
      setError(err.message || 'Quick connect failed — try entering your credentials manually below');
      addAuditLog('Betfair Quick Connect Failed', 'api', 'error', err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setError('Please enter your Betfair username and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const account = await connectToBetfair(usernameInput.trim(), passwordInput);
      finishConnect(account, usernameInput.trim());
      finishConnect(account, usernameInput.trim());
      setPasswordInput('');
    } catch (err) {
      setError(err.message || 'Connection failed');
      addAuditLog('Betfair Login Failed', 'api', 'error', err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const finishConnect = (account, displayUsername) => {
    setApiConnected(true);
    setBetfairSessionToken(account.sessionToken);
    setMode('live');
    setBetfairAccount({
      username: displayUsername,
      jurisdiction: account.jurisdiction,
      balance: account.balance,
      exposure: account.exposure,
      exposureLimit: account.exposureLimit,
      discountRate: account.discountRate,
      pointsBalance: account.pointsBalance,
      currency: account.currency,
      firstName: account.firstName,
      lastName: account.lastName,
      locale: account.locale,
      connectedAt: new Date().toISOString(),
    });
    addAuditLog('Betfair Account Linked', 'api', 'info', `Connected as ${displayUsername} (${account.jurisdiction})`);
  };

  const handleDisconnect = () => {
    setApiConnected(false);
    setBetfairAccount(null);
    setBetfairSessionToken(null);
    setUsernameInput('');
    setPasswordInput('');
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
                <div className="text-xs text-muted-foreground mt-1">Log in with your Betfair username and password.</div>
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
                <span className="font-mono text-foreground">Username &amp; Password</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Required Secret</span>
                <span className="font-mono text-foreground">BETFAIR_APP_KEY</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="bf-username" className="text-xs font-medium">Betfair Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="bf-username"
                    type="text"
                    placeholder="Your Betfair username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="pl-9 text-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bf-password" className="text-xs font-medium">Betfair Password</Label>
                <Input
                  id="bf-password"
                  type="password"
                  placeholder="Your Betfair password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                />
              </div>
            </div>

            <div className="bg-muted/20 border border-border rounded-lg p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-chart-4" />
                <div>
                  Login is handled securely through a Cloudflare Worker proxy that bypasses Betfair's bot protection. Your credentials are never stored. If the connection fails, ensure the <span className="font-mono text-foreground">BETFAIR_PROXY_URL</span> secret is set to your deployed Worker URL.
                </div>
              </div>
            </div>

            <Button onClick={handleQuickConnect} disabled={loading} variant="default" className="w-full h-11 font-medium">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting to Betfair...</>
              ) : (
                <><Link2 className="h-4 w-4 mr-2" /> Quick Connect (Saved Credentials)</>
              )}
            </Button>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="flex-1 border-t border-border" />
              <span>OR ENTER MANUALLY</span>
              <div className="flex-1 border-t border-border" />
            </div>

            <Button onClick={handleConnect} disabled={loading || !usernameInput.trim() || !passwordInput.trim()} variant="outline" className="w-full h-11 font-medium">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</>
              ) : (
                <><Link2 className="h-4 w-4 mr-2" /> Connect with Entered Credentials</>
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
                  <div className="text-xs text-muted-foreground">Logged in as {betfairAccount?.username || 'Betfair user'}{betfairAccount?.firstName ? ` — ${betfairAccount.firstName} ${betfairAccount.lastName}` : ''}</div>
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