# FD Alumni Basketball Tournament Hub

Central hub concept for Father Duenas Memorial School Alumni Basketball Tournament information, built to route fans toward partner ticketing, streaming, and coverage sources.

## V1 Goal
Single source of truth for:
- Full game schedule
- Standings
- Watch links (Clutch)
- Ticket links (GuamTime)
- News/articles (GSPN + organizer updates)
- Sponsors

## Product Principle
Spreadsheet-simple UX first. Add advanced stats/automation later.

## Docs
- `docs/BRAND-DESIGN-TOKENS.md` — FD-aligned palette, typography, and UX guardrails
- `docs/IA-V1.md` — page map + UX flow
- `docs/DATA-MODEL-V1.md` — core entities for MVP
- `docs/OUTREACH-DRAFTS.md` — collaboration messages for Zay/GSPN/GuamTime

## Current + Migration Stack

The current production/fallback app remains the Next.js app in `apps/web`.

A phased Rails + React migration has started so the hub can become a repeatable tournament platform for 2026, 2027, and beyond:

```txt
apps/web/  Current Next.js app, kept as fallback during migration
api/       Rails API foundation
web/       Future React/Vite frontend
```

See `docs/RAILS-REACT-MIGRATION.md` for the migration rationale, phases, go/no-go criteria, and route mapping.

## App Scaffold
- Next.js app lives in `apps/web`
- Rails API lives in `api`
- Run current dev app: `npm run dev` (from repo root)
- Build current app: `npm run build`
- Full verification gate: `./scripts/gate.sh`


## Auth + Data Foundation
- Clerk auth integrated in Next app
- Invite-only whitelist for admin/staff (`AdminWhitelist`, `AppUser`)
- Prisma + Postgres configured

### Setup
1. Copy `apps/web/.env.example` to either repo-root `.env` or `apps/web/.env.local`
2. Fill Clerk + DB values for full admin/live-data mode. If `DATABASE_URL` is omitted, local dev runs in public archive-preview mode. Restart `npm run dev` after changing env values.
3. Run `npm install`
4. Run `npm --workspace @fd/web exec prisma migrate dev`
5. Seed baseline data: `npm --workspace @fd/web exec prisma db seed`
6. Optional archive import: `npm --workspace @fd/web run import:archive-content`
7. Start app: `npm run dev`

### Bootstrap first admin
`POST /api/admin/bootstrap-whitelist` with header `x-bootstrap-secret` and JSON `{ "email": "you@example.com" }`

## Next Actions (Foundation Complete)
1. Configure `apps/web/.env.local`
2. Run DB migrations: `npm --workspace @fd/web exec prisma migrate dev`
3. Seed sample data: `npm --workspace @fd/web exec prisma db seed`
4. Import researched archive content: `npm --workspace @fd/web run import:archive-content`
5. Bootstrap first admin whitelist:
   - `curl -X POST http://localhost:3000/api/admin/bootstrap-whitelist \
      -H "Content-Type: application/json" \
      -H "x-bootstrap-secret: <BOOTSTRAP_SECRET>" \
      -d '{"email":"you@example.com"}'`
6. Sign in via Clerk and visit `/admin`

### Current Next Foundation APIs
- Public: `/api/public/home`, `/api/public/schedule`, `/api/public/standings`
- Admin: `/api/admin/tournaments`, `/api/admin/games`, `/api/admin/standings`, `/api/admin/articles`, `/api/admin/sponsors`

### Rails API Foundation
```bash
cd api
cp .env.example .env
bundle install
bin/rails db:create db:migrate
bin/rails server -p 3001
```

Early Rails public routes:
- `GET /api/v1/public/home`
- `GET /api/v1/public/schedule`
- `GET /api/v1/public/standings`
- `GET /api/v1/public/articles`
- `GET /api/v1/public/media-assets`
- `GET /api/v1/public/sponsors`
