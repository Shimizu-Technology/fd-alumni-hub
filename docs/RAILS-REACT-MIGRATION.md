# Rails + React Migration Plan

## Why we are migrating

The FD Alumni Basketball Tournament Hub started as a fast Next.js proof of concept. It is now likely to be used by multiple host classes:

- **2026**: Class of 2016 is hosting and has shown interest in collaborating.
- **2027**: Class of 2017 is Leon's class and is likely to use the hub.
- **2028**: Class of 2018 has early interest.

That changes the product from a one-year website into a repeatable tournament operations platform. The long-term needs are a better fit for the standard Shimizu Technology stack: **Rails API + React/Vite frontend + PostgreSQL/Neon**.

## Product direction

The hub should remain a central tournament guide, not a replacement for partners. It should route alumni/fans to the right partner destination while keeping the tournament context in one place:

- schedule and results
- standings
- tickets / GuamTime links
- Clutch streams and media
- GSPN/news coverage
- sponsors
- tournament history/archive
- future stats and year-to-year host-class operations

Use partner-friendly language such as **central hub** unless FDMSAA/organizers approve stronger wording.

## Target architecture

```txt
fd-alumni-hub/
  api/                       Rails API backend
  web/                       React/Vite frontend
  archive/legacy-next-app/   Archived original Next.js/Prisma app
```

Deployment target:

```txt
web  -> Netlify
api  -> Render
db   -> Neon PostgreSQL
```

## Migration rule

This started as a phased migration, not a big-bang rewrite. As of the Rails/Vite staging deployment work, the original Next.js app has been archived and removed from the active workspace/CI/deploy path.

## Phases

### Phase 0: Preserve then archive the working Next app

Status: **complete**

- Preserved the Next.js app during Rails/Vite build-out.
- Archived it under `archive/legacy-next-app` once the Rails/Vite app became the active deployment path.
- Removed it from the active npm workspace, CI gate, and Netlify config.

### Phase 1: Rails API foundation

Status: **complete; merged in PR #31**

Scope:

- Rails API app in `/api`.
- PostgreSQL-backed tournament domain models:
  - tournaments
  - teams
  - games
  - standings
  - article links
  - media assets
  - sponsors
  - content ingest items
  - admin allowlist
  - users
- Guam-first time zone configuration with UTC database storage.
- Public JSON endpoints for home, schedule, standings, news/articles, gallery/media, sponsors, and tournaments.
- Clerk-compatible admin auth foundation with allowlisted emails.
- Basic admin endpoints for tournaments, teams, games, and standings recompute.
- Idempotent local seed helpers only; real production data import remains manual.

### Phase 2: React/Vite public frontend

Status: **active frontend**

- Created `/web` React/Vite app.
- Ported public pages from the current Next app:
  - Home
  - Schedule
  - Standings
  - Watch
  - News
  - Gallery
  - History
  - Sponsors
- Reused the FD maroon/gold design direction and Shimizu frontend standards.
- Fetches from `/api/v1/public/*` endpoints.

### Phase 3: Admin workflows

Status: **active frontend/admin path; staging validation in progress**

- Admin dashboard.
- Teams/divisions editor.
- Schedule/game editor.
- Score entry and standings recompute.
- Sponsor, article, media, and link management.
- Missing links / data-health view.
- Ingest review flow for article/media candidates.

### Phase 4: Data migration and staging validation

Status: **in progress**

- Export archived Next/Prisma data when needed using the legacy scripts retained under `archive/legacy-next-app`.
- Import into Rails with `bin/rails fd:migration:import_next_snapshot[...]`.
- Validate counts and critical records with `bin/rails fd:migration:validate_next_snapshot[...]`:
  - tournaments
  - teams
  - games
  - standings
  - article links
  - media assets
  - sponsors
  - ingest items
  - admin whitelist/users
- Preserve Prisma CUID relationships with Rails `legacy_id` columns.
- Validate Guam date rendering and score coverage.
- Run organizer walkthrough on staging.

See `docs/RAILS-DATA-MIGRATION-RUNBOOK.md` for commands and safety notes.

### Phase 5: Cutover

Status: **deployment in progress**

- Rails API deploys to Render.
- React/Vite deploys to Netlify from `web/`.
- Frontend env points to the Rails API.
- Smoke test public pages and admin updates before wide sharing.

## Verification gate

Use one command before opening or updating migration PRs:

```bash
./scripts/gate.sh
```

Current gate coverage:

- React/Vite app TypeScript build
- Rails API RuboCop
- Rails API tests

## Go/no-go criteria for 2026

Cut over only if all are true:

- Public pages match or beat the current Next app.
- 2016 hosts can update schedule/results without developer help.
- Standings recompute is verified against known scores.
- Ticket/stream/news/sponsor links are easy to update.
- Mobile UX is production-ready.
- Guam timezone behavior is correct.
- Staging has been reviewed by organizers.

If those are not true, pause wider sharing until Rails/Vite staging issues are fixed.

## Data safety

- The archived Next/Prisma code and old database should remain read-only migration references.
- Rails migrations apply only to the new Rails database target.
- Data imports must remain explicit operator-run tasks.
- Do not automatically run archive imports or score imports during deploy.

## API route mapping

Current Next backend routes map to Rails like this:

| Current Next/Prisma area | Rails API target |
| --- | --- |
| `/api/public/home` | `GET /api/v1/public/home` |
| `/api/public/schedule` | `GET /api/v1/public/schedule` |
| `/api/public/standings` | `GET /api/v1/public/standings` |
| news/article queries | `GET /api/v1/public/articles` |
| gallery/media queries | `GET /api/v1/public/media-assets` |
| sponsor queries | `GET /api/v1/public/sponsors` |
| `standings-recompute.ts` | `Standings::Recompute` service |
| admin game update routes | `/api/v1/admin/games` |
| admin tournament routes | `/api/v1/admin/tournaments` |
| admin team/division routes | `/api/v1/admin/teams` |
| admin news/articles | `/api/v1/admin/articles` |
| admin media/gallery | `/api/v1/admin/media-assets` |
| admin sponsors | `/api/v1/admin/sponsors` |
| admin ingest review | `/api/v1/admin/content-ingest-items` |
| admin bulk ticket/stream links | `/api/v1/admin/links/bulk` |
| admin missing links/data health | `/api/v1/admin/missing-links` |
| Clerk/admin allowlist logic | `User`, `AdminWhitelist`, `ClerkAuthenticatable` |

## Non-goals for the first migration branch

- No production cutover.
- No advanced player stats.
- No live scorekeeping UI.
- No SMS/email flows.
- No sponsor CRM beyond basic sponsor records.
- No automatic production data imports.

## Post-migration follow-ups

- Add Rails/Vite S3 direct uploads for admin media assets and sponsor logos, matching the current Next.js presigned upload flow and the Shimizu starter-app AWS S3 guide. See `docs/S3-UPLOAD-SETUP.md`.
