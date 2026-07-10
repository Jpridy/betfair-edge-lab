# Deploy Proxy to Fly.io (Sydney Region)

Railway doesn't have an Australian region, and Betfair's AU API geo-blocks
non-Australian IPs. Fly.io has a Sydney region (`syd`) that will pass the
geo-block.

## Steps

### 1. Install Fly CLI
```bash
# macOS
brew install flyctl

# Linux/WSL
curl -L https://fly.io/install.sh | sh
```

### 2. Sign in & launch
```bash
cd src/railway-proxy
flyctl auth signup          # or: flyctl auth login
flyctl deploy               # creates app + deploys in one step
```

When prompted:
- **App name**: `betfair-edge-proxy` (or any unique name)
- **Region**: select `syd` (Sydney) — this is critical
- **Confirm**: yes

### 3. Verify the deployment
```bash
flyctl status
```

The proxy URL will be:
```
https://betfair-edge-proxy.fly.dev/
```

Test it:
```bash
curl https://betfair-edge-proxy.fly.dev/health
```
Should return:
```json
{"status":"ok","service":"betfair-rest-proxy","version":"5-minimal-headers"}
```

### 4. Update the BETFAIR_PROXY_URL secret
In Base44 dashboard → Settings → Environment Variables:

```
BETFAIR_PROXY_URL = https://betfair-edge-proxy.fly.dev/
```

### 5. Test the Betfair connection
In the app, go to Settings → Betfair Connection → Run Endpoint Diagnostic.
The AU endpoint should now return valid JSON instead of the geo-block HTML.

## Why Fly.io?

| Platform  | AU Region? | Free Tier? |
|-----------|-----------|------------|
| Railway   | ❌ No      | Trial only |
| Fly.io    | ✅ Sydney  | ✅ Yes     |
| Render    | ❌ No      | Limited    |
| Vercel    | Edge only  | ✅ Yes     |

Fly.io's `syd` region runs in AWS ap-southeast-2 (Sydney), which is an
Australian IP range that Betfair allows.

## Notes
- The proxy code (`server.js`) is identical — only the hosting platform changes.
- Fly.io free tier: 3 shared-cpu-1x VMs with 256MB RAM (more than enough).
- Auto-stop/start is enabled to conserve free tier resources.
- The proxy stores no credentials — it only forwards requests to Betfair.