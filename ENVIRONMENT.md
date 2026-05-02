# Dashboard environment variables

Copy these into the Render service → **Environment** tab (values are examples — replace with yours).

| Variable | Example / notes |
|----------|-------------------|
| `MONGODB_URI` | `mongodb+srv://USER:<PASSWORD>@cluster0.xxxxx.mongodb.net/splitpay?retryWrites=true&w=majority&appName=Cluster0` |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://splitpay-dashboard.onrender.com` (your exact Render URL, HTTPS, no trailing slash) |
| `STORE_URL` | `https://splitpay-store.onrender.com` (your store Render URL — used for CORS from the storefront) |
| `ANTHROPIC_API_KEY` | From [Anthropic Console](https://console.anthropic.com/) — optional; AI dispute summaries fail gracefully if unset |

Optional:

| Variable | Notes |
|----------|--------|
| `ANTHROPIC_MODEL` | e.g. `claude-sonnet-4-20250514` |

After changing `NEXTAUTH_URL` or `STORE_URL`, redeploy so `next.config` headers and auth URLs stay aligned.

### Render login / “Server Components” errors

- Set **`NEXTAUTH_URL`** to your exact service URL, e.g. `https://splitpay-dashboard.onrender.com` (no trailing slash, must match the browser).
- Set **`NEXTAUTH_SECRET`** in Render (do not rely on a default).
- Set **`MONGODB_URI`** and allow **Network Access** in MongoDB Atlas (e.g. `0.0.0.0/0` for testing, or Render egress IPs for production).
- If the shell loads but data fails, check **Render → Logs** for `[dashboard layout] DB error`.
