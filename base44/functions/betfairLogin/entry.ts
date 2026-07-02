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

    // Login requested — need proxy to bypass Cloudflare
    if (!proxyUrl) {
      return Response.json({
        ...config,
        status: 'error',
        error: 'BETFAIR_PROXY_URL not configured. Deploy a Cloudflare Worker proxy and set the URL as the BETFAIR_PROXY_URL secret.',
      });
    }

    // Step 1: Login through proxy
    const loginTargetUrl = 'https://identitysso.betfair.com/api/login';
    const loginProxyUrl = `${proxyUrl}?url=${encodeURIComponent(loginTargetUrl)}`;
    const loginBodyStr = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    const loginRes = await fetch(loginProxyUrl, {
      method: 'POST',
      headers: {
        'X-Application': appKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: loginBodyStr,
    });

    const loginText = await loginRes.text();

    if (loginText.includes('<!DOCTYPE') || loginText.includes('<html')) {
      return Response.json({ ...config, status: 'error', error: 'Betfair login blocked even through proxy. Check that the Cloudflare Worker is deployed correctly.' });
    }

    let loginData;
    try { loginData = JSON.parse(loginText); } catch {
      return Response.json({ ...config, status: 'error', error: `Betfair login returned unexpected response (HTTP ${loginRes.status})` });
    }

    if (loginData.status !== 'SUCCESS' || !loginData.token) {
      return Response.json({ ...config, status: 'error', error: `Betfair login failed: ${loginData.error || 'Invalid credentials'}` });
    }

    const sessionToken = loginData.token;

    // Step 2: Get account funds through proxy
    const fundsTargetUrl = `${apiBase}/exchange/account/rest/v1.0/getAccountFunds/`;
    const fundsProxyUrl = `${proxyUrl}?url=${encodeURIComponent(fundsTargetUrl)}`;

    const fundsRes = await fetch(fundsProxyUrl, {
      method: 'POST',
      headers: {
        'X-Authentication': sessionToken,
        'X-Application': appKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: '{}',
    });

    let funds = null;
    if (fundsRes.ok) {
      try { funds = await fundsRes.json(); } catch {}
    }

    // Step 3: Get account details through proxy
    const detailsTargetUrl = `${apiBase}/exchange/account/rest/v1.0/getAccountDetails/`;
    const detailsProxyUrl = `${proxyUrl}?url=${encodeURIComponent(detailsTargetUrl)}`;

    let details = null;
    try {
      const detailsRes = await fetch(detailsProxyUrl, {
        method: 'POST',
        headers: {
          'X-Authentication': sessionToken,
          'X-Application': appKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: '{}',
      });
      if (detailsRes.ok) details = await detailsRes.json();
    } catch {}

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