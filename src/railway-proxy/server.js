import http from "node:http";
import tls from "node:tls";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import process from "node:process";

const BETFAIR_STREAM_HOST = "stream-api.betfair.com";
const BETFAIR_STREAM_PORT = 443;

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

const browserUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function sendJson(response, status, data) {
  response.writeHead(status, { ...corsHeaders, "content-type": "application/json" });
  response.end(JSON.stringify(data));
}

const server = http.createServer(async (request, response) => {
  // ── CORS preflight ──
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  // ── Health check ──
  if (requestUrl.pathname === "/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "betfair-rest-proxy",
      version: "6-stream-bridge",
      features: ["rest-proxy", "websocket-stream-bridge"],
    });
    return;
  }

  // ── Stream TCP connectivity test ──
  if (requestUrl.pathname === "/stream-test") {
    try {
      const testSocket = tls.connect({
        host: BETFAIR_STREAM_HOST,
        port: BETFAIR_STREAM_PORT,
        rejectUnauthorized: true,
      });
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("TCP open timeout (10s)")), 10000);
        testSocket.once("secureConnect", () => {
          clearTimeout(timeout);
          resolve();
        });
        testSocket.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      testSocket.destroy();
      sendJson(response, 200, {
        status: "ok",
        message: `TCP connection to ${BETFAIR_STREAM_HOST}:${BETFAIR_STREAM_PORT} succeeded`,
        host: BETFAIR_STREAM_HOST,
        port: BETFAIR_STREAM_PORT,
      });
    } catch (err) {
      sendJson(response, 502, {
        status: "error",
        message: `TCP connection to ${BETFAIR_STREAM_HOST}:${BETFAIR_STREAM_PORT} failed: ${err.message}`,
        host: BETFAIR_STREAM_HOST,
        port: BETFAIR_STREAM_PORT,
      });
    }
    return;
  }

  // ── REST API proxy ──
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
    accept: "application/json",
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

