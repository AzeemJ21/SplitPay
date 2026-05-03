# SplitPay Dashboard — System Helper & Architecture

This document describes what the SplitPay dashboard application does, how it is structured, the technology stack, data models, APIs, and where to change behavior.

---

## 1. What this system is

**SplitPay** (this repository) is a **Next.js 14 web application** that serves as:

1. **User dashboard** — Freelancers and clients manage projects, escrow milestones, virtual card balance, transactions, wallet, notifications, settings, and complaints (disputes).
2. **Backend API for a separate storefront** — The **SplitPay Store** (another deployment/repo) calls this app over HTTPS to:
   - Verify a customer’s **4-digit Split Code** (`GET /api/users/verify-code`).
   - Run **split payments** across two cards (`POST /api/split-payment`) using the merchant’s **API key** (`Authorization: Bearer …`).

The dashboard and store must share the **same MongoDB** (`MONGODB_URI`) for payments to appear in the correct user’s history.

---

## 2. Technology stack

| Layer | Technology |
|--------|------------|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router) |
| **Language** | TypeScript 5 |
| **UI** | React 18, Tailwind CSS 3, `tailwind-merge`, `clsx` |
| **Components / UX** | Lucide icons, Framer Motion, Recharts (where used), `@dnd-kit` (drag/drop where used) |
| **Auth** | [NextAuth.js v4](https://next-auth.js.org/) — Credentials provider, **JWT** sessions |
| **Database** | [MongoDB](https://www.mongodb.com/) via [Mongoose 9](https://mongoosejs.com/) |
| **Validation** | [Zod](https://zod.dev/) on API inputs |
| **Passwords** | `bcryptjs` |
| **Theming** | `next-themes` (light/dark) |
| **AI (optional)** | Anthropic Messages API for dispute summaries (`ANTHROPIC_API_KEY`) |
| **Payments (demo)** | `src/lib/payment-gateway.ts` — simulated card charges (no real PSP) |

**Build / runtime**

- `npm run dev` — local dev server (default port 3000).
- `npm run build` / `npm start` — production (e.g. Render).
- `npm run seed` — seeds sample data via `src/scripts/seed.ts` (requires DB + env).

---

## 3. High-level architecture

```
Browser / Store
       │
       ▼
┌──────────────────────────────────────┐
│  Next.js App Router (src/app)        │
│  • React Server Components (RSC)      │
│  • Client components ("use client")   │
│  • Route Handlers: src/app/api/**   │
└──────────────┬───────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
  NextAuth (JWT)   Mongoose → MongoDB
  lib/auth.ts      src/models/*
```

- **App Router**: Pages live under `src/app/`. Layouts nest: root `layout.tsx`, route groups `(marketing)`, `(auth)`, `(dashboard)`.
- **API routes**: `src/app/api/<segment>/route.ts` export `GET`, `POST`, etc. These run on the server only.
- **Session**: `getServerSession(authOptions)` in API routes; `useSession()` in client components via `AuthSessionProvider`.

---

## 4. Repository layout (main folders)

| Path | Role |
|------|------|
| `src/app/(marketing)/` | Public marketing pages (`/`, `/docs`, `/terms`). |
| `src/app/(auth)/` | Login and register. |
| `src/app/(dashboard)/` | Authenticated shell: sidebar, topbar, all `/dashboard/*` pages. |
| `src/app/api/` | REST-style JSON APIs (split payment, projects, milestones, disputes, etc.). |
| `src/components/` | Reusable UI: dashboard shell, modals, chat, complaints, shadcn-style primitives. |
| `src/models/` | Mongoose schemas (domain “classes” / documents). |
| `src/lib/` | Auth, DB connection, API keys, payment simulation, utilities. |
| `src/hooks/` | Client hooks (`useChat`, `useVoiceRecorder`, …). |
| `src/types/` | TypeScript augmentations (e.g. `next-auth.d.ts`). |
| `src/scripts/` | `seed.ts` and other one-off scripts. |
| `next.config.mjs` | Images, redirects, **CORS headers** for store → `verify-code` / `split-payment`. |
| `render.yaml` | Optional Render blueprint. |
| `ENVIRONMENT.md` / `DEPLOY.md` | Env vars and deployment notes. |

---

## 5. Data model (Mongoose “classes”)

All models live under `src/models/`. They map to **MongoDB collections** (pluralized names by Mongoose convention unless overridden).

### `User` (`User.ts`)

- Core identity: `name`, `email`, `passwordHash`, unique **4-digit** `splitCode`.
- **Merchant API**: `apiKey` (sparse unique), `apiCallsThisMonth`, `apiUsageLimit`, `apiUsageBillingMonth`.
- `virtualCardBalance` (legacy/auxiliary; virtual card balance is primarily on `VirtualCard`).
- `notificationPrefs`, optional `avatarUrl`, `roles`, `splitCodeChangedAt`.

### `Project` (`Project.ts`)

- Links **client** and **freelancer** (`clientId`, `freelancerId` → `User`).
- `title`, `description`, `budget`, `deadline`, `status` (`pending` | `active` | `completed`).

### `Milestone` (`Milestone.ts`)

- Belongs to a `projectId`; escrow workflow (`funded`, `in_progress`, `submitted`, `approved`, `released`, etc.).
- Holds `escrowAmount` and related milestone fields (see schema in file).

### `Transaction` (`Transaction.ts`)

- `userId` (ObjectId → User), `splitCode`, `amount`, `card1Amount`, `card2Amount`.
- `type`: e.g. `split_payment`, `escrow_funding`, `escrow_release`, `merchant_payout`, `charge_reversal` (card rollback when the paired card fails), `refund`, `failed_payment`, `withdrawal`.
- `status`: `pending` | `completed` | `failed`; optional `merchantId`, `note`, `transactionRef` (withdrawal link).

### `VirtualCard` (`VirtualCard.ts`)

- One card per user: `userId`, `balance`, `cardNumber`, expiry, `currency`.

### `Withdrawal` (`Withdrawal.ts`)

- User payout requests: PayPal / Stripe / bank (prototype); `status`, `transactionRef`, timestamps.

### `Dispute` (`Dispute.ts`)

- Complaints tied to `projectId`, `raisedBy`, `title`, `description`, `type` (complaint category).
- `evidence`, `screenshots`, `attachments`; `status` (`open` | `under_review` | `resolved`).
- `aiSummary`, `resolution` — AI analysis optional after **48-hour** policy (see `src/lib/constants.ts` + summarize route).

### `Notification` (`Notification.ts`)

- In-app alerts: `userId`, `type`, `title`, `message`, `read`, `relatedId`.

### `Message` (`Message.ts`)

- Project chat messages: `projectId`, `senderId`, `content`, timestamps.

**Barrel export**: `src/models/index.ts` re-exports models for convenience.

---

## 6. Authentication & authorization

| Piece | Location | Notes |
|--------|-----------|--------|
| NextAuth config | `src/lib/auth.ts` | Credentials provider; bcrypt verify; JWT stores `id`, `splitCode`, `roles`. |
| API route | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handler. |
| Session typing | `src/types/next-auth.d.ts` | Extends `Session` / `JWT` with `splitCode`, etc. |
| API protection | `getServerSession(authOptions)` | Used in most `/api/*` routes. |
| Merchant key | `src/lib/api-key.ts` | `split-payment` accepts `Bearer` API key for store server-to-server calls. |

---

## 7. Important `src/lib` modules

| Module | Purpose |
|--------|---------|
| `mongoose.ts` | `connectDB()` — lazy Mongo connection using `MONGODB_URI`. |
| `auth.ts` | NextAuth `authOptions`. |
| `api-auth.ts` | Helpers for authenticated API behavior (if used by routes). |
| `api-key.ts` | Generate/mask API keys; increment monthly usage. |
| `api-cache-headers.ts` | `Cache-Control` constants (list vs private no-store). |
| `payment-gateway.ts` | **Simulated** card charge / payout (`processCardCharge`). |
| `virtual-card-utils.ts` | Create/fetch virtual card; mask PAN. |
| `milestone-escrow.ts` | Escrow business rules for milestones. |
| `parse-ai-summary.ts` | Parse dispute AI text into sections / risk score for UI. |
| `utils.ts` | `cn()` etc. (Tailwind class merging). |
| `fonts.ts` | Next/font (DM Sans, Syne). |
| `constants.ts` | e.g. `AI_AGENT_RESPONSE_DELAY_MS` (48h). |

---

## 8. API surface (grouped)

**Store / public (CORS-controlled)**

- `GET /api/users/verify-code?code=####` — Validate split code; returns `{ valid, name?, userId? }`.
- `POST /api/split-payment` — Split checkout body + optional `Authorization: Bearer <apiKey>`.
- `GET /api/integration` — JSON discovery of base URLs and endpoints (for wiring the store).
- `OPTIONS` on the above where implemented — CORS preflight.

**Auth & user**

- `POST /api/auth/register` — Register user.
- `GET/POST /api/auth/api-key` — View/regenerate merchant API key (session).

**Dashboard data**

- `GET /api/dashboard-stats` — Aggregated home stats (wallet, split-pay volume, escrow, projects).
- `GET /api/projects`, `POST /api/projects`, `GET/PATCH /api/projects/[id]`
- `GET /api/milestones`, milestone actions: `fund`, `submit`, `approve`, `in-progress`, etc.
- `GET /api/transactions` — Query params: `page`, `limit`, `status`, `type`, **`types`** (comma-separated), `q`, `export`.
- `GET /api/transactions/summary` — Volume / counts.
- `GET /api/virtual-card` — Card metadata + balance + aggregates.
- `GET/POST /api/withdrawals` — Simulated withdrawals (PayPal / Stripe / bank).
- `GET /api/escrow-summary` — Escrow totals for user’s projects.
- `GET/POST /api/disputes`, `GET /api/disputes/[id]`, `POST /api/disputes/[id]/summarize`, evidence uploads.
- `GET /api/notifications`, read routes.
- `GET/PATCH /api/users/me`, password, split-code, notification prefs.
- `GET /api/users/search` — User search for projects.
- `GET /api/projects/[id]/messages`, `POST` upload, chat-related APIs.
- `GET /api/cron/auto-release` — Cron-style milestone automation (protect with secret in production).

**Disputes / AI**

- Summaries use Anthropic when `ANTHROPIC_API_KEY` is set; otherwise an **offline template** after the 48-hour window.

---

## 9. Frontend structure (dashboard)

| Area | Path pattern | Notes |
|------|----------------|--------|
| Layout | `(dashboard)/layout.tsx` | Server layout: session, DB-backed sidebar data (with fallbacks), wraps `DashboardLayoutClient`. |
| Home | `dashboard/page.tsx` | Stats + recent transactions + projects (client fetch). |
| Wallet | `dashboard/wallet/page.tsx` | Funded activity + payout (WithdrawModal). |
| Virtual card | `dashboard/virtual-card/page.tsx` | Balance, tx preview, withdrawals. |
| Transactions | `dashboard/transactions/page.tsx` | Full list, filters, CSV export. |
| Projects / milestones | `dashboard/projects/*`, `dashboard/milestones/*` | Escrow UX. |
| Complaints | `dashboard/complaints`, `dashboard/disputes/[id]` | Disputes + AI panel. |
| API docs UI | `dashboard/api/page.tsx` | Integration examples (uses `window.location.origin`). |
| Components | `components/dashboard/*`, `components/modals/*`, `components/complaints/*` | Sidebar, topbar, modals, chat. |

---

## 10. Environment variables (summary)

See **`.env.example`** and **`ENVIRONMENT.md`** for the full list. Critical ones:

| Variable | Role |
|----------|------|
| `MONGODB_URI` | MongoDB connection string. |
| `NEXTAUTH_SECRET` | Sign JWT cookies. |
| `NEXTAUTH_URL` | Public base URL of **this** app (must match browser origin in production). |
| `STORE_URL` | Live store: **`https://splitpay-store.onrender.com`** — CORS on store-facing APIs (no trailing slash). |
| `ANTHROPIC_API_KEY` | Optional; full Claude dispute analysis. |

---

## 11. Security & production notes

- Never commit **`.env.local`** or real secrets (use `.gitignore`).
- **Store CORS** is tied to `STORE_URL` in `next.config.mjs` and route handlers — wrong origin = browser blocks the store.
- Split-payment and auth routes should stay **HTTPS** in production.
- `payment-gateway.ts` is **not** a real payment processor; replace with Stripe/PayPal/etc. for live money movement.

---

## 12. Related docs in this repo

- **`ENVIRONMENT.md`** — Env table + Render troubleshooting.
- **`DEPLOY.md`** — Render / blueprint steps.
- **`README.md`** — Quick start and link to this helper.

---

*Last updated to reflect the SplitPay dashboard codebase structure (App Router, Mongoose models, NextAuth, store APIs, wallet, and dispute AI flow).*
