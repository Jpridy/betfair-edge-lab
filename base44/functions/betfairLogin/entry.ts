import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const appKey = Deno.env.get("BETFAIR_APP_KEY");
    const jurisdiction = Deno.env.get("BETFAIR_JURISDICTION") || "AU";
    const proxyUrl = Deno.env.get("BETFAIR_PROXY_URL");
    const envUsername = Deno.env.get("BETFAIR_USERNAME");
    const envPassword = Deno.env.get("BETFAIR_PASSWORD");

    const apiBase = jurisdiction === 'AU'
      ? 'https://api-au.betfair.com'
      : 'https://api.betfair.com';

    const config = { status: 'success', appKey, jurisdiction, apiBase, proxyUrl: proxyUrl || null };

    let body;
    try { body = await req.json(); } catch { body = {}; }

    const username = body?.username || envUsername;
    const password = body?.password || envPassword;

    // No login requested — return config only
    if (!username || !password) {
      return Response.json(config);
    }

    // Step 1: Login — try direct first, then proxy
    const loginTargetUrl = 'https://identitysso.betfair.com/api/login';
    const loginBodyStr = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const loginHeaders = {
      'X-Application': appKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    };

    // Try direct call first
    let loginRes = await fetch(loginTargetUrl, {
      method: 'POST',
      headers: loginHeaders,
      body: loginBodyStr,
    });

    let loginText = await loginRes.text();
    let usedProxy = false;

    // If blocked (HTML response), try through proxy
    if ((loginText.includes('<!DOCTYPE') || loginText.includes('<html')) && proxyUrl) {
      const loginProxyUrl = `${proxyUrl}?url=${encodeURIComponent(loginTargetUrl)}`;
      loginRes = await fetch(loginProxyUrl, {
        method: 'POST',
        headers: loginHeaders,
        body: loginBodyStr,
      });
      loginText = await loginRes.text();
      usedProxy = true;
    }

    if (loginText.includes('<!DOCTYPE') || loginText.includes('<html')) {
      return Response.json({ ...config, status: 'error', error: `Login blocked. Direct: ${!usedProxy}. Response snippet: ${loginText.substring(0, 500)}` });
    }

    let loginData;
    try { loginData = JSON.parse(loginText); } catch {
      return Response.json({ ...config, status: 'error', error: `Betfair login returned unexpected response (HTTP ${loginRes.status})` });
    }

    if (loginData.status !== 'SUCCESS' || !loginData.token) {
      return Response.json({ ...config, status: 'error', error: `Betfair login failed: ${loginData.error || 'Invalid credentials'}` });
    }

    const sessionToken = loginData.token;

    // Helper: try direct, then proxy
    const accountHeaders = {
      'X-Authentication': sessionToken,
      'X-Application': appKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    };

    async function fetchAccount(endpoint) {
      const targetUrl = `${apiBase}/exchange/account/rest/v1.0/${endpoint}/`;
      let res = await fetch(targetUrl, { method: 'POST', headers: accountHeaders, body: '{}' });
      let text = await res.text();
      if ((text.includes('<!DOCTYPE') || text.includes('<html')) && proxyUrl) {
        const proxyFetchUrl = `${proxyUrl}?url=${encodeURIComponent(targetUrl)}`;
        res = await fetch(proxyFetchUrl, { method: 'POST', headers: accountHeaders, body: '{}' });
        text = await res.text();
      }
      try { return JSON.parse(text); } catch { return null; }
    }

    const funds = await fetchAccount('getAccountFunds');
    const details = await fetchAccount('getAccountDetails');

    return Response.json({
      ...config,
      status: 'success',
      sessionToken,
      account: {
        balance: funds?.availableToBetBalance ?? null,
        exposure: funds?.exposure ?? null,
        exposureLimit: funds?.exposureLimit ?? null,
        discountRate: funds?.discountRate ?? null,
        pointsBalance: funds?.pointsBalance ?? null,
        currency: details?.currencyCode ?? null,
        firstName: details?.firstName ?? null,
        lastName: details?.lastName ?? null,
        locale: details?.localeCode ?? null,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});