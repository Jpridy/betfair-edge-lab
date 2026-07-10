import http from "node:http";
import { Buffer } from "node:buffer";
import process from "node:process";

const allowedHosts = new Set([
  "api.betfair.com",
  "api.betfair.com.au",
  "identitysso.betfair.com",
  "identitysso-cert.betfair.com",
]);

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS, GET",
  "access-control-allow-headers": "Content-Type, X-Application, X-Authentication",
};

const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function sendJson(response, status, data) {
  response.writeHead(status, { ...corsHeaders, "content-type": "application/json" });
  response.end(JSON.stringify(data));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname === "/health") {
    sendJson(response, 200, { status: "ok", service: "betfair-rest-proxy", version: "5-minimal-headers" });
    return;
  }

  const targetValue = requestUrl.searchParams.get("url");
  if (!targetValue) {
    sendJson(response, 400, { error: "Missing url parameter" });
    return;
  }

  let target;
  try {
    target = new URL(targetValue);
  } catch {
    sendJson(response, 400, { error: "Invalid target URL" });
    return;
  }

  if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) {
    sendJson(response, 403, { error: "Target host not allowed" });
    return;
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  // Minimal API-client headers — no browser fingerprint headers
  // (Origin/Referer/Sec-Fetch-* trigger Betfair's WAF on server-side requests)
  const headers = {
    "accept": "application/json",
    "content-type": request.headers["content-type"] || "application/json",
  };
  if (request.headers["x-application"]) headers["x-application"] = request.headers["x-application"];
  if (request.headers["x-authentication"]) headers["x-authentication"] = request.headers["x-authentication"];

  try {
    const upstream = await fetch(target.href, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : body,
    });
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      ...corsHeaders,
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
    });
    response.end(responseBody);
  } catch (error) {
    sendJson(response, 502, { error: `Betfair proxy request failed: ${error.message}` });
  }
});

server.listen(Number(process.env.PORT || 3000), "0.0.0.0");