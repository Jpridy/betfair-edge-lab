import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const appKey = Deno.env.get("BETFAIR_APP_KEY");
    const jurisdiction = Deno.env.get("BETFAIR_JURISDICTION") || "AU";

    if (!appKey) {
      return Response.json({ error: 'BETFAIR_APP_KEY not configured' }, { status: 400 });
    }

    // The app key is not a true secret — Betfair expects it in client-side headers.
    // Return it so the frontend can make direct browser-to-Betfair API calls
    // (bypassing Cloudflare blocks on cloud server IPs).
    return Response.json({
      status: 'success',
      appKey,
      jurisdiction,
      apiBase: jurisdiction === 'AU'
        ? 'https://api-au.betfair.com'
        : 'https://api.betfair.com',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});