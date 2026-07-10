/**
 * Betfair CORS Proxy — Cloudflare Worker (fetch-based)
 *
 * Uses standard fetch() with browser-like headers instead of raw TCP sockets.
 * The raw cloudflare:sockets approach was returning "Stream was cancelled" errors.
 *
 * DEPLOY: Paste into Cloudflare Worker, set URL as BETFAIR_PROXY_URL secret.
 */

const ALLOWED_HOSTS = new Set([
  "api.betfair.com",
  "api.betfair.com.au",
  "identitysso.betfair.com",
  "identitysso-cert.betfair.com",
]);

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Application, X-Authentication",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return jsonResponse(200, {
        status: "ok",
        service: "betfair-proxy",
        version: "4-fetch",
      });
    }

    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) return jsonResponse(400, { error: "Missing url parameter" });

    const target = new URL(targetUrl);
    if (!ALLOWED_HOSTS.has(target.hostname)) {
      return jsonResponse(403, { error: "Target host not allowed", host: target.hostname });
    }

    const body =
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.text()
        : undefined;

    const isAu = target.hostname.endsWith(".com.au");
    const origin = isAu ? "https://www.betfair.com.au" : "https://www.betfair.com";

    const headers = {
      "Content-Type": request.headers.get("Content-Type") || "application/json",
      Accept: "application/json",
      "Accept-Language": "en-AU,en;q=0.9",
      "User-Agent": BROWSER_UA,
      Origin: origin,
      Referer: origin + "/",
    };

    const appKey = request.headers.get("X-Application");
    const auth = request.headers.get("X-Authentication");
    if (appKey) headers["X-Application"] = appKey;
    if (auth) headers["X-Authentication"] = auth;

    try {
      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
      });

      const responseText = await upstream.text();

      return new Response(responseText, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") || "application/json",
          ...CORS_HEADERS,
        },
      });
    } catch (error) {
      return jsonResponse(502, {
        error: "Proxy fetch failed: " + error.message,
      });
    }
  },
};

function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}