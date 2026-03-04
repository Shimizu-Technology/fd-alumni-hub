# Partner Share Checklist (Clutch + GuamTime)

**Last Updated:** 2026-03-04

Use this before sending the collaboration message.

## Product Readiness
- [x] Homepage, schedule, standings, watch, news, sponsors load on production
- [x] Mobile nav and filters work on iPhone + Android viewport
- [x] No runtime 500s in Netlify logs for public routes
- [x] All routes compile (`npm run build` passes)

## Data Readiness
- [x] Tournament schedule structure confirmed (divisions/phases)
- [x] Division/phase tags verified (Maroon/Gold/Platinum/Special + Pool/Playoff/FS)
- [x] Teams loaded in database (69 teams)
- [x] Historical content ingested (50 articles, 77 media assets)
- [ ] 2025/2026 game schedule imported (awaiting official release)

## Ticketing Readiness (GuamTime)
- [x] Missing ticket links CSV generated (`docs/exports/missing-ticket-links.csv`)
- [x] `/admin/links` bulk editor ready with partner help text
- [x] Link health report capability available (`scripts/check-link-health.ts`)
- [ ] Ticket URLs received from GuamTime and applied

## Streaming Readiness (Clutch)
- [x] Missing stream links CSV generated (`docs/exports/missing-stream-links.csv`)
- [x] `/admin/links` bulk editor ready with partner help text  
- [x] Link health report capability available (`scripts/check-link-health.ts`)
- [ ] Stream URLs received from Clutch and applied

## Partner Package
- [x] `docs/PROJECT-STATUS-2026-03-04.md` reviewed and current
- [x] `docs/SCORE-COVERAGE-REPORT.md` generated
- [x] `docs/LINK-COVERAGE-REPORT.md` generated
- [x] `docs/CONTENT-SUMMARY.md` generated
- [x] `docs/QA-SMOKE-CHECK-REPORT.md` generated
- [x] Updated outreach draft in `docs/OUTREACH-DRAFTS.md`
- [x] Point person + turnaround expectation included in message

## Admin UX for Partners
- [x] `/admin/links` — Bulk link editor with partner integration guide
- [x] `/admin/missing-links` — Missing links dashboard with partner help
- [x] Help text explains workflow for applying GuamTime/Clutch URLs
- [x] Filters for division/phase to bulk-apply URLs efficiently

## Scripts for Operators
- [x] `npm run partner-package` — Regenerate all exports/reports
- [x] `npm run qa-check` — Run QA smoke check
- [x] `scripts/check-link-health.ts` — Validate URLs

## Greptile + PR Workflow
- [x] Work on feature branch from `main`
- [x] Open PR with clear scope and screenshots
- [x] Comment `@greptile` on PR
- [x] Address review comments before merge

---

## What Partners Must Provide

### GuamTime (Ticketing)
1. Ticket purchase URLs — either:
   - Per-game URLs (matched by date + matchup from our CSV)
   - OR single event page URL for bulk application
2. Format: CSV or simple list with `date, matchup, url` columns

### Clutch (Streaming)
1. Stream/replay URLs per game
2. Can be live URLs or VOD replay links
3. Format: CSV or simple list with `date, matchup, url` columns

---

*Checklist maintained in `docs/PARTNER-SHARE-CHECKLIST.md`*
