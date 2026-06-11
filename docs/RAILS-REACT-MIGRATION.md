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
  apps/web/  Current Next.js app, retained as 2026 fallback during migration
  api/       New Rails API backend
  web/       Future React/Vite frontend
```

Deployment target after cutover:

```txt
web  -> Netlify
api  -> Render or Rails deploy target
db   -> Neon PostgreSQL
```

## Migration rule

This is a phased migration, not a big-bang rewrite.

> Keep the current Next.js app live until the Rails + React version reaches public and admin parity.

The current production app remains the fallback for 2026 until we intentionally cut over.

## Phases

### Phase 0: Preserve the working Next app

Status: **complete; merged in PR #31**

- Keep `apps/web` and Netlify production behavior unchanged.
- Document the migration plan and go/no-go criteria.
- Add the Rails API in parallel, without changing the current public deployment.
- Do not run production migrations/imports automatically.

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

Status: **implemented side-by-side on `rails-migration/phase-2-web-parity`; not cut over**

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

Status: **implemented side-by-side on `rails-migration/phase-2-web-parity`; needs staging validation**

- Admin dashboard.
- Teams/divisions editor.
- Schedule/game editor.
- Score entry and standings recompute.
- Sponsor, article, media, and link management.
- Missing links / data-health view.
- Ingest review flow for article/media candidates.

### Phase 4: Data migration and staging validation

Planned:

- Export current Next/Prisma data.
- Import into a Rails-owned Neon branch/new DB.
- Validate counts and critical pages:
  - tournaments
  - teams
  - games
  - standings
  - article links
  - media assets
  - sponsors
- Validate Guam date rendering and score coverage.
- Run organizer walkthrough on staging.

### Phase 5: Cutover

Planned only after parity:

- Final data export/import.
- Point production frontend to React/Vite build.
- Point frontend env to Rails API.
- Smoke test public pages and admin updates.
- Keep old Next app available as rollback/fallback until after the tournament.

## Verification gate

Use one command before opening or updating migration PRs:

```bash
./scripts/gate.sh
```

Current gate coverage:

- Next app ESLint
- Next app production build
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
- Current Next app remains available as fallback.

If those are not true, use the current Next app for 2026 and continue Rails/React for 2027.

## Data safety

- The current Next app and production Neon data are not changed by Phase 0/1.
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
