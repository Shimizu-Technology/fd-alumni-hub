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
api/       Rails API foundation plus public/admin JSON endpoints
web/       Side-by-side React/Vite frontend being validated before cutover
```

See `docs/RAILS-REACT-MIGRATION.md` for the migration rationale, phases, go/no-go criteria, and route mapping. See `docs/RAILS-DATA-MIGRATION-RUNBOOK.md` for the operator-run Next/Prisma → Rails data migration path.

## App Scaffold
- Next.js app lives in `apps/web`
- Rails API lives in `api`
- Run current production/fallback dev app: `npm run dev` (from repo root)
- Run Rails-backed React/Vite app: `npm run web:dev` after starting Rails on port `3001`
- Build current app: `npm run build`
- Build React/Vite app: `npm run web:build`
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

### Rails-backed React/Vite validation
```bash
# terminal 1
cd api
cp .env.example .env
bundle install
bin/rails db:create db:migrate
bin/rails server -p 3001

# terminal 2
cp web/.env.example web/.env.local
npm run web:dev
```

Rails public routes include home, tournaments, schedule, standings, articles, media assets, and sponsors.
Rails admin routes now cover dashboard, tournaments, teams, games, standings recompute, articles, media assets, sponsors, ingest review, bulk links, and missing-link/data-health checks.
