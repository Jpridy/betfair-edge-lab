import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link2, Unlink, CheckCircle2, AlertCircle, ExternalLink, KeyRound } from 'lucide-react';
import { connectToBetfair, connectWithSessionToken } from '@/lib/betfairApi';

export default function BetfairConnection() {
  const { apiConnected, setApiConnected, betfairAccount, setBetfairAccount, setBetfairSessionToken, addAuditLog, betfairConnection, updateBetfairConnection, disconnectBetfair, markets, runners } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [sessionTokenInput, setSessionTokenInput] = useState('');

  const handleQuickConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const account = await connectToBetfair();
      finishConnect(account, '(stored credentials)');
    } catch (err) {
      setError(err.message || 'Quick connect failed — try using a session token below');
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
      setPasswordInput('');
    } catch (err) {
      setError(err.message || 'Connection failed');
      addAuditLog('Betfair Login Failed', 'api', 'error', err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionTokenConnect = async () => {
    if (!sessionTokenInput.trim()) {
      setError('Please paste your Betfair session token');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const account = await connectWithSessionToken(sessionTokenInput.trim());
      finishConnect(account, '(session token)');
      setSessionTokenInput('');
    } catch (err) {
      setError(err.message || 'Session token connection failed');
      addAuditLog('Betfair Session Token Failed', 'api', 'error', err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const finishConnect = (account, displayUsername) => {
    setApiConnected(true);
    setBetfairSessionToken(account.sessionToken);
    updateBetfairConnection({ appKey: account.appKey, jurisdiction: account.jurisdiction, loginStatus: 'connected', sessionTokenStatus: 'connected', streamApiEnabled: true });
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
    disconnectBetfair();
    setUsernameInput('');
    setPasswordInput('');
    setSessionTokenInput('');
  };

  return (
    <Panel title="Betfair Account Connection">
      <div className="p-4 space-y-4">
        {!apiConnected ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Connect Your Betfair Account</div>
                <div className="text-xs text-muted-foreground mt-1">Use a session token from your browser for the most reliable connection.</div>
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

            {/* Session Token Method — recommended */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <KeyRound className="h-3.5 w-3.5 text-chart-1" />
                Session Token (Recommended)
              </div>

              <div className="bg-chart-1/5 border border-chart-1/20 rounded-lg p-3 text-xs text-muted-foreground space-y-2">
                <div className="font-semibold text-foreground">How to get your session token:</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Log into <a href="https://www.betfair.com.au" target="_blank" rel="noopener noreferrer" className="text-chart-3 underline inline-flex items-center gap-0.5">betfair.com.au <ExternalLink className="h-3 w-3" /></a> in your browser</li>
                  <li>After logging in, open a new tab and visit <a href="https://identitysso.betfair.com/api/keepAlive" target="_blank" rel="noopener noreferrer" className="text-chart-3 underline inline-flex items-center gap-0.5">this link <ExternalLink className="h-3 w-3" /></a></li>
                  <li>Copy the <span className="font-mono text-foreground">token</span> value from the JSON response</li>
                  <li>Paste it below</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bf-session-token" className="text-xs font-medium">Betfair Session Token</Label>
                <Input
                  id="bf-session-token"
                  type="text"
                  placeholder="Paste your session token here"
                  value={sessionTokenInput}
                  onChange={(e) => setSessionTokenInput(e.target.value)}
                  className="text-sm font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSessionTokenConnect(); }}
                />
              </div>

              <Button onClick={handleSessionTokenConnect} disabled={loading || !sessionTokenInput.trim()} variant="default" className="w-full h-11 font-medium">
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</>
                ) : (
                  <><KeyRound className="h-4 w-4 mr-2" /> Connect with Session Token</>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="flex-1 border-t border-border" />
              <span>OR TRY STORED CREDENTIALS</span>
              <div className="flex-1 border-t border-border" />
            </div>

            <Button onClick={handleQuickConnect} disabled={loading} variant="outline" className="w-full h-11 font-medium">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</>
              ) : (
                <><Link2 className="h-4 w-4 mr-2" /> Quick Connect (Stored Credentials)</>
              )}
            </Button>

            <div className="bg-muted/20 border border-border rounded-lg p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-chart-4" />
                <div>
                  Betfair blocks automated login from serverless/cloud IPs. The session token method is the most reliable — it uses your browser's authenticated session. Session tokens expire periodically; just grab a fresh one from the link above when that happens.
                </div>
              </div>
            </div>
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
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Stream Status</div>
                <div className="text-lg font-bold font-mono mt-1 flex items-center gap-1.5">
                  {betfairConnection.streamConnectionStatus === 'connected' || betfairConnection.streamConnectionStatus === 'polling' ? (
                    <><span className="h-2 w-2 rounded-full bg-chart-1 animate-pulse" /><span className="text-chart-1">DATA</span></>
                  ) : betfairConnection.streamConnectionStatus === 'connecting' || betfairConnection.streamConnectionStatus === 'authenticating' || betfairConnection.streamConnectionStatus === 'subscribing' ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin text-chart-4" /><span className="text-chart-4">{betfairConnection.streamConnectionStatus}</span></>
                  ) : (
                    <span className="text-muted-foreground">{betfairConnection.streamConnectionStatus || '—'}</span>
                  )}
                </div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Markets Streaming</div>
                <div className="text-lg font-bold font-mono text-chart-1 mt-1">{markets.length}</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Runners Tracked</div>
                <div className="text-lg font-bold font-mono text-chart-1 mt-1">{runners.length}</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Refresh</div>
                <div className="text-sm font-bold font-mono text-foreground mt-1">
                  {betfairConnection.lastMarketSyncTime ? new Date(betfairConnection.lastMarketSyncTime).toLocaleTimeString('en-AU') : '—'}
                </div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Data Fresh</div>
                <div className="text-lg font-bold font-mono mt-1">
                  {betfairConnection.dataFresh ? <span className="text-chart-1">✓ Yes</span> : <span className="text-chart-5">✗ Stale</span>}
                </div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Jurisdiction</div>
                <div className="text-lg font-bold font-mono text-foreground mt-1">{betfairAccount?.jurisdiction || 'AU'}</div>
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