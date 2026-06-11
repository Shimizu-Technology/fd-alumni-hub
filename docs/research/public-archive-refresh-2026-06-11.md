# FD Alumni public archive refresh — 2026-06-11

## Scope

Reviewed public tournament context and added a static archive layer for historical coverage that can be rendered immediately and optionally imported into the database.

## Sources reviewed

- GSPN / Guam Sports Network public article pages and WordPress REST responses
- PostGuam and GuamPDN public coverage references where available
- Existing repo ingest reports and partner/readiness docs
- Brain-Dump FD Alumni tournament runbook

## Added to app

- Static archive articles and media in `apps/web/src/lib/historical-archive.ts`
- Champion/runner-up records where publicly confirmed
- Runtime merges so `/`, `/news`, `/gallery`, and `/history` can show researched archive content even before the DB is backfilled
- Optional DB import script: `npm --workspace @fd/web run import:archive-content`

## Confirmed champions/results now represented

| Year | Champion | Runner-up | Score | Source context |
|---|---|---|---:|---|
| 2025 | 2002/04 | 2013 | 50–44 | GSPN championship recap |
| 2024 | 2016/17 | 2013 | 58–56 | GSPN championship recap |
| 2022 | 2002/04 | 2020 | 62–52 | GSPN championship recap |
| 2021 | 2006 | 2002/04 | 58–38 | GSPN / public recap context |
| 2019 | 2006 | 2009 | 49–46 | GSPN championship recap |
| 2017 | 2002/04 | 2006 | 48–46 | GSPN championship recap |
| 2015 | 2013 | 2004 | 60–48 | GSPN championship recap |
| 2020 | Cancelled | — | — | COVID-era tournament cancellation marker |

## 2025 score data added to import script

Added opening-weekend GSPN recap scores to `apps/web/scripts/import-2025-gspn-scores.ts`, covering June 28–29 games that were previously absent from the scripted score import.

## Not completed

Production database migrations/imports were not run from this environment because the production `DATABASE_URL` and app secrets were not available locally.

## Remaining data gaps

- 2026 schedule, tickets, streams, sponsors, and organizer-approved wording are still pending partner/organizer coordination.
- Some historic years still only have partial article/media coverage.
- Remaining `npm audit --omit=dev` output is limited to 3 moderate PostCSS/Next transitive findings with no currently available non-forced fix in the resolved dependency set.
