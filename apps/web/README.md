# FD Alumni Hub Web App

Next.js app for the FD Alumni Basketball Tournament Hub.

## Local setup

```bash
cp apps/web/.env.example apps/web/.env.local
npm install
npm --workspace @fd/web exec prisma migrate dev
npm --workspace @fd/web exec prisma db seed
npm --workspace @fd/web run import:archive-content # optional researched archive import
npm run dev
```

Required production/admin environment values live in `apps/web/.env.example`. Without `DATABASE_URL`, local dev falls back to a public archive-preview mode instead of crashing; live schedule/admin data still requires the database.

## Build

```bash
npm --workspace @fd/web run build
```

The build script runs `prisma generate` before `next build` so fresh checkouts and Netlify builds have a generated Prisma client.
