# Partner Share Checklist (Clutch + GuamTime)

Use this before sending the collaboration message.

## Product Readiness
- [ ] Homepage, schedule, standings, watch, news, sponsors load on production
- [ ] Mobile nav and filters work on iPhone + Android viewport
- [ ] No runtime 500s in Netlify logs for public routes

## Data Readiness
- [ ] 2025 pool + playoff schedule confirmed against official PDFs
- [ ] Division/phase tags verified (Maroon/Gold/Platinum/Special + Pool/Playoff/FS)
- [ ] Standings coverage badge reflects current scored-game coverage

## Ticketing Readiness (GuamTime)
- [ ] Missing ticket links CSV generated (`apps/web/scripts/export-missing-links.ts`)
- [ ] `/admin/links` used to bulk-fill available ticket URLs
- [ ] Link health report generated and no critical ticket link failures

## Streaming Readiness (Clutch)
- [ ] Missing stream links CSV generated (`apps/web/scripts/export-missing-links.ts`)
- [ ] `/admin/links` used to bulk-fill available stream URLs
- [ ] Link health report generated and no critical stream link failures

## Partner Package
- [ ] `docs/PROJECT-STATUS-2026-03-04.md` reviewed and current
- [ ] `docs/2025-SCORE-COVERAGE-REPORT.md` attached for transparency
- [ ] Updated outreach draft copied from `docs/OUTREACH-DRAFTS.md`
- [ ] Point person + turnaround expectation included in message

## Greptile + PR Workflow
- [ ] Work on feature branch from `main`
- [ ] Open PR with clear scope and screenshots
- [ ] Comment `@greptile` on PR
- [ ] Address review comments before merge
