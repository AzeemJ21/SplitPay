# Deploy SplitPay dashboard on Render

Separate repo/service from the **splitpay-store** storefront. Deploy the dashboard first so you have a stable URL for `NEXTAUTH_URL`, `STORE_URL` (CORS), and for the store’s `SPLITPAY_API_URL`.

## Prerequisites

- Git repository pushed to GitHub/GitLab/Bitbucket (Render connects to it).
- MongoDB Atlas (or other) connection string.
- For production, a strong `NEXTAUTH_SECRET` (`openssl rand -base64 32`).

## Option A: Blueprint (`render.yaml`)

1. In Render: **New** → **Blueprint** → connect the repo, select the branch.
2. Render will create a **Web Service** from `render.yaml` (`splitpay-dashboard`).
3. In the service **Environment** tab, set the variables from `ENVIRONMENT.md` (mark secrets in the UI; do not commit real values).
4. **Manual deploy** or push to the connected branch to trigger a build.

## Option B: Manual Web Service

1. **New** → **Web Service** → connect repo, root directory = this project (dashboard).
2. **Build command:** `npm install && npm run build`
3. **Start command:** `npm start`
4. **Instance type:** pick a free or paid Node plan.
5. Add environment variables (see `ENVIRONMENT.md`).

## First-time URL setup

1. After the first deploy, copy the service URL, e.g. `https://splitpay-6kcl.onrender.com`.
2. Set `NEXTAUTH_URL` to that URL (exact `https` host, no path).
3. Set `STORE_URL` to the live store origin **`https://splitpay-store.onrender.com`** (CORS for `/api/users/verify-code` and `/api/split-payment`).
4. On the **store** service (`splitpay-store` on Render), set `SPLITPAY_API_URL` to the dashboard base URL (same as `NEXTAUTH_URL`).
5. In MongoDB Atlas, allow **Network Access** from `0.0.0.0/0` (or Render’s egress IPs if you lock it down).
6. Redeploy the dashboard after env changes.

## Health check

- Open the site root; you should get the app or marketing page.
- Log in and hit a protected dashboard route to confirm `NEXTAUTH_URL` and the database.

## Troubleshooting

- **Auth redirect loops:** `NEXTAUTH_URL` must match the public URL exactly.
- **CORS from store:** `STORE_URL` must match the store origin (scheme + host, no trailing slash).
- **Build OOM / timeout:** upgrade the build plan or reduce `next build` memory; ensure `NODE_ENV=production` on Render.
