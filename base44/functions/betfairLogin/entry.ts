import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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

    // Helper: validate a session token by fetching account data
    async function validateSession(sessionToken) {
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

      return { funds, details };
    }

    // ─── Session token mode ───
    // User provides a session token obtained from their browser after logging into Betfair.
    // This bypasses the login flow entirely (Betfair's login endpoints block serverless/cloud IPs).
    if (body?.sessionToken) {
      if (!proxyUrl) {
        return Response.json({ ...config, status: 'error', error: 'BETFAIR_PROXY_URL not configured. Set the proxy URL secret to route API calls through your Cloudflare Worker.' });
      }

      const { funds, details } = await validateSession(body.sessionToken);

      // If funds is null, the token is likely invalid/expired
      if (!funds && !details) {
        return Response.json({ ...config, status: 'error', error: 'Session token is invalid or expired. Log into Betfair in your browser and get a fresh session token.' });
      }

      return Response.json({
        ...config,
        status: 'success',
        sessionToken: body.sessionToken,
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
    }

    // ─── Username/password login mode ───
    const username = body?.username || envUsername;
    const password = body?.password || envPassword;

    // No login requested — return config only
    if (!username || !password) {
      return Response.json(config);
    }

    if (!proxyUrl) {
      return Response.json({
        ...config,
        status: 'error',
        error: 'BETFAIR_PROXY_URL not configured. Deploy a Cloudflare Worker proxy and set the URL as the BETFAIR_PROXY_URL secret.',
      });
    }

    // Try certlogin endpoint (not behind WAF bot protection)
    const loginUrl = 'https://identitysso-cert.betfair.com/api/certlogin';
    const loginBody = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const loginHeaders = {
      'X-Application': appKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    };

    const loginRes = await callBetfair(loginUrl, loginHeaders, loginBody);
    const loginText = await loginRes.text();

    let loginData;
    try { loginData = JSON.parse(loginText); } catch {
      return Response.json({
        ...config,
        status: 'error',
        error: `Login endpoint returned non-JSON (HTTP ${loginRes.status}). Betfair may require certificate-based authentication for automated login. Use a session token instead — log into Betfair in your browser, then paste your session token into the app.`,
      });
    }

    if (loginData.loginStatus && loginData.loginStatus !== 'SUCCESS') {
      return Response.json({
        ...config,
        status: 'error',
        error: `Betfair login: ${loginData.loginStatus}. Automated username/password login may require a client certificate. Use a session token instead — log into Betfair in your browser, then paste your session token into the app.`,
      });
    }

    if (loginData.status !== 'SUCCESS' || !loginData.token) {
      return Response.json({
        ...config,
        status: 'error',
        error: `Betfair login failed: ${loginData.error || loginData.loginStatus || 'Unknown error'}. Use a session token instead — log into Betfair in your browser, then paste your session token into the app.`,
      });
    }

    const sessionToken = loginData.token;
    const { funds, details } = await validateSession(sessionToken);

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