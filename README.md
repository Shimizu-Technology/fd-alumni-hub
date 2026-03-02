# FD Alumni Basketball Tournament Hub

Official-style hub concept for Father Duenas Memorial School Alumni Basketball Tournament.

## V1 Goal
Single source of truth for:
- Full game schedule
- Standings
- Watch links (Clutch)
- Ticket links (GuamTime)
- News/articles (GSPN + official updates)
- Sponsors

## Product Principle
Spreadsheet-simple UX first. Add advanced stats/automation later.

## Docs
- `docs/BRAND-DESIGN-TOKENS.md` — FD-aligned palette, typography, and UX guardrails
- `docs/IA-V1.md` — page map + UX flow
- `docs/DATA-MODEL-V1.md` — core entities for MVP
- `docs/OUTREACH-DRAFTS.md` — collaboration messages for Zay/GSPN/GuamTime

## Suggested Stack (MVP)
- Next.js + TypeScript
- Postgres (or Supabase) for schedule/standings content
- Admin auth for score/schedule updates



## App Scaffold
- Next.js app lives in `apps/web`
- Run dev: `npm run dev` (from repo root)
- Build: `npm run build`


## Auth + Data Foundation
- Clerk auth integrated in Next app
- Invite-only whitelist for admin/staff (`AdminWhitelist`, `AppUser`)
- Prisma + Postgres configured

### Setup
1. Copy `apps/web/.env.example` to `apps/web/.env.local`
2. Fill Clerk + DB values
3. Run `cd apps/web && npx prisma migrate dev --name init_auth`
4. Start app: `npm run dev`

### Bootstrap first admin
`POST /api/admin/bootstrap-whitelist` with header `x-bootstrap-secret` and JSON `{ "email": "you@example.com" }`

## Next Actions (Foundation Complete)
1. Configure `apps/web/.env.local`
2. Run DB migration: `cd apps/web && npx prisma migrate dev --name init_foundation`
3. Seed sample data: `cd apps/web && npx prisma db seed`
4. Bootstrap first admin whitelist:
   - `curl -X POST http://localhost:3000/api/admin/bootstrap-whitelist \
      -H "Content-Type: application/json" \
      -H "x-bootstrap-secret: <BOOTSTRAP_SECRET>" \
      -d '{"email":"you@example.com"}'`
5. Sign in via Clerk and visit `/admin`

### Foundation APIs
- Public: `/api/public/home`, `/api/public/schedule`, `/api/public/standings`
- Admin: `/api/admin/tournaments`, `/api/admin/games`, `/api/admin/standings`, `/api/admin/articles`, `/api/admin/sponsors`
