/**
 * Betfair CORS Proxy — Cloudflare Worker
 * 
 * This proxy runs on Cloudflare's edge network, which Betfair's Cloudflare
 * WAF trusts. It forwards requests to Betfair and adds CORS headers.
 * 
 * DEPLOY INSTRUCTIONS:
 * 
 * 1. Go to https://dash.cloudflare.com → Workers & Pages
 * 2. Click "Create" → "Create Worker"
 * 3. Give it a name (e.g. "betfair-proxy") → click "Deploy"
 * 4. Click "Edit code"
 * 5. Delete everything in the editor
 * 6. Paste this entire file
 * 7. Click "Save and deploy"
 * 8. Copy the URL (e.g. https://betfair-proxy.yourname.workers.dev)
 * 9. Set that URL as your BETFAIR_PROXY_URL secret in Base44 settings
 *    (Settings → Environment Variables → BETFAIR_PROXY_URL)
 */

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing "url" query parameter', { status: 400 });
    }

    try {
      // Read the original body
      let body = null;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        body = await request.text();
      }

      // Extract only the headers we want to forward (application-specific ones)
      const forwardHeaders = [
        'x-application',
        'x-authentication',
        'x-application-id',
        'content-type',
        'accept',
      ];

      const cleanHeaders = {};
      for (const h of forwardHeaders) {
        const val = request.headers.get(h);
        if (val) cleanHeaders[h] = val;
      }

      // Derive Origin/Referer from the target URL so they match
      const target = new URL(targetUrl);
      cleanHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      cleanHeaders['Accept-Language'] = 'en-AU,en;q=0.9';
      cleanHeaders['Accept-Encoding'] = 'gzip, deflate, br';
      cleanHeaders['Origin'] = target.origin;
      cleanHeaders['Referer'] = target.origin + '/';

      // Ensure Content-Type defaults
      if (!cleanHeaders['Content-Type'] && body) {
        cleanHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      if (!cleanHeaders['Accept']) {
        cleanHeaders['Accept'] = 'application/json';
      }

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: cleanHeaders,
        body: body,
      });

      // Return the response with CORS headers added
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      newResponse.headers.set('Access-Control-Allow-Headers', '*');

      return newResponse;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};