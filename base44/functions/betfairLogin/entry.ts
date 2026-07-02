import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const appKey = Deno.env.get("BETFAIR_APP_KEY");
    const jurisdiction = Deno.env.get("BETFAIR_JURISDICTION") || "AU";

    if (!appKey) {
      return Response.json({ error: 'BETFAIR_APP_KEY not configured' }, { status: 400 });
    }

    const apiBase = jurisdiction === 'AU'
      ? 'https://api-au.betfair.com'
      : 'https://api.betfair.com';

    // The app key is not a true secret — Betfair expects it in client-side HTTP headers.
    // Return it so the frontend can make direct browser-to-Betfair calls, bypassing
    // Cloudflare blocks on cloud server IPs.
    return Response.json({
      status: 'success',
      appKey,
      jurisdiction,
      apiBase,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});