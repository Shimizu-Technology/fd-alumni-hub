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

## Current Stack

The active app is now the Rails API + React/Vite frontend. The original Next.js/Prisma implementation has been moved to `archive/legacy-next-app` and is retained only for historical/migration reference.

```txt
api/                       Rails API plus public/admin JSON endpoints
web/                       React/Vite frontend
archive/legacy-next-app/   Archived Next.js/Prisma app; not deployed or in CI
```

See `docs/RAILS-REACT-MIGRATION.md` for the migration rationale and history. See `docs/RAILS-DATA-MIGRATION-RUNBOOK.md` for the operator-run legacy Next/Prisma → Rails data migration path.

## App Scaffold
- Rails API lives in `api`
- React/Vite frontend lives in `web`
- Run frontend dev app: `npm run dev` after starting Rails on port `3001`
- Build frontend: `npm run build`
- Full verification gate: `./scripts/gate.sh`


## Auth + Data Foundation
- Clerk auth integrated in React/Vite admin routes
- Invite-only Rails allowlist for admin/staff (`AdminWhitelist`, `User`)
- Rails + PostgreSQL configured

### Local Rails + React/Vite setup
```bash
# terminal 1
cd api
cp .env.example .env
bundle install
bin/rails db:create db:migrate
bin/rails server -p 3001

# terminal 2
cp web/.env.example web/.env.local
npm run dev
```

Rails public routes include home, today/game-day, tournaments, schedule, standings, articles, media assets, sponsors, and anonymous prediction voting.
Rails admin routes now cover dashboard, tournaments, teams/rosters, games, game-day notes/polls, standings recompute, articles, media assets, sponsors, ingest review, bulk links, and missing-link/data-health checks.

Deployment/schedule planning docs:
- `docs/projects/fd-rails-vite-deployment-and-2026-schedule-plan.md`
- `docs/projects/fd-2026-launch-polish-notes.md`

The Rails seed path now idempotently imports the 2026 organizer pool-play schedule from `data/schedules/fd-2026-pool-play-2026-06-27.json` unless `FD_SEED_2026_SCHEDULE=0` is set.
