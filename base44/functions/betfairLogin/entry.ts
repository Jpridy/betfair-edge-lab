import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const appKey = Deno.env.get("BETFAIR_APP_KEY");
    const ssoid = Deno.env.get("BETFAIR_SSOID");
    const jurisdiction = Deno.env.get("BETFAIR_JURISDICTION") || "AU";

    if (!appKey || !ssoid) {
      return Response.json({
        status: 'error',
        error: 'Betfair SSOID or App Key not configured. Set BETFAIR_SSOID and BETFAIR_APP_KEY as secrets.'
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
    try {
      const fundsRes = await fetch(`${apiBase}/exchange/account/rest/v1.0/getAccountFunds/`, {
        method: 'POST',
        headers: authHeaders,
        body: '{}',
      });
      const fundsText = await fundsRes.text();
      try { accountFunds = JSON.parse(fundsText); } catch { accountFunds = null; }

      if (fundsRes.status === 401 || (accountFunds && accountFunds.error)) {
        return Response.json({
          status: 'error',
          error: 'SSOID is invalid or expired. Please get a new SSOID from your Betfair browser session.'
        }, { status: 401 });
      }
    } catch (e) {
      return Response.json({
        status: 'error',
        error: `Failed to validate SSOID: ${e.message}`
      }, { status: 502 });
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