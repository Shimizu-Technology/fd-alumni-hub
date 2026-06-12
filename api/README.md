# FD Alumni Hub Rails API

Rails API for the phased Rails + React migration.

The current Next.js app in `apps/web` remains the production/fallback app until the side-by-side React/Vite app in `/web` is validated and intentionally cut over.

## Local setup

```bash
cd api
cp .env.example .env
bundle install
bin/rails db:create db:migrate
bin/rails server -p 3001
```

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

Development-only tokens are supported for local API checks when a user already exists:

```http
Authorization: Bearer dev_token_you@example.com
```

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

Do not point this Rails API at the existing Next/Prisma production database. Rails should use a Rails-owned local DB or Neon branch/new DB.

Use the operator-run migration path in `docs/RAILS-DATA-MIGRATION-RUNBOOK.md`:

- export Next/Prisma data to an ignored JSON snapshot
- import that snapshot into Rails with `bin/rails fd:migration:import_next_snapshot[...]`
- validate with `bin/rails fd:migration:validate_next_snapshot[...]`

Production data import/cutover must remain an explicit operator-run step.
