/**
 * Betfair CORS Proxy + Stream Bridge — Cloudflare Worker
 *
 * Sets a standard browser User-Agent to avoid Cloudflare Workers' default
 * "Cloudflare-Workers" UA which triggers Betfair's WAF HTML 403 block.
 * Does NOT forward Origin, Referer, cookies, or sec-fetch headers.
 *
 * DEPLOY: Paste into Cloudflare Worker, set URL as BETFAIR_PROXY_URL secret.
 */

import { connect } from "cloudflare:sockets";

const BETFAIR_STREAM_HOST = "stream-api.betfair.com:443";

const ALLOWED_HOSTS = new Set([
  "api.betfair.com",
  "api.betfair.com.au",
  "identitysso.betfair.com",
  "identitysso-cert.betfair.com",
]);

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export default {
  async fetch(request) {
    if (request.headers.get("Upgrade") === "websocket") {
      return handleStreamBridge(request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Application, X-Authentication",
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) return json({ error: "Missing url parameter" }, 400);

    const target = new URL(targetUrl);
    if (!ALLOWED_HOSTS.has(target.hostname)) {
      return json({ error: "Target host not allowed", host: target.hostname }, 403);
    }

    const body = request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : null;
    const isAu = target.hostname.endsWith(".com.au");
    const origin = isAu ? "https://www.betfair.com.au" : "https://www.betfair.com";
    const headers = {
      "Content-Type": request.headers.get("Content-Type") || "application/json",
      "Accept": "application/json",
      "User-Agent": BROWSER_UA,
      "Accept-Language": "en-AU,en;q=0.9",
      "Accept-Encoding": "identity",
      "Origin": origin,
      "Referer": origin + "/",
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
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Application, X-Authentication",
        },
      });
    } catch (error) {
      return json({ error: "TCP proxy error: " + error.message }, 502);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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

  const socket = connect(
    { hostname: host, port },
    { secureTransport: "on", allowHalfOpen: true }
  );
  let socketCloseError = null;
  const socketClosed = socket.closed.catch((error) => {
    socketCloseError = error;
  });
  await socket.opened;

  const writer = socket.writable.getWriter();
  await writer.write(encoder.encode(rawRequest));
  writer.releaseLock();

  const reader = socket.readable.getReader();
  const chunks = [];
  let readError = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } catch (error) {
    readError = error;
  } finally {
    reader.releaseLock();
  }
  await socketClosed;

  if (chunks.length === 0) {
    const cause = socketCloseError?.message || readError?.message || "connection closed without data";
    throw new Error(`No response from ${host}: ${cause}`);
  }

  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const response = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    response.set(chunk, offset);
    offset += chunk.length;
  }

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

async function handleStreamBridge(request) {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();

  let betfairSocket, writer, reader;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let closed = false;

  function sendDiag(message) {
    try { server.send(JSON.stringify({ op: "diag", message })); } catch (_) {}
  }

  try {
    betfairSocket = connect(BETFAIR_STREAM_HOST, { secureTransport: "on" });
    writer = betfairSocket.writable.getWriter();
    reader = betfairSocket.readable.getReader();
    sendDiag("TCP socket created to " + BETFAIR_STREAM_HOST);
  } catch (err) {
    sendDiag("TCP connect() threw: " + err.message);
    server.close(1011, "TCP connection failed");
    return new Response(null, { status: 101, webSocket: client });
  }

  server.addEventListener("message", (event) => {
    if (closed) return;
    const data = typeof event.data === "string" ? event.data + "\r\n" : null;
    if (data) {
      writer.write(encoder.encode(data)).catch((err) => {
        sendDiag("TCP write failed: " + (err?.message || String(err)));
        if (!closed) { closed = true; server.close(1011, "TCP write failed"); }
      });
    }
  });

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { sendDiag("TCP stream ended"); break; }
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\r\n")) >= 0) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (line.trim()) server.send(line);
        }
      }
    } catch (e) {
      sendDiag("TCP read error: " + (e?.message || String(e)));
    }
    if (!closed) { closed = true; server.close(1000, "Betfair stream ended"); }
  })();

  server.addEventListener("close", () => {
    closed = true; writer.close().catch(() => {}); reader.cancel().catch(() => {});
  });
  server.addEventListener("error", () => {
    closed = true; writer.close().catch(() => {}); reader.cancel().catch(() => {});
  });

  return new Response(null, { status: 101, webSocket: client });
}