import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const username = Deno.env.get("BETFAIR_USERNAME");
    const password = Deno.env.get("BETFAIR_PASSWORD");
    const appKey = Deno.env.get("BETFAIR_APP_KEY");
    const jurisdiction = Deno.env.get("BETFAIR_JURISDICTION") || "AU";

    if (!username || !password || !appKey) {
      return Response.json({
        status: 'error',
        error: 'Betfair credentials not configured. Set BETFAIR_USERNAME, BETFAIR_PASSWORD, and BETFAIR_APP_KEY as secrets.'
      }, { status: 400 });
    }

    // Betfair interactive login — try JSON API endpoint first, then HTML endpoint
    const loginBody = new URLSearchParams({ username, password });
    const loginHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Application': appKey,
      'User-Agent': 'BetfairEdgeLab/1.0',
    };

    let loginData = null;
    let loginError = null;

    // Try JSON API endpoint
    try {
      const loginRes = await fetch('https://identitysso-api.betfair.com/api/login', {
        method: 'POST',
        headers: loginHeaders,
        body: loginBody,
      });
      const loginText = await loginRes.text();
      try {
        loginData = JSON.parse(loginText);
      } catch {
        loginError = `Betfair returned non-JSON response (HTTP ${loginRes.status}). The server IP may be blocked by Betfair.`;
      }
    } catch (e) {
      loginError = `Network error: ${e.message}`;
    }

    // Fallback to HTML endpoint
    if (!loginData || loginData.status !== 'SUCCESS') {
      try {
        const loginRes2 = await fetch('https://identitysso.betfair.com/api/login', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Application': appKey,
          },
          body: loginBody,
        });
        const loginText2 = await loginRes2.text();
        try {
          loginData = JSON.parse(loginText2);
        } catch {
          // If both endpoints fail, return the error
        }
      } catch (e) {
        // Keep original error
      }
    }

    if (!loginData || loginData.status !== 'SUCCESS' || !loginData.token) {
      return Response.json({
        status: 'error',
        error: loginData?.error || loginError || 'Login failed — Betfair may be blocking the server IP or credentials may be invalid.',
        loginStatus: loginData?.status || 'unknown',
      }, { status: 401 });
    }

    const sessionToken = loginData.token;

    // Get account funds
    let accountFunds = null;
    try {
      const fundsRes = await fetch('https://api.betfair.com/exchange/account/rest/v1.0/getAccountFunds/', {
        method: 'POST',
        headers: {
          'X-Authentication': sessionToken,
          'X-Application': appKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: '{}',
      });
      accountFunds = await fundsRes.json();
    } catch (e) {
      // Funds fetch is optional
    }

    // Get account details (currency, name)
    let accountDetails = null;
    try {
      const detailsRes = await fetch('https://api.betfair.com/exchange/account/rest/v1.0/getAccountDetails/', {
        method: 'POST',
        headers: {
          'X-Authentication': sessionToken,
          'X-Application': appKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: '{}',
      });
      accountDetails = await detailsRes.json();
    } catch (e) {
      // Details fetch is optional
    }

    return Response.json({
      status: 'success',
      sessionToken,
      username,
      jurisdiction,
      balance: accountFunds?.availableToBetBalance ?? null,
      exposure: accountFunds?.exposure ?? null,
      exposureLimit: accountFunds?.exposureLimit ?? null,
      discountRate: accountFunds?.discountRate ?? null,
      pointsBalance: accountFunds?.pointsBalance ?? null,
      currency: accountDetails?.currencyCode ?? null,
      firstName: accountDetails?.firstName ?? null,
      lastName: accountDetails?.lastName ?? null,
      locale: accountDetails?.localeCode ?? null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});