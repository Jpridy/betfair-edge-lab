# Betfair REST Proxy for Railway

This replaces the Cloudflare Worker for Betfair REST requests. Cloudflare raw TCP cannot connect to Betfair's Cloudflare-hosted API.

## Deploy

1. Create a new GitHub repository and add `server.js` and `package.json` from this folder at the repository root.
2. In Railway, choose **New Project → Deploy from GitHub repo** and select that repository.
3. Choose an Asia-Pacific deployment region permitted by your Betfair account; use an Australian region if Railway offers one.
4. Open **Settings → Networking → Generate Domain**.
5. Visit `https://YOUR-DOMAIN/health`; it must return `{ "status": "ok", "service": "betfair-rest-proxy" }`.
6. In Base44, replace `BETFAIR_PROXY_URL` with `https://YOUR-DOMAIN/`.
7. Run the Betfair Endpoint Diagnostic again.

No Betfair credentials are stored in Railway. The proxy only permits HTTPS requests to the four required Betfair hosts.