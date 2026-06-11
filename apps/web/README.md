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

Required environment values live in `apps/web/.env.example`.

## Build

```bash
npm --workspace @fd/web run build
```

The build script runs `prisma generate` before `next build` so fresh checkouts and Netlify builds have a generated Prisma client.
