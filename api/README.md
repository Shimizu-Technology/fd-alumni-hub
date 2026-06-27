# FD Alumni Hub Rails API

Rails API for the phased Rails + React migration.

The active frontend is the React/Vite app in `/web`. The original Next.js/Prisma app has been archived under `archive/legacy-next-app` for historical/migration reference only.

## Local setup

```bash
cd api
cp .env.example .env
# Fill CLERK_JWKS_URL, CLERK_SECRET_KEY, and FD_ADMIN_EMAIL for local admin auth.
bundle install
bin/rails db:create db:migrate
bin/rails db:seed
bin/rails server -p 3001
```

`db:seed` imports the 2026 organizer pool-play schedule by default. Set `FD_SEED_2026_SCHEDULE=0` only for special blank-database testing.

Optional local demo seed:

```bash
FD_SEED_DEMO=1 FD_ADMIN_EMAIL=you@example.com bin/rails db:seed
```

## CORS

Local development falls back to localhost frontend origins. Production intentionally has no CORS fallback; set `ALLOWED_ORIGINS` explicitly before deploying the Rails API, for example:

```bash
ALLOWED_ORIGINS=https://fd-alumni-hub.netlify.app,https://your-custom-domain.com
```

## Health checks

```bash
curl http://localhost:3001/up
curl http://localhost:3001/health
```

## Public endpoints

- `GET /api/v1/public/home`
- `GET /api/v1/public/today`
- `POST /api/v1/public/prediction-polls/:prediction_poll_id/vote`
- `GET /api/v1/public/tournaments`
- `GET /api/v1/public/schedule`
- `GET /api/v1/public/standings`
- `GET /api/v1/public/articles`
- `GET /api/v1/public/media-assets`
- `GET /api/v1/public/sponsors`

Most public endpoints accept `tournamentId` or `year` query params. Schedule also accepts `division` and `phase` (`pool`, `playoff`, `fatherson`).

## Admin auth

Admin routes use Clerk JWTs with an allowlist:

- `AdminWhitelist` stores approved emails and roles.
- `User` records are created/attached on first successful Clerk sign-in.
- `CLERK_JWKS_URL` or `CLERK_ISSUER` configures JWT verification.
- `CLERK_SECRET_KEY` is optional fallback for email lookup when JWT claims omit email.

Local admin testing should use real Clerk sign-in with an allowlisted email. Seed the allowlist with `FD_ADMIN_EMAIL=you@example.com bin/rails db:seed`, then sign in through the React/Vite app.

## Admin endpoints

- `GET /api/v1/me`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/tournaments`
- `POST /api/v1/admin/tournaments`
- `PATCH /api/v1/admin/tournaments/:id`
- `POST /api/v1/admin/tournaments/:id/recompute-standings`
- `GET /api/v1/admin/teams`
- `POST /api/v1/admin/teams`
- `PATCH /api/v1/admin/teams/:id`
- `DELETE /api/v1/admin/teams/:id`
- `POST /api/v1/admin/roster-entries`
- `POST /api/v1/admin/roster-entries/bulk`
- `PATCH /api/v1/admin/roster-entries/:id`
- `DELETE /api/v1/admin/roster-entries/:id`
- `GET /api/v1/admin/game-day-notes`
- `POST /api/v1/admin/game-day-notes`
- `PATCH /api/v1/admin/game-day-notes/:id`
- `GET /api/v1/admin/prediction-polls`
- `POST /api/v1/admin/prediction-polls`
- `PATCH /api/v1/admin/prediction-polls/:id`
- `GET /api/v1/admin/games`
- `GET /api/v1/admin/games/:id`
- `POST /api/v1/admin/games`
- `PATCH /api/v1/admin/games/:id`
- `GET /api/v1/admin/standings`
- `POST /api/v1/admin/standings/recompute`
- `GET /api/v1/admin/articles`
- `POST /api/v1/admin/articles`
- `PATCH /api/v1/admin/articles/:id`
- `DELETE /api/v1/admin/articles/:id`
- `GET /api/v1/admin/media-assets`
- `POST /api/v1/admin/media-assets`
- `PATCH /api/v1/admin/media-assets/:id`
- `DELETE /api/v1/admin/media-assets/:id`
- `GET /api/v1/admin/sponsors`
- `POST /api/v1/admin/sponsors`
- `PATCH /api/v1/admin/sponsors/:id`
- `DELETE /api/v1/admin/sponsors/:id`
- `GET /api/v1/admin/content-ingest-items`
- `POST /api/v1/admin/content-ingest-items`
- `PATCH /api/v1/admin/content-ingest-items/:id`
- `DELETE /api/v1/admin/content-ingest-items/:id`
- `POST /api/v1/admin/content-ingest-items/:id/approve`
- `POST /api/v1/admin/content-ingest-items/:id/reject`
- `GET /api/v1/admin/links`
- `PATCH /api/v1/admin/links/bulk`
- `GET /api/v1/admin/missing-links`

## Data migration + safety

Do not point this Rails API at the archived Next/Prisma production database. Rails should use a Rails-owned local DB or Neon branch/new DB.

Use the operator-run migration path in `docs/RAILS-DATA-MIGRATION-RUNBOOK.md`:

- export Next/Prisma data to an ignored JSON snapshot
- import that snapshot into Rails with `bin/rails fd:migration:import_next_snapshot[...]`
- validate with `bin/rails fd:migration:validate_next_snapshot[...]`

Production data import/cutover must remain an explicit operator-run step.

## 2026 schedule import

Structured schedule data lives in `../data/schedules/fd-2026-pool-play-2026-06-27.json`.

```bash
bin/rails fd:schedule:import_2026
```

The import is idempotent and also runs from `db:seed` unless `FD_SEED_2026_SCHEDULE=0` is set. Normal seed runs create missing games and preserve existing tournament, team, and game edits. To intentionally apply a revised source schedule over existing records, run `FD_SCHEDULE_IMPORT_OVERWRITE=1 bin/rails fd:schedule:import_2026`. It imports confirmed pool/father-son schedule rows and intentionally skips rows without a confirmed time/team matchup.
