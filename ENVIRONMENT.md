# Dashboard environment variables

Copy these into the Render service → **Environment** tab (values are examples — replace with yours).

| Variable | Example / notes |
|----------|-------------------|
| `MONGODB_URI` | `mongodb+srv://USER:<PASSWORD>@cluster0.xxxxx.mongodb.net/splitpay?retryWrites=true&w=majority&appName=Cluster0` |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | e.g. `https://splitpay-6kcl.onrender.com` (your exact Render dashboard URL, HTTPS, no trailing slash) |
| `STORE_URL` | **Live store:** `https://splitpay-store.onrender.com` (no trailing slash) — must match the browser origin on checkout; used for CORS on `/api/users/verify-code`, `/api/split-payment`, and `/api/demo/store-purchase` |
| `DEMO_STORE_SECRET` | Shared with the **store** `DEMO_STORE_SECRET` — enables `POST /api/demo/store-purchase` so simulated storefront checkouts create a **transaction + notification** on the customer dashboard (no merchant API key required) |
| `ANTHROPIC_API_KEY` | From [Anthropic Console](https://console.anthropic.com/) — optional; AI dispute summaries fail gracefully if unset |

### Connect the SplitPay Store to this dashboard

1. **Dashboard (this service)** on Render:
   - `NEXTAUTH_URL` = `https://splitpay-6kcl.onrender.com` (or your current dashboard URL).
   - `STORE_URL` = **`https://splitpay-store.onrender.com`** (live SplitPay Store on Render; scheme + host only, no trailing slash).
2. **Storefront (splitpay-store or your Next.js store)**:
   - Set `SPLITPAY_API_URL` to the same dashboard base URL, e.g. `https://splitpay-6kcl.onrender.com`.
   - For **demo** checkout → dashboard activity: set **`DEMO_STORE_SECRET`** to the **same value** on both dashboard and store. The store calls `POST ${SPLITPAY_API_URL}/api/demo/store-purchase` with header `X-Demo-Store-Secret` after a simulated SplitPay checkout.
   - Optional later: `POST /api/split-payment` with a merchant API key for the full simulated payment flow.
3. **Smoke test:** Open `https://splitpay-6kcl.onrender.com/api/integration` — JSON lists `baseUrl` and paths. Redeploy the dashboard after changing `NEXTAUTH_URL` or `STORE_URL` so `next.config` CORS headers rebuild.

Optional:

| Variable | Notes |
|----------|--------|
| `ANTHROPIC_MODEL` | e.g. `claude-sonnet-4-20250514` |

After changing `NEXTAUTH_URL` or `STORE_URL`, redeploy so `next.config` headers and auth URLs stay aligned.

### Render login / “Server Components” errors

- Set **`NEXTAUTH_URL`** to your exact service URL, e.g. `https://splitpay-6kcl.onrender.com` (no trailing slash, must match the browser).
- Set **`NEXTAUTH_SECRET`** in Render (do not rely on a default).
- Set **`MONGODB_URI`** and allow **Network Access** in MongoDB Atlas (e.g. `0.0.0.0/0` for testing, or Render egress IPs for production).
- If the shell loads but data fails, check **Render → Logs** for `[dashboard layout] DB error`.
