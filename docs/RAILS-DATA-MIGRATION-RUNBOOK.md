# Rails Data Migration Runbook

This runbook covers the operator-run migration from the archived Next/Prisma database to the Rails-owned database.

## Safety model

- Treat the current Next/Prisma production database as **read-only**.
- Do not point the Rails API at the Prisma production database.
- Export snapshots explicitly, then import snapshots into a Rails local/staging database.
- Keep `db/seeds.rb` for demo/local seed data only; real tournament data comes from this import path.
- Snapshot files live under `tmp/fd-migration/` and are ignored by git.

## 1. Export from archived Next/Prisma

The legacy Next.js app is archived under `archive/legacy-next-app` and is no longer part of the root npm workspace. If an old Prisma snapshot is needed, install and run the export script from the archive directory with `SOURCE_DATABASE_URL` or `DATABASE_URL` pointed at the read-only legacy database.

```bash
cd archive/legacy-next-app
npm install
SOURCE_DATABASE_URL=<legacy-read-only-database-url> \
  npm run export:rails-migration -- --out ../../tmp/fd-migration/next-prisma-export.json
```

The export includes:

- tournaments
- teams
- games
- standings
- article links
- media assets
- sponsors
- content ingest items
- admin whitelist rows
- app users

## 2. Create a history-only snapshot for production backfill

For production after the Rails/Vite cutover, do **not** import the full legacy snapshot directly because the old database may contain stale 2026 schedule/admin rows. Filter to historical tournament years first:

```bash
node scripts/filter-next-prisma-snapshot.mjs \
  --in tmp/fd-migration/next-prisma-export.json \
  --out tmp/fd-migration/next-prisma-export-history-only.json \
  --max-year 2025
```

The filtered snapshot keeps the historical tournaments, teams, games, standings, article links, media assets, sponsors, and ingest queue rows while excluding old admin whitelist/app-user records by default. Use `--include-admin` only for an intentional admin migration.

## 3. Prepare local Rails DB

Use an explicit local Rails database URL so Rails never points at the Prisma production DB by accident.

```bash
cd api
DATABASE_URL=postgres:///fd_alumni_hub_api_development bin/rails db:create db:migrate
```

## 4. Import into Rails

```bash
cd api
DATABASE_URL=postgres:///fd_alumni_hub_api_development \
  bin/rails 'fd:migration:import_next_snapshot[../tmp/fd-migration/next-prisma-export-history-only.json]'
```

The importer is idempotent. It upserts by `legacy_id` and preserves relationships by mapping Prisma CUIDs to Rails bigint IDs. Import output reports both snapshot `sourceCounts` and post-import `railsCounts`.

Migration normalizations:

- Duplicate media image URLs are preserved because the Prisma source allows them.
- Scheduled, unscored same-team games are marked with `games.placeholder = true` as imported placeholder/TBD games and do not affect standings.
- Source ingest items marked `approved` without an imported article/media record are reset to `pending` with a migration note so Rails preserves the invariant that approved ingest items point at imported content.
- Media ingest fallback inference only links to an imported media asset when the image URL is unique or when duplicate image URLs have exactly one title match; ambiguous cases are reset to pending for operator review.

## 5. Validate the import

```bash
cd api
DATABASE_URL=postgres:///fd_alumni_hub_api_development \
  bin/rails 'fd:migration:validate_next_snapshot[../tmp/fd-migration/next-prisma-export-history-only.json]'
```

Reports are written to:

- `tmp/fd-migration/rails-import-validation.json`
- `tmp/fd-migration/rails-import-validation.md`

Validation checks:

- source vs imported counts
- relationship references
- score coverage
- approved ingest imported-record references

## 6. Production import

Before importing into production:

1. Create a Neon backup/branch for the Rails production database.
2. Confirm the filtered snapshot excludes 2026 and admin/user records unless intentionally included.
3. Run the import once with the Rails production `DATABASE_URL`.

```bash
cd api
RAILS_ENV=production \
DATABASE_URL=<rails-production-neon-url> \
SECRET_KEY_BASE=<render-secret-key-base> \
  bundle exec rails 'fd:migration:import_next_snapshot[../tmp/fd-migration/next-prisma-export-history-only.json]'
```

Then validate and spot-check counts:

```bash
RAILS_ENV=production DATABASE_URL=<rails-production-neon-url> SECRET_KEY_BASE=<render-secret-key-base> \
  bundle exec rails 'fd:migration:validate_next_snapshot[../tmp/fd-migration/next-prisma-export-history-only.json]'

RAILS_ENV=production DATABASE_URL=<rails-production-neon-url> SECRET_KEY_BASE=<render-secret-key-base> \
  bundle exec rails runner 'puts "Tournaments=#{Tournament.count} Games=#{Game.count} Articles=#{ArticleLink.count} Media=#{MediaAsset.count}"'
```

## 7. Run Rails-backed frontend locally

```bash
# terminal 1
cd api
DATABASE_URL=postgres:///fd_alumni_hub_api_development bin/rails server -p 3001

# terminal 2
cp web/.env.example web/.env.local
npm run dev
```

## 8. Staging path after local validation

After local validation passes:

1. Create a Rails-owned Neon branch/database.
2. Deploy Rails API to Render with that Neon `DATABASE_URL`.
3. Run Rails migrations against staging.
4. Import the filtered history-only snapshot into staging with the Rails import task.
5. Deploy `/web` to Netlify staging with `VITE_API_BASE_URL` pointing to Render.
6. Smoke test public and admin flows before any production cutover.