// ── WebSocket upgrade handler → Betfair Stream API TCP bridge ──
// Betfair's Stream API uses raw TLS TCP with line-delimited JSON (NOT WebSocket).
// The browser can't do raw TCP, so we:
// 1. Accept a WebSocket upgrade from the browser
// 2. Open a raw TLS TCP socket to stream-api.betfair.com:443
// 3. Forward browser WebSocket messages → Betfair TCP (appending \r\n)
// 4. Forward Betfair TCP responses → browser WebSocket (splitting on \r\n)
//
// We implement a minimal RFC 6455 WebSocket server by hand (no ws dependency needed).
server.on("upgrade", (request, socket, head) => {
  // Only allow WebSocket upgrades to the root path
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname !== "/" && requestUrl.pathname !== "/stream") {
    socket.destroy();
    return;
  }

  const wsKey = request.headers["sec-websocket-key"];
  if (!wsKey) {
    socket.destroy();
    return;
  }

  // Accept the WebSocket handshake (RFC 6455)
  const acceptKey = crypto
    .createHash("sha1")
    .update(wsKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  const handshakeResponse = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "",
    "",
  ].join("\r\n");

  socket.write(handshakeResponse);

  // ── Connect to Betfair Stream API via raw TLS TCP ──
  let betfairSocket;
  let buffer = "";
  let closed = false;

  function sendDiag(message) {
    if (closed) return;
    try {
      sendWsMessage(socket, JSON.stringify({ op: "diag", message }));
    } catch (_) {}
  }

  try {
    betfairSocket = tls.connect({
      host: BETFAIR_STREAM_HOST,
      port: BETFAIR_STREAM_PORT,
      rejectUnauthorized: true,
    });
  } catch (err) {
    sendDiag("Stream TCP connect threw: " + err.message);
    closeWs(socket, 1011, "TCP connection failed");
    return;
  }

  betfairSocket.setTimeout(15000);
  betfairSocket.once("secureConnect", () => {
    betfairSocket.setTimeout(0);
    sendDiag("TLS TCP socket connected to " + BETFAIR_STREAM_HOST + ":" + BETFAIR_STREAM_PORT);
  });

  betfairSocket.on("error", (err) => {
    sendDiag("Stream TCP error: " + err.message);
    if (!closed) {
      closed = true;
      closeWs(socket, 1011, "TCP error");
    }
  });

  // ── Betfair → Browser: read TCP stream, split on \r\n, send as WS frames ──
  betfairSocket.on("data", (data) => {
    buffer += data.toString("utf8");
    let idx;
    while ((idx = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (line.trim()) {
        if (!sendWsMessage(socket, line)) {
          // WebSocket send failed — close everything
          if (!closed) {
            closed = true;
            betfairSocket.destroy();
          }
          return;
        }
      }
    }
  });

  betfairSocket.on("close", () => {
    if (!closed) {
      closed = true;
      closeWs(socket, 1000, "Betfair stream ended");
    }
  });

  betfairSocket.on("timeout", () => {
    sendDiag("Stream TCP connect timeout (15s)");
    if (!closed) {
      closed = true;
      betfairSocket.destroy();
      closeWs(socket, 1011, "TCP connect timeout");
    }
  });

  // ── Browser → Betfair: parse WS frames, forward as raw TCP lines ──
  let wsBuffer = Buffer.alloc(0);

  socket.on("data", (data) => {
    wsBuffer = Buffer.concat([wsBuffer, data]);
    // Parse complete WebSocket frames from the buffer
    while (wsBuffer.length >= 2) {
      const frame = parseWsFrame(wsBuffer);
      if (!frame) break; // incomplete frame, wait for more data
      wsBuffer = wsBuffer.slice(frame.totalLength);

      if (frame.opcode === 0x8) {
        // Close frame
        if (!closed) {
          closed = true;
          betfairSocket.destroy();
        }
        return;
      }

      if (frame.opcode === 0x1 || frame.opcode === 0x2) {
        // Text or binary frame — forward to Betfair with \r\n appended
        const message = frame.payload.toString("utf8") + "\r\n";
        if (!betfairSocket.destroyed) {
          betfairSocket.write(message, (err) => {
            if (err) {
              sendDiag("TCP write failed: " + err.message);
              if (!closed) {
                closed = true;
                closeWs(socket, 1011, "TCP write failed");
              }
            }
          });
        }
      }
    }
  });

  socket.on("error", () => {
    if (!closed) {
      closed = true;
      betfairSocket.destroy();
    }
  });

  socket.on("close", () => {
    if (!closed) {
      closed = true;
      betfairSocket.destroy();
    }
  });

  // Handle any leftover head data
  if (head && head.length > 0) {
    socket.emit("data", head);
  }
});

// ── Minimal RFC 6455 WebSocket helpers (no external dependency) ──

function sendWsMessage(socket, message) {
  try {
    const payload = Buffer.from(message, "utf8");
    const frame = encodeWsFrame(payload, 0x1); // text frame
    socket.write(frame);
    return true;
  } catch (_) {
    return false;
  }
}

function closeWs(socket, code, reason) {
  try {
    const payload = Buffer.alloc(2 + Buffer.byteLength(reason || ""));
    payload.writeUInt16BE(code, 0);
    if (reason) payload.write(reason, 2, "utf8");
    socket.write(encodeWsFrame(payload, 0x8)); // close frame
  } catch (_) {}
  setTimeout(() => { try { socket.destroy(); } catch (_) {} }, 100);
}

function encodeWsFrame(payload, opcode) {
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  header[0] = 0x80 | opcode; // FIN bit + opcode
  return Buffer.concat([header, payload]);
}

function parseWsFrame(buffer) {
  if (buffer.length < 2) return null;

  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let payloadLen = buffer[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let mask = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    mask = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLen) return null;

  let payload = buffer.slice(offset, offset + payloadLen);
  if (masked) {
    payload = Buffer.from(payload); // copy so we don't mutate the original
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4];
    }
  }

  return { opcode, payload, totalLength: offset + payloadLen };
}

server.listen(Number(process.env.PORT || 3000), "0.0.0.0");