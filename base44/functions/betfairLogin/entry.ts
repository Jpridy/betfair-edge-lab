import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized — please log in again.' }, { status: 401 });

    const appKey = Deno.env.get("BETFAIR_APP_KEY");
    const jurisdiction = Deno.env.get("BETFAIR_JURISDICTION") || "AU";

    if (!appKey) {
      return Response.json({
        status: 'error',
        error: 'BETFAIR_APP_KEY not configured. Set it as an app secret.'
      }, { status: 400 });
    }

    let body;
    try { body = await req.json(); } catch { body = {}; }
    const ssoid = body?.ssoid;

    if (!ssoid) {
      return Response.json({
        status: 'error',
        error: 'SSOID is required. Get it from your Betfair browser session cookies.'
      }, { status: 400 });
    }

    const apiBase = jurisdiction === 'AU'
      ? 'https://api-au.betfair.com'
      : 'https://api.betfair.com';

    const authHeaders = {
      'X-Authentication': ssoid,
      'X-Application': appKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Validate the SSOID by fetching account funds
    let accountFunds = null;
    const fundsRes = await fetch(`${apiBase}/exchange/account/rest/v1.0/getAccountFunds/`, {
      method: 'POST',
      headers: authHeaders,
      body: '{}',
    });
    const fundsText = await fundsRes.text();

    // Check for auth failures
    if (fundsRes.status === 401 || fundsText.includes('UNAUTHORIZED') || fundsText.includes('INVALID_SESSION') || fundsText.includes('NO_SESSION')) {
      return Response.json({
        status: 'error',
        error: 'SSOID is invalid or expired. Log into betfair.com again and get a fresh SSOID from your cookies.'
      }, { status: 401 });
    }

    try {
      accountFunds = JSON.parse(fundsText);
      // If the API returned an error object, treat as invalid
      if (accountFunds?.error) {
        return Response.json({
          status: 'error',
          error: `Betfair API error: ${accountFunds.error}${accountFunds.errorCode ? ` (${accountFunds.errorCode})` : ''}`
        }, { status: 401 });
      }
      // If we didn't get valid account data, something went wrong
      if (!accountFunds || typeof accountFunds.availableToBetBalance === 'undefined') {
        return Response.json({
          status: 'error',
          error: 'SSOID validation failed — unexpected response from Betfair. The SSOID may be invalid.'
        }, { status: 401 });
      }
    } catch {
      return Response.json({
        status: 'error',
        error: 'SSOID validation failed — Betfair returned a non-JSON response (HTTP ' + fundsRes.status + '). The SSOID may be invalid.'
      }, { status: 401 });
    }

    // Get account details (currency, name)
    let accountDetails = null;
    try {
      const detailsRes = await fetch(`${apiBase}/exchange/account/rest/v1.0/getAccountDetails/`, {
        method: 'POST',
        headers: authHeaders,
        body: '{}',
      });
      accountDetails = await detailsRes.json();
    } catch (e) {
      // Details fetch is optional
    }

    return Response.json({
      status: 'success',
      sessionToken: ssoid,
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