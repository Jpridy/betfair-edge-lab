import tls from "node:tls";
import { Buffer } from "node:buffer";

function decodeChunked(buffer) {
  const parts = [];
  let offset = 0;
  while (offset < buffer.length) {
    const lineEnd = buffer.indexOf("\r\n", offset);
    if (lineEnd < 0) break;
    const size = Number.parseInt(buffer.subarray(offset, lineEnd).toString().split(";", 1)[0], 16);
    if (!Number.isFinite(size) || size === 0) break;
    const start = lineEnd + 2;
    parts.push(buffer.subarray(start, start + size));
    offset = start + size + 2;
  }
  return Buffer.concat(parts);
}

export function rawHttpsRequest(target, method, headers, body) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const socket = tls.connect({
      host: target.hostname,
      port: 443,
      servername: target.hostname,
      ALPNProtocols: ["http/1.1"],
      minVersion: "TLSv1.2",
      ecdhCurve: "X25519:P-256:P-384",
      sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pss_rsae_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha256:rsa_pkcs1_sha384",
    });
    socket.setTimeout(20000, () => socket.destroy(new Error("Betfair request timed out")));
    socket.on("secureConnect", () => {
      const payload = body || Buffer.alloc(0);
      const requestHeaders = { host: target.host, connection: "close", ...headers, "content-length": payload.length };
      const headerLines = Object.entries(requestHeaders).map(([key, value]) => `${key}: ${value}`).join("\r\n");
      socket.write(`${method} ${target.pathname}${target.search} HTTP/1.1\r\n${headerLines}\r\n\r\n`);
      if (payload.length) socket.write(payload);
    });
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("error", reject);
    socket.on("end", () => {
      const raw = Buffer.concat(chunks);
      const headerEnd = raw.indexOf("\r\n\r\n");
      if (headerEnd < 0) return reject(new Error("Invalid HTTP response from Betfair"));
      const headerText = raw.subarray(0, headerEnd).toString();
      const lines = headerText.split("\r\n");
      const status = Number(lines[0].split(" ")[1]);
      const responseHeaders = Object.fromEntries(lines.slice(1).map((line) => {
        const separator = line.indexOf(":");
        return [line.slice(0, separator).toLowerCase(), line.slice(separator + 1).trim()];
      }));
      const encodedBody = raw.subarray(headerEnd + 4);
      const responseBody = responseHeaders["transfer-encoding"]?.includes("chunked") ? decodeChunked(encodedBody) : encodedBody;
      resolve({ status, headers: responseHeaders, body: responseBody });
    });
  });
}