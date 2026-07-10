import { createClientFromRequest } from 'npm:@base44/sdk@0.8.37';

// AU/NZ endpoint: https://api.betfair.com.au (CORRECT)
// Global: https://api.betfair.com
// NEVER use https://api-au.betfair.com — returns HTML 403
const ENDPOINT_AU = 'https://api.betfair.com.au';
const ENDPOINT_GLOBAL = 'https://api.betfair.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const appKey = Deno.env.get("BETFAIR_APP_KEY");
    const jurisdiction = Deno.env.get("BETFAIR_JURISDICTION") || "AU";
    const proxyUrl = Deno.env.get("BETFAIR_PROXY_URL");
    const envUsername = Deno.env.get("BETFAIR_USERNAME");
    const envPassword = Deno.env.get("BETFAIR_PASSWORD");

    const apiBase = jurisdiction === 'AU' ? ENDPOINT_AU : ENDPOINT_GLOBAL;

    const config = { status: 'success', appKey, jurisdiction, apiBase, proxyUrl: proxyUrl || null };

    let body;
    try { body = await req.json(); } catch { body = {}; }

    // Helper: call Betfair through the proxy — only 4 clean headers
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
      let fundsError = null;
      try {
        const fundsRes = await callBetfair(`${apiBase}/exchange/account/rest/v1.0/getAccountFunds/`, accountHeaders, '{}');
        const fundsText = await fundsRes.text();
        const looksHtml = fundsText.trimStart().startsWith('<!DOCTYPE html') || fundsText.includes('<html');
        if (looksHtml) {
          fundsError = `getAccountFunds: HTML response (HTTP ${fundsRes.status}) — wrong endpoint or WAF block`;
        } else if (fundsRes.ok) {
          try { funds = JSON.parse(fundsText); } catch { fundsError = 'getAccountFunds: non-JSON response'; }
        } else {
          fundsError = `getAccountFunds: HTTP ${fundsRes.status}`;
        }
      } catch (e) {
        fundsError = `getAccountFunds: ${e.message}`;
      }

      let details = null;
      let detailsError = null;
      try {
        const detailsRes = await callBetfair(`${apiBase}/exchange/account/rest/v1.0/getAccountDetails/`, accountHeaders, '{}');
        const detailsText = await detailsRes.text();
        const looksHtml = detailsText.trimStart().startsWith('<!DOCTYPE html') || detailsText.includes('<html');
        if (looksHtml) {
          detailsError = `getAccountDetails: HTML response (HTTP ${detailsRes.status})`;
        } else if (detailsRes.ok) {
          try { details = JSON.parse(detailsText); } catch { detailsError = 'getAccountDetails: non-JSON response'; }
        } else {
          detailsError = `getAccountDetails: HTTP ${detailsRes.status}`;
        }
      } catch (e) {
        detailsError = `getAccountDetails: ${e.message}`;
      }

      return { funds, details, fundsError, detailsError };
    }

    // ─── Session token mode ───
    // User provides a session token. Token is NOT validated here — validation
    // happens when the frontend makes actual market data API calls.
    if (body?.sessionToken) {
      return Response.json({
        ...config,
        status: 'success',
        sessionToken: body.sessionToken,
        sessionValidated: false,
        account: {
          balance: null,
          exposure: null,
          exposureLimit: null,
          discountRate: null,
          pointsBalance: null,
          currency: null,
          firstName: null,
          lastName: null,
          locale: null,
        },
      });
    }

    // ─── Username/password login mode ───
    const username = body?.username || envUsername;
    const password = body?.password || envPassword;

    if (!username || !password) {
      return Response.json(config);
    }

    if (!proxyUrl) {
      return Response.json({
        ...config,
        status: 'error',
        error: 'BETFAIR_PROXY_URL not configured. Set it to the deployed Railway proxy URL.',
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
        error: `Betfair login: ${loginData.loginStatus}. Automated username/password login may require a client certificate. Use a session token instead.`,
      });
    }

    if (loginData.status !== 'SUCCESS' || !loginData.token) {
      return Response.json({
        ...config,
        status: 'error',
        error: `Betfair login failed: ${loginData.error || loginData.loginStatus || 'Unknown error'}. Use a session token instead.`,
      });
    }

    const sessionToken = loginData.token;
    const { funds, details } = await validateSession(sessionToken);

    return Response.json({
      ...config,
      status: 'success',
      sessionToken,
      sessionValidated: true,
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