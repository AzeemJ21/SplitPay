# SplitPay Dashboard

Web application for **SplitPay** users: projects, escrow milestones, virtual card, wallet, transactions, notifications, and complaints. It also exposes **HTTP APIs** used by the **SplitPay Store** for split checkout (verify split code + charge two cards).

**Live storefront (Render):** [https://splitpay-store.onrender.com](https://splitpay-store.onrender.com) — set dashboard `STORE_URL` to this origin (no trailing slash) so CORS allows store → dashboard API calls.

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local — set MONGODB_URI, NEXTAUTH_SECRET, NEXTAUTH_URL, STORE_URL (see ENVIRONMENT.md)

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Documentation

- **[HELPER.md](./HELPER.md)** — Full system guide: features, stack, folder layout, Mongoose models, API list, auth, and production notes.
- **[ENVIRONMENT.md](./ENVIRONMENT.md)** — Environment variables and Render tips.
- **[DEPLOY.md](./DEPLOY.md)** — Deployment on Render.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run seed` | Seed database (requires MongoDB) |
| `npm run lint` | ESLint |

## Tech stack (short)

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · MongoDB / Mongoose · NextAuth (JWT) · Zod

## License

Private project — see repository owner for terms of use.
