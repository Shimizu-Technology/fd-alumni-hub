# Rails Data Migration Local Validation

Validated locally on 2026-06-12 ChST using an operator-created Next/Prisma snapshot and a clean local Rails database.

## Commands run

```bash
cd archive/legacy-next-app
npm install
SOURCE_DATABASE_URL=<legacy-read-only-database-url> npm run export:rails-migration -- --out ../../tmp/fd-migration/next-prisma-export-local.json

cd ../../api
DATABASE_URL=postgres:///fd_alumni_hub_api_development DISABLE_DATABASE_ENVIRONMENT_CHECK=1 bin/rails db:drop db:create db:schema:load
DATABASE_URL=postgres:///fd_alumni_hub_api_development bin/rails 'fd:migration:import_next_snapshot[../tmp/fd-migration/next-prisma-export-local.json]'
DATABASE_URL=postgres:///fd_alumni_hub_api_development bin/rails 'fd:migration:validate_next_snapshot[../tmp/fd-migration/next-prisma-export-local.json]'
```

## Result

Validation passed with no blocking issues. The validator reported 12 non-blocking warnings for source ingest rows that were marked approved without imported content references; the importer reset those rows to pending for operator review.

| Record | Source | Imported | Missing |
| --- | ---: | ---: | ---: |
| tournaments | 22 | 22 | 0 |
| teams | 69 | 69 | 0 |
| games | 93 | 93 | 0 |
| standings | 29 | 29 | 0 |
| articleLinks | 104 | 104 | 0 |
| mediaAssets | 143 | 143 | 0 |
| sponsors | 0 | 0 | 0 |
| contentIngestItems | 100 | 100 | 0 |
| adminWhitelists | 2 | 2 | 0 |
| appUsers | 1 | 1 | 0 |

## Score coverage

| Scope | Total | Scored | Coverage | Final games missing scores |
| --- | ---: | ---: | ---: | ---: |
| source | 93 | 28 | 30.1% | 1 |
| rails | 93 | 28 | 30.1% | 1 |

## Rails API smoke checks

After import, a local Rails API smoke check returned:

- `GET /api/v1/public/home` selected tournament year: 2025, latest news: 5
- `GET /api/v1/public/schedule?year=2025` returned 93 games across Gold, Maroon, Platinum, and Special divisions

## Notes

- Duplicate media image URLs from the Prisma source were preserved in Rails.
- Four scheduled, unscored same-team placeholder games were imported with `games.placeholder = true` and remain excluded from standings.
- Local Rails post-import summary confirmed 93 games, 4 placeholders, 28 scored games, 104 articles, and 143 media assets.
- Twelve source ingest items that were marked approved without an imported content reference were reset to pending with a migration note for operator review.
- Full verification gate passed after the migration work: `./scripts/gate.sh`.
