# FD Alumni Hub V1 — Handoff Notes

## Branch
- `feature/v1-schedule-ui`

## Completed scope
- Public pages:
  - Home (`/`)
  - Schedule (`/schedule`)
  - Standings (`/standings`)
  - Watch (`/watch`)
  - News (`/news`)
  - Sponsors (`/sponsors`)
- Admin pages:
  - Overview (`/admin`)
  - Games (`/admin/games`)
  - Standings (`/admin/standings`)
  - News (`/admin/news`)
  - Sponsors (`/admin/sponsors`)
- Auth/data:
  - Clerk + whitelist model
  - Prisma/Postgres schema
  - historical data seed + importer tools
- Ops tooling:
  - CLI importer (`tools/import/fd_historical_games_import.mjs`)
  - Admin in-app CSV importer (`/api/admin/import/historical-games`)
  - Data health card on admin overview

## Build status
- `npm run build` passing on latest commit

## Required local setup
1. Configure `apps/web/.env.local`
2. Run migrations and generate client
3. Seed data (`npx prisma db seed`)
4. Bootstrap whitelist admin

## Recommended UAT order
1. Admin auth gate + whitelist
2. Import historical CSV
3. Games create/edit/archive
4. Recompute standings and verify public standings page
5. News/sponsor create and verify public pages
6. Mobile pass on schedule/watch pages

## Known deferred items (intentional)
- Full historical standings archive import (needs complete official source sheet)
- Rich sponsor logos/cards and content CMS-level controls
- Bracket visualization
- Push notifications/live ticker
