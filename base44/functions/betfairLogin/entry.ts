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
        error: 'BETFAIR_PROXY_URL not configured. All Betfair endpoints are behind Cloudflare WAF and blocked from serverless IPs. Deploy a proxy (Cloudflare Worker recommended) and set the URL as the BETFAIR_PROXY_URL secret.',
      });
    }

    // Helper: call Betfair through the proxy
    async function callBetfair(targetUrl, headers, bodyStr) {
      const proxyFetchUrl = `${proxyUrl}?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyFetchUrl, {
        method: 'POST',
        headers,
        body: bodyStr,
      });
      return res;
    }

    // Step 1: Login
    const loginUrl = 'https://identitysso.betfair.com/api/login';
    const loginBody = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const loginHeaders = {
      'X-Application': appKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    };

    const loginRes = await callBetfair(loginUrl, loginHeaders, loginBody);
    const loginText = await loginRes.text();

    if (loginText.includes('<!DOCTYPE') || loginText.includes('<html')) {
      return Response.json({ ...config, status: 'error', error: 'Betfair login blocked by Cloudflare even through proxy. Ensure your proxy runs on a non-blocked network (Cloudflare Workers recommended).' });
    }

    let loginData;
    try { loginData = JSON.parse(loginText); } catch {
      return Response.json({ ...config, status: 'error', error: `Betfair login returned unexpected response (HTTP ${loginRes.status}): ${loginText.substring(0, 200)}` });
    }

    if (loginData.status !== 'SUCCESS' || !loginData.token) {
      return Response.json({ ...config, status: 'error', error: `Betfair login failed: ${loginData.error || 'Invalid credentials'}` });
    }

    const sessionToken = loginData.token;

    // Step 2: Get account funds and details
    const accountHeaders = {
      'X-Authentication': sessionToken,
      'X-Application': appKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    let funds = null;
    try {
      const fundsRes = await callBetfair(`${apiBase}/exchange/account/rest/v1.0/getAccountFunds/`, accountHeaders, '{}');
      if (fundsRes.ok) funds = await fundsRes.json();
    } catch {}

    let details = null;
    try {
      const detailsRes = await callBetfair(`${apiBase}/exchange/account/rest/v1.0/getAccountDetails/`, accountHeaders, '{}');
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