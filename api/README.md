# FD Alumni Hub Rails API

Rails API foundation for the phased Rails + React migration.

The current Next.js app in `apps/web` remains the production/fallback app until the Rails + React version reaches parity.

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

## Admin endpoints in phase 1

- `GET /api/v1/me`
- `GET /api/v1/admin/tournaments`
- `POST /api/v1/admin/tournaments`
- `PATCH /api/v1/admin/tournaments/:id`
- `POST /api/v1/admin/tournaments/:id/recompute-standings`
- `GET /api/v1/admin/teams`
- `POST /api/v1/admin/teams`
- `PATCH /api/v1/admin/teams/:id`
- `GET /api/v1/admin/games`
- `POST /api/v1/admin/games`
- `PATCH /api/v1/admin/games/:id`

## Data safety

Do not point this Rails API at the existing Next/Prisma production database. Phase 1 is intended for a Rails-owned local DB or Neon branch/new DB. Production data import/cutover must be an explicit operator-run step.
