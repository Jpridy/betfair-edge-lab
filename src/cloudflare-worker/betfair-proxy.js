/**
 * Betfair CORS Proxy — Cloudflare Worker (raw TCP, v5)
 *
 * Uses cloudflare:sockets with raw TLS to bypass Betfair's WAF fingerprinting.
 * Standard fetch() is blocked by Betfair's WAF (returns HTML 403).
 *
 * Key fixes from v3:
 * - Removed allowHalfOpen (was causing "Stream was cancelled")
 * - Added connection timeout
 * - Simplified socket lifecycle
 * - Processes response incrementally
 *
 * DEPLOY: Paste into Cloudflare Worker, set URL as BETFAIR_PROXY_URL secret.
 */

import { connect } from "cloudflare:sockets";

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
        version: "5-raw-tcp",
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
        : null;

    const isAu = target.hostname.endsWith(".com.au");
    const origin = isAu ? "https://www.betfair.com.au" : "https://www.betfair.com";

    const headers = {
      "Content-Type": request.headers.get("Content-Type") || "application/json",
      Accept: "application/json",
      "Accept-Language": "en-AU,en;q=0.9",
      "Accept-Encoding": "identity",
      "User-Agent": BROWSER_UA,
      Origin: origin,
      Referer: origin + "/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
    };

    const appKey = request.headers.get("X-Application");
    const auth = request.headers.get("X-Authentication");
    if (appKey) headers["X-Application"] = appKey;
    if (auth) headers["X-Authentication"] = auth;

    try {
      const result = await rawTcpRequest(target, request.method, headers, body);
      return new Response(result.body, {
        status: result.status,
        headers: {
          "Content-Type": result.contentType,
          ...CORS_HEADERS,
        },
      });
    } catch (error) {
      return jsonResponse(502, {
        error: "TCP proxy error: " + error.message,
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

async function rawTcpRequest(target, method, headers, body) {
  const host = target.hostname;
  const port = Number(target.port || 443);
  const path = target.pathname + target.search;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let rawRequest = `${method} ${path} HTTP/1.1\r\nHost: ${host}\r\n`;
  for (const [name, value] of Object.entries(headers)) {
    rawRequest += `${name}: ${value}\r\n`;
  }
  if (body) rawRequest += `Content-Length: ${encoder.encode(body).length}\r\n`;
  rawRequest += "Connection: close\r\n\r\n";
  if (body) rawRequest += body;

  // Create socket — no allowHalfOpen (was causing "Stream was cancelled")
  const socket = connect(
    { hostname: host, port },
    { secureTransport: "on" }
  );

  // Wait for the socket to open with a timeout
  const opened = await Promise.race([
    socket.opened,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Socket open timeout (10s)")), 10000)
    ),
  ]);

  // Write the request
  const writer = socket.writable.getWriter();
  await writer.write(encoder.encode(rawRequest));
  writer.releaseLock();

  // Read the response — collect all chunks until done
  const reader = socket.readable.getReader();
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (chunks.length === 0) {
    throw new Error(`No response from ${host}`);
  }

  // Assemble response
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const response = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    response.set(chunk, offset);
    offset += chunk.length;
  }

  // Find header/body boundary
  let headerEnd = -1;
  for (let i = 0; i < response.length - 3; i++) {
    if (response[i] === 13 && response[i + 1] === 10 && response[i + 2] === 13 && response[i + 3] === 10) {
      headerEnd = i;
      break;
    }
  }
  if (headerEnd < 0) throw new Error("Invalid HTTP response — no header terminator");

  const headerText = decoder.decode(response.slice(0, headerEnd));
  const lines = headerText.split("\r\n");
  const status = Number.parseInt(lines[0].split(" ")[1], 10) || 502;
  const responseHeaders = {};
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator > 0) {
      responseHeaders[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
  }

  let bodyBytes = response.slice(headerEnd + 4);
  if (responseHeaders["transfer-encoding"]?.includes("chunked")) {
    bodyBytes = dechunk(bodyBytes);
  }

  return {
    status,
    body: decoder.decode(bodyBytes),
    contentType: responseHeaders["content-type"] || "text/plain",
  };
}

function dechunk(bytes) {
  const decoder = new TextDecoder();
  const output = [];
  let position = 0;
  while (position < bytes.length) {
    let lineEnd = position;
    while (lineEnd < bytes.length - 1 && !(bytes[lineEnd] === 13 && bytes[lineEnd + 1] === 10)) lineEnd++;
    if (lineEnd >= bytes.length - 1) break;
    const size = Number.parseInt(decoder.decode(bytes.slice(position, lineEnd)).trim(), 16);
    if (!Number.isFinite(size) || size === 0) break;
    const chunkStart = lineEnd + 2;
    output.push(bytes.slice(chunkStart, chunkStart + size));
    position = chunkStart + size + 2;
  }
  const length = output.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of output) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}