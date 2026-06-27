# FD Alumni Hub Rails/Vite Deployment + 2026 Schedule Plan

_Last updated: 2026-06-28_

This documents the Rails API + React/Vite deployment path, plus how the confirmed 2026 pool-play schedule is loaded. The original Next.js/Prisma implementation has been archived under `archive/legacy-next-app` and is no longer the active deployment target.

## Current decision summary

- Rails API on Render and React/Vite on Netlify are now the active deployment path.
- The archived Next.js app is retained only for migration/reference; do not deploy it.
- Deploy the React/Vite frontend from `main` using the root `netlify.toml`.
- Use a new Rails-owned Neon database; do not point Rails at the existing Next/Prisma database.
- Seed/import the 2026 organizer schedule idempotently so a fresh Rails DB has the current tournament schedule immediately.
- Keep Missing Links/Data Health for admin QA.
- Do not give team reps full admin access by default; use central roster updates short-term and consider scoped team-manager access later.

## 1. Missing Links / Data Health

The `/admin/missing-links` page is intentionally useful and should stay for now.

It answers:

- Which games are missing GuamTime ticket links?
- Which games are missing Clutch/partner stream links?
- Which final games are missing scores?

This becomes more useful after the 2026 schedule import because all new games start without ticket/stream links. Admins can use this page as a punch list while partner links arrive.

Future rename option: **Data Health** or **Link Gaps**. No behavior change is needed before staging.

## 2. Deployment plan

### Active Netlify target

The root `netlify.toml` now targets the React/Vite app in `web/`. The old Next.js app has been moved to `archive/legacy-next-app` and should not be attached to active Netlify builds.

### Rails API on Render

Recommended Render service:

- Name: `fd-alumni-hub-api`
- Root directory: `api`
- Branch: `main`
- Runtime: Ruby
- Build command:

```bash
bundle install && bundle exec rails db:migrate db:seed
```

- Start command:

```bash
bundle exec rails server -b 0.0.0.0 -p $PORT
```

Important Render env vars:

```bash
RAILS_ENV=production
DATABASE_URL=<new Rails-owned Neon pooled connection string>
SECRET_KEY_BASE=<rails secret output>
ALLOWED_ORIGINS=https://<vite-netlify-site>.netlify.app,https://<future-custom-domain>
CLERK_JWKS_URL=<production Clerk JWKS URL>
CLERK_SECRET_KEY=<production Clerk secret key>
```

Optional image upload env vars when S3 is ready:

```bash
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
```

### React/Vite on Netlify

Recommended Netlify build settings are committed in `netlify.toml`:

```bash
Base directory: .
Build command: npm ci --include=optional && npm run build
Publish directory: web/dist
```

Important Netlify env vars:

```bash
VITE_API_BASE_URL=https://<render-api>.onrender.com/api/v1
VITE_CLERK_PUBLISHABLE_KEY=<production Clerk publishable key>
VITE_CLERK_JWT_TEMPLATE=
VITE_GUAMTIME_URL=https://guamtime.net
VITE_CLUTCH_URL=https://www.clutchguam.com
VITE_PUBLIC_POSTHOG_KEY=
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
VITE_ENABLE_ANALYTICS_IN_DEV=false
```

After deploy, verify public routes, admin auth, Clerk redirects, CORS, and mobile schedule/standings before sharing widely.

## 3. Neon database decision

Create a new Neon database for Rails.

Do **not** reuse the old Next/Prisma database directly because:

- Rails uses a different schema and bigint IDs.
- The existing Prisma DB should remain a read-only source/fallback until cutover.
- The Rails import path uses `legacy_id` to map old records safely.

Recommended databases:

- `fd-alumni-hub-rails-staging`
- later: `fd-alumni-hub-rails-production`

Use the pooled connection string for the Rails app. Use explicit operator-run imports for old production data snapshots as documented in `docs/RAILS-DATA-MIGRATION-RUNBOOK.md`.

## 4. 2026 schedule import

Source PDF on Leon's Desktop:

```text
2026 FDMSAA Alumni Basketball_POOL PLAY_final_v01_27JUN26.pdf
```

Structured import data lives at:

```text
data/schedules/fd-2026-pool-play-2026-06-27.json
```

Importer:

```bash
cd api
bin/rails fd:schedule:import_2026
```

Seed behavior:

```bash
cd api
bin/rails db:seed
```

By default, `db:seed` imports the 2026 schedule idempotently. To skip it for a special environment:

```bash
FD_SEED_2026_SCHEDULE=0 bin/rails db:seed
```

The importer is safe to run repeatedly:

- Creates/updates the 2026 tournament.
- Creates/updates schedule teams using stable `legacy_id`s.
- Creates missing games using stable `legacy_id`s.
- Preserves existing tournament dates, team display labels, game status, scores, teams, and tipoff times on normal seed runs so later deploys do not accidentally revert organizer/admin edits.
- Recomputes standings after import.

If the source schedule JSON is intentionally revised and should overwrite existing game matchups/times, run:

```bash
FD_SCHEDULE_IMPORT_OVERWRITE=1 bin/rails fd:schedule:import_2026
```

Imported scope:

- 61 scheduled pool/father-son rows.
- Venue defaults to `The Jungle`.
- Times are interpreted in `Pacific/Guam`.
- `notes` includes `phase=pool` or `phase=fatherson` for schedule filtering.

Known source gaps intentionally excluded until confirmed:

- `60sFS 60s FS vs. 60s FS` has no confirmed time in the extracted/source row.
- Friday July 17 single-elimination `8:20pm vs.` placeholder has no teams yet.

## 5. Team roster access decision

Short-term recommendation: keep roster updates with trusted admins/organizers.

Do **not** give all team reps full staff/admin access yet because current staff/admin access can reach broader tournament operations.

Future scoped options:

1. `team_manager` role with explicit `team_assignments` table.
   - Can edit roster entries only for assigned team(s).
   - Cannot edit schedule, scores, links, sponsors, media, or polls.
2. Magic roster-edit links per team.
   - Lower friction.
   - Good for one-time roster collection.
   - Requires expiration/audit trail.

Build this only if roster delegation becomes necessary for launch. It should be a separate PR because it touches auth, role policy, admin navigation, tests, and UX.

## 6. Recommended next steps

Future schedule automation note: OCR/upload should build on the structured importer by producing a human-reviewed schedule preview and JSON snapshot before writing games. Do not let OCR silently mutate production schedules.

1. Merge the 2026 schedule import PR.
2. Create Rails staging Neon DB.
3. Deploy Rails API staging to Render.
4. Deploy React/Vite staging to a new Netlify site.
5. Run Rails migrations and seed/import schedule.
6. Import/validate old Next/Prisma snapshot if archive/news/history data is needed in staging.
7. Smoke test public pages, `/today`, admin auth, Games, Game Day, Links, Missing Links/Data Health.
8. Organizer/mobile review.
9. Prepare production cutover and rollback plan.
