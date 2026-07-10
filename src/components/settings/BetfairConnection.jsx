import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link2, Unlink, CheckCircle2, AlertCircle, ExternalLink, KeyRound, Stethoscope, Globe } from 'lucide-react';
import { connectToBetfair, connectWithSessionToken, diagnoseBetfairEndpoint } from '@/lib/betfairApi';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function BetfairConnection() {
  const { apiConnected, setApiConnected, betfairAccount, setBetfairAccount, setBetfairSessionToken, addAuditLog, betfairConnection, updateBetfairConnection, disconnectBetfair, markets, runners, betfairSessionToken } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [sessionTokenInput, setSessionTokenInput] = useState('');
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);

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
    // Token present but NOT validated — don't say "API Connected" until a real API call succeeds
    updateBetfairConnection({
      appKey: account.appKey,
      jurisdiction: account.jurisdiction,
      loginStatus: 'token_present_not_validated',
      sessionTokenStatus: 'token_present_not_validated',
      streamApiEnabled: true,
      apiValidationStatus: 'token_present_not_validated',
    });
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
    addAuditLog('Betfair Account Linked', 'api', 'info', `Connected as ${displayUsername} (${account.jurisdiction}). Token present — not yet validated via API call.`);
  };

  const handleRunDiagnostic = async () => {
    if (!betfairSessionToken) {
      setError('Connect a session token first');
      return;
    }
    setDiagnosticRunning(true);
    setDiagnosticResult(null);
    try {
      const result = await diagnoseBetfairEndpoint(betfairSessionToken, true);
      setDiagnosticResult(result);
      if (result?.workingApiBase) {
        updateBetfairConnection({ apiValidationStatus: 'api_connected', marketCatalogueError: null });
        addAuditLog('Endpoint Diagnostic Passed', 'api', 'info', `Working endpoint: ${result.workingApiBase}. HTML 403 detected: ${result.html403Detected}. API validated.`);
      } else {
        addAuditLog('Endpoint Diagnostic Failed', 'api', 'error', `No working endpoint found. HTML 403: ${result?.html403Detected}. Endpoints tested: ${result?.endpoints?.length || 0}`);
      }
    } catch (err) {
      setError(`Diagnostic failed: ${err.message}`);
      addAuditLog('Endpoint Diagnostic Error', 'api', 'error', err.message);
    } finally {
      setDiagnosticRunning(false);
    }
  };

  const handleDisconnect = () => {
    disconnectBetfair();
    setUsernameInput('');
    setPasswordInput('');
    setSessionTokenInput('');
    setDiagnosticResult(null);
  };

  // ── Truthful API status ──
  // apiConnected = session token present
  // apiValidated = a real Betfair API call has returned valid JSON
  const apiValidated = betfairConnection?.apiValidationStatus === 'api_connected' ||
                       (markets.length > 0 && !betfairConnection?.marketCatalogueError);
  const hasHtmlError = betfairConnection?.marketCatalogueError?.includes('HTML') ||
                       diagnosticResult?.html403Detected === true;
  const tokenPresent = apiConnected && !!betfairSessionToken;

  const apiStatusBadge = () => {
    if (!apiConnected) return <StatusBadge status="warning">Not Connected</StatusBadge>;
    if (apiValidated) return <StatusBadge status="ok">API Connected</StatusBadge>;
    if (hasHtmlError) return <StatusBadge status="danger">HTML 403 Error</StatusBadge>;
    return <StatusBadge status="warning">Token Present — Not Validated</StatusBadge>;
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
                <KeyRound className="h-3.5 w-3.5 text-success" />
                Session Token (Recommended)
              </div>

              <div className="bg-success/5 border border-success/20 rounded-lg p-3 text-xs text-muted-foreground space-y-2">
                <div className="font-semibold text-foreground">How to get your session token:</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Log into <a href="https://www.betfair.com.au" target="_blank" rel="noopener noreferrer" className="text-info underline inline-flex items-center gap-0.5">betfair.com.au <ExternalLink className="h-3 w-3" /></a> in your browser</li>
                  <li>After logging in, open a new tab and visit <a href="https://identitysso.betfair.com/api/keepAlive" target="_blank" rel="noopener noreferrer" className="text-info underline inline-flex items-center gap-0.5">this link <ExternalLink className="h-3 w-3" /></a></li>
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
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
                <div>
                  Betfair blocks automated login from serverless/cloud IPs. The session token method is the most reliable — it uses your browser's authenticated session. Session tokens expire periodically; just grab a fresh one from the link above when that happens.
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Truthful status header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {apiValidated ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-warning" />
                )}
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {apiValidated ? 'Betfair API Connected' : 'Betfair Session: Token Present'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {apiValidated
                      ? `Logged in as ${betfairAccount?.username || 'Betfair user'} — API validated`
                      : `Token present, not validated. Run Endpoint Diagnostic or Fetch Markets to validate.`
                    }
                  </div>
                </div>
              </div>
              {apiStatusBadge()}
            </div>

            {/* HTML 403 error banner */}
            {hasHtmlError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">HTML 403 from Betfair</div>
                  <div className="mt-0.5">
                    The Railway proxy is active, so no Cloudflare Worker redeployment is required.
                    Connect with a fresh browser session token, then run the Endpoint Diagnostic again.
                  </div>
                  {betfairConnection?.marketCatalogueError && (
                    <div className="mt-1 font-mono text-[10px] opacity-70">{betfairConnection.marketCatalogueError.slice(0, 200)}</div>
                  )}
                </div>
              </div>
            )}

            {/* Endpoint Diagnostic */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Stethoscope className="h-3.5 w-3.5 text-info" />
                Betfair Endpoint Diagnostic
              </div>
              <div className="text-[11px] text-muted-foreground">
                Tests both <span className="font-mono">api.betfair.com.au</span> and <span className="font-mono">api.betfair.com</span> to find which returns valid JSON. Detects HTML 403 WAF blocks.
              </div>
              <Button onClick={handleRunDiagnostic} disabled={diagnosticRunning || !betfairSessionToken} variant="outline" size="sm" className="w-full gap-1.5">
                {diagnosticRunning ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running...</> : <><Stethoscope className="h-3.5 w-3.5" /> Run Endpoint Diagnostic</>}
              </Button>

              {diagnosticResult && (
                <div className="space-y-2">
                  {diagnosticResult.workingApiBase ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 text-success text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Working endpoint: <span className="font-mono">{diagnosticResult.workingApiBase}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
                      <AlertCircle className="h-3.5 w-3.5" />
                      No working endpoint found. All returned HTML 403 or errors.
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[9px] h-7 px-2">Endpoint</TableHead>
                        <TableHead className="text-[9px] h-7 px-2">HTTP</TableHead>
                        <TableHead className="text-[9px] h-7 px-2">JSON</TableHead>
                        <TableHead className="text-[9px] h-7 px-2">HTML</TableHead>
                        <TableHead className="text-[9px] h-7 px-2">Success</TableHead>
                        <TableHead className="text-[9px] h-7 px-2">Error / Snippet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(diagnosticResult.endpoints || []).map((ep, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[10px] px-2 py-1 font-mono">{ep.apiBase?.replace('https://', '')}</TableCell>
                          <TableCell className="text-[10px] px-2 py-1 font-mono">{ep.httpStatus || '—'}</TableCell>
                          <TableCell className="text-[10px] px-2 py-1">{ep.responseLooksJson ? <span className="text-success">✓</span> : <span className="text-danger">✗</span>}</TableCell>
                          <TableCell className="text-[10px] px-2 py-1">{ep.responseLooksHtml ? <span className="text-danger">✓</span> : <span className="text-muted-foreground">✗</span>}</TableCell>
                          <TableCell className="text-[10px] px-2 py-1">{ep.success ? <span className="text-success">✓</span> : <span className="text-danger">✗</span>}</TableCell>
                          <TableCell className="text-[10px] px-2 py-1 max-w-[200px] truncate" title={ep.failureReason || ep.firstResponseSnippet}>
                            {ep.betfairErrorCode || ep.failureReason || (ep.firstResponseSnippet?.slice(0, 80) || '—')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Connection details */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">API Status</div>
                <div className="text-sm font-bold font-mono mt-1">
                  {apiValidated ? <span className="text-success">Validated</span> : <span className="text-warning">Not Validated</span>}
                </div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Markets Loaded</div>
                <div className="text-lg font-bold font-mono text-foreground mt-1">{markets.length}</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Runners Tracked</div>
                <div className="text-lg font-bold font-mono text-foreground mt-1">{runners.length}</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Refresh</div>
                <div className="text-sm font-bold font-mono text-foreground mt-1">
                  {betfairConnection.lastMarketSyncTime ? new Date(betfairConnection.lastMarketSyncTime).toLocaleTimeString('en-AU') : '—'}
                </div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Data Fresh</div>
                <div className="text-sm font-bold font-mono mt-1">
                  {betfairConnection.dataFresh ? <span className="text-success">✓ Yes</span> : <span className="text-danger">✗ Stale</span>}
                </div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Jurisdiction</div>
                <div className="text-sm font-bold font-mono text-foreground mt-1">{betfairAccount?.jurisdiction || 'AU'}</div>
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