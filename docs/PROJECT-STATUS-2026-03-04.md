# FD Alumni Hub — Project Status (2026-03-04)

## Executive Summary
The hub is now in a strong **functional beta** state for 2025 replay/testing:
- Core app + admin + deployment are stable
- Premium frontend redesign is live
- Multi-division + playoff bracket model is implemented
- Official 2025 schedule (pool + playoffs) is loaded
- Score coverage is partially populated from verified public sources

Current score coverage: **14 / 93 games (15.1%)**

---

## What’s Done

## 1) Platform / Infrastructure
- Netlify production deploy pipeline connected to GitHub (`main`)
- Required env setup fixed (Clerk, DB, bootstrap secret)
- Build stability fixed (native deps + Prisma generate + strict TS issues resolved)

## 2) App Foundation (V1 Plan Alignment)
- Public pages shipped:
  - Home
  - Schedule
  - Standings
  - Watch
  - News
  - Sponsors
- Admin capabilities shipped (V1-light+):
  - Manage games/results
  - Manage news/sponsors
  - Manage standings recompute
  - Manage team division assignments
  - Division config view

## 3) Design / UX
- Premium UI pass shipped (cleaner modern system, better hierarchy)
- Improved nav responsiveness + loading skeletons for perceived speed
- Mobile-first behavior retained

## 4) Data Model Evolution
- `Game.division` + `Game.bracketCode` added
- Division system supports:
  - Maroon
  - Gold
  - Platinum
  - Special (used for Father-Son lane)
- Bracket labels supported:
  - MP / WMP
  - GP / WGP
  - PP / WPP
  - FS and TBD lanes

## 5) 2025 Tournament Data
- Canonical 2025 pool-play + playoffs imported from official PDFs
- Total loaded games: **93**
- Schedule now supports phase filtering:
  - All
  - Pool
  - Playoffs
  - Father-Son
- FS (Father-Son) visibility added explicitly in UI

## 6) Score Ingestion + Audit
- Deterministic import scripts added
- Public-source score extraction from GSPN added
- Coverage report added: `docs/2025-SCORE-COVERAGE-REPORT.md`
- Opus audit pass completed: PASS with safeguards

---

## What’s Not Done Yet (Critical)

1. **Complete score coverage**
- Remaining missing scores: **79 games**
- Without this, standings/bracket outcomes are partial

2. **Bracket winner resolution data**
- Winner-slot games (WMP/WGP/WPP) exist structurally, but final outcomes depend on full score entry

3. **Partner feed collaboration**
- Need direct result data flow from Clutch/GSPN for rapid score completion and future automation

---

## Next Actions (Priority Order)

## P0 — Data Completion
1. Obtain full result sheets from Clutch/GSPN (or direct exports)
2. Import remaining scores with confidence tagging
3. Recompute standings per division
4. Run final 2025 QA checklist against official docs

## P1 — Operations
1. Add simple admin "missing score" work queue
2. Add visible coverage badge on standings (e.g., 14/93 scored)
3. Lock tournament status workflow (upcoming/live/completed) per event phase

## P2 — Collaboration / Growth
1. Send collab outreach to Zay (Clutch)
2. Align watch-link metadata flow and result sharing format
3. Optionally expose attribution links (Clutch + GSPN) in UI

---

---

## Sprint A — Partner-Readiness (2026-03-04)

The following deliverables were shipped to make the platform legit and ops-ready for Clutch + GuamTime partners.

### What's Partner-Ready Now

#### 1. Admin Bulk Link Editor (`/admin/links`)
- New admin page for bulk-updating `ticketUrl` and `streamUrl` across all games
- Filter by division, phase (Pool / Playoffs / Father-Son), or missing-only views
- "Bulk fill" — paste one URL to apply to all visible/filtered games at once
- Dirty-state tracking shows which rows have unsaved edits
- Saves via atomic `POST /api/admin/games/bulk-links` endpoint

#### 2. Missing Links Dashboard (`/admin/missing-links`)
- Summary cards: total games, missing ticket, missing stream, missing both
- Visual coverage progress bars for ticket and stream completeness
- Full table of games missing at least one link (matchup, date, division, phase, missing fields)
- One-click jump to Bulk Link Editor to fix gaps

#### 3. Link Health Checker Script
- Script: `apps/web/scripts/check-link-health.ts`
- Run: `cd apps/web && npx tsx scripts/check-link-health.ts`
- Validates all ticket/stream URLs via HTTP (HEAD → GET fallback, 8s timeout)
- Tracks redirect targets for transparency
- Outputs markdown to `docs/LINK-HEALTH-REPORT.md`

#### 4. Public Partner Attribution
- **Schedule page**: "Tickets by GuamTime" and "Streams by Clutch" attribution beneath respective action buttons — tasteful, small text
- **Watch page**: "Streams by Clutch" under each watch button + "Media Partners" footer card naming both Clutch and GuamTime with their roles

#### 5. Collaboration CSV Exports
- Script: `apps/web/scripts/export-missing-links.ts`
- Run: `cd apps/web && npx tsx scripts/export-missing-links.ts`
- Generates two CSVs in `docs/exports/`:
  - `{year}-{name}-missing-ticket-links.csv` — for GuamTime
  - `{year}-{name}-missing-stream-links.csv` — for Clutch
- CSV includes: game ID, date/time, matchup, division, phase, bracket code, venue, status

### Partner Handoff Checklist

| Item | Status |
|------|--------|
| Bulk link editor (admin) | ✅ Shipped |
| Missing links dashboard (admin) | ✅ Shipped |
| Link health checker script | ✅ Shipped |
| Partner attribution on Schedule | ✅ Shipped |
| Partner attribution on Watch | ✅ Shipped |
| CSV exports for partners | ✅ Shipped |
| Actual ticket URLs (GuamTime) | ⏳ Awaiting GuamTime |
| Actual stream URLs (Clutch) | ⏳ Awaiting Clutch |

### Next: Getting URLs from Partners

1. Share `docs/exports/{year}-*-missing-ticket-links.csv` with GuamTime → get ticket URLs
2. Share `docs/exports/{year}-*-missing-stream-links.csv` with Clutch → get stream URLs
3. Use `/admin/links` to bulk-paste returned URLs
4. Run `npx tsx scripts/check-link-health.ts` to validate all links
5. All done — attribution shows automatically on public pages

---

## Source-of-Truth Docs
- `README.md`
- `docs/IA-V1.md`
- `docs/DATA-MODEL-V1.md`
- `docs/BRAND-DESIGN-TOKENS.md`
- `docs/2025-SCORE-COVERAGE-REPORT.md`
- `docs/OUTREACH-DRAFTS.md`
