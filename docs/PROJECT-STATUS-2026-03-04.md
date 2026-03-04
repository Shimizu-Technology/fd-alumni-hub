# FD Alumni Hub — Project Status (2026-03-04)

## Executive Summary
The hub is now in a strong **functional beta** state for 2025 replay/testing:
- Core app + admin + deployment are stable
- Premium frontend redesign is live
- Multi-division + playoff bracket model is implemented
- Official 2025 schedule (pool + playoffs) is loaded
- Score coverage is partially populated from verified public sources
- Historical content ingest is 96% complete
- Champion data verified for 2014-2025 (excluding 2016)

Current 2025 score coverage: **14 / 93 games (15.1%)**

---

## What's Done

### 1) Platform / Infrastructure
- Netlify production deploy pipeline connected to GitHub (`main`)
- Required env setup fixed (Clerk, DB, bootstrap secret)
- Build stability fixed (native deps + Prisma generate + strict TS issues resolved)

### 2) App Foundation (V1 Plan Alignment)
- Public pages shipped:
  - Home
  - Schedule
  - Standings
  - Watch
  - News
  - **History** (with champion highlights + coverage badges)
  - Gallery
  - Sponsors
- Admin capabilities shipped (V1-light+):
  - Manage games/results
  - Manage news/sponsors
  - Manage standings recompute
  - Manage team division assignments
  - Division config view
  - Bulk link editor
  - Missing links dashboard
  - Content ingest management

### 3) Design / UX
- Premium UI pass shipped (cleaner modern system, better hierarchy)
- Improved nav responsiveness + loading skeletons for perceived speed
- Mobile-first behavior retained
- **History page enhanced** with:
  - Champion/runner-up badges (🏆🥈)
  - Championship scores where available
  - Score coverage progress bars
  - Dynasty watch highlights
  - Data source attribution

### 4) Data Model Evolution
- `Game.division` + `Game.bracketCode` added
- Division system supports: Maroon, Gold, Platinum, Special (Father-Son)
- Bracket labels: MP/WMP, GP/WGP, PP/WPP, FS, TBD
- `MediaAsset` model with tags for featured content
- `ContentIngestItem` for queue-based content approval

### 5) 2025 Tournament Data
- Canonical 2025 pool-play + playoffs imported from official PDFs
- Total loaded games: **93**
- Schedule supports phase filtering: All, Pool, Playoffs, Father-Son

### 6) Score Ingestion + Audit
- Deterministic import scripts added
- Public-source score extraction from GSPN
- Coverage report: `docs/SCORE-COVERAGE-REPORT.md`
- Score wiring script: `apps/web/scripts/score-wiring-pass.ts`
- Safe writes only (high-confidence matchup/date required)

### 7) Historical Content
- **50 articles** ingested from GSPN, GuamPDN
- **77 media assets** with attribution
- Champions list verified (2005-2025)
- Quality pass: source normalization, deduplication
- Gap report: 2016 data unavailable (source-side)

### 8) Partner Readiness (Sprint A)
- Admin bulk link editor (`/admin/links`)
- Missing links dashboard (`/admin/missing-links`)
- Link health checker script
- Public partner attribution (Schedule + Watch pages)
- CSV exports for partners

---

## What's Not Done Yet (Critical)

### P0 — Data Completion
1. **Complete score coverage**
   - Remaining missing scores: **79 games**
   - Without this, standings/bracket outcomes are partial
2. **Bracket winner resolution**
   - Winner-slot games (WMP/WGP/WPP) depend on full score entry

### P1 — Partner Data Flow
1. Obtain full result sheets from Clutch/GSPN
2. Import remaining scores with confidence tagging
3. Recompute standings per division

### P2 — Operations Polish
1. Add simple admin "missing score" work queue view
2. Lock tournament status workflow (upcoming/live/completed)

---

## Recent Changes (2026-03-04 Product Pass)

### Score Wiring
- Created `apps/web/scripts/score-wiring-pass.ts`
- Safe mapping from confirmed scores → game records
- Only high-confidence matchup/date writes
- Ambiguous cases left for manual review

### Historical Quality Pass
- Created `apps/web/scripts/historical-quality-pass.ts`
- Deduplication of articles and media by URL
- Source normalization (GSPN, Clutch, GuamPDN)
- Title normalization for consistency

### UX Enhancement (History Page)
- Champion badges with verified data
- Runner-up and score display where available
- Coverage progress bars per tournament
- Dynasty watch section
- Data source attribution notice

### Partner Package V2
- Created `apps/web/scripts/generate-partner-package.ts`
- Refreshed exports:
  - `docs/exports/missing-scores.csv`
  - `docs/exports/missing-ticket-links.csv`
  - `docs/exports/missing-stream-links.csv`
- New reports:
  - `docs/SCORE-COVERAGE-REPORT.md`
  - `docs/LINK-COVERAGE-REPORT.md`
  - `docs/CONTENT-SUMMARY.md`
- Package manifest: `docs/PARTNER-PACKAGE-MANIFEST.json`

---

## Data Quality Status

### Champions (Verified)
| Year | Champion | Score | Source |
|------|----------|-------|--------|
| 2025 | Class of 2002/04 | 50-44 | GuamPDN ✓ |
| 2024 | Class of 2016/17 | 58-56 | GSPN ✓ |
| 2023 | Class of 2013 | - | GSPN ✓ |
| 2022 | Class of 2002/04 | 62-52 | GSPN ✓ |
| 2021 | Class of 2006 | 58-38 | GSPN ✓ |
| 2020 | *Cancelled* | - | COVID-19 |
| 2019 | Class of 2006 | - | GSPN ✓ |
| 2018 | Class of 2002/04 | - | GSPN ✓ |
| 2017 | Class of 2002/04 | - | GSPN ✓ |
| 2016 | **UNKNOWN** | - | ❌ No data |
| 2015 | Class of 2013 | 60-48 | GSPN ✓ |
| 2014 | Class of 2004 | - | GSPN ✓ |

### Gaps Remaining
1. **2016 Champion** — No tournament data found in GSPN, GuamPDN, or Wayback
2. **79 missing 2025 scores** — Need partner data or manual entry
3. **Link URLs** — Awaiting GuamTime (tickets) and Clutch (streams)

---

## Source-of-Truth Docs
- `README.md`
- `docs/IA-V1.md`
- `docs/DATA-MODEL-V1.md`
- `docs/BRAND-DESIGN-TOKENS.md`
- `docs/SCORE-COVERAGE-REPORT.md`
- `docs/HISTORICAL-INGEST-REPORT.md`
- `docs/HISTORICAL-GAP-REPORT.md`
- `docs/PARTNER-SHARE-CHECKLIST.md`
- `docs/CONTENT-PARTNER-FORMAT.md`
- `docs/OUTREACH-DRAFTS.md`
- `docs/S3-UPLOAD-SETUP.md`
- `docs/INGESTION-QUEUE-WORKFLOW.md`
- `docs/PARTNER-DATA-CONTRACTS.md`

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `score-wiring-pass.ts` | Safe score import from confirmed sources |
| `historical-quality-pass.ts` | Dedupe + normalize content |
| `generate-partner-package.ts` | Create exports/reports for partners |
| `check-link-health.ts` | Validate ticket/stream URLs |
| `export-missing-links.ts` | CSV exports for partners |
| `import-2025-gspn-scores.ts` | GSPN score extraction |
| `import-2025-official-schedule.ts` | Official schedule import |
| `historical-ingest.ts` | Historical content discovery |
