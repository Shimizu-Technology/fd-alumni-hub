# Partner Demo Status — FD Alumni Hub

**Status:** Partner-demo ready for the current Next.js production app. Rails-backed React/Vite parity is now available side-by-side for staging validation, but it is not cut over.

**Updated:** 2026-06-11

---

## Executive Summary

The production FD Alumni Hub remains ready for partner demonstration at `https://fd-alumni-hub.netlify.app`. Current production runs from `apps/web` on Next.js.

The migration branch adds a Rails API plus `/web` React/Vite frontend with public and admin parity. Use it for internal validation before any production switch.

### What's Working in Production

| Component | Status | Notes |
|-----------|--------|-------|
| Production Deploy | Ready | Netlify pipeline from `main` |
| Public Pages | Ready | Home, Schedule, Standings, Watch, News, History, Gallery, Sponsors |
| Admin Panel | Ready | Game/content/link/sponsor management |
| Partner Link Editor | Ready | Bulk fill + per-game editing |
| Partner Exports | Ready | CSV exports for missing links/scores |
| Historical Content | Ready | 104 article links and 143 media assets in verified DB snapshot |
| QA Automation | Ready | Smoke check script and full repo gate available |

### Rails/Vite Validation Status

| Area | Status | Notes |
|------|--------|-------|
| Rails public endpoints | Implemented | Home, tournaments, schedule, standings, articles, media, sponsors |
| Rails admin endpoints | Implemented | Dashboard, games, teams, standings, articles, media, sponsors, ingest, links, missing links |
| React/Vite public pages | Implemented | Side-by-side `/web` app |
| React/Vite admin pages | Implemented | Clerk-protected admin console; no dev-token bypass |
| Production cutover | Pending | Requires staging, data migration rehearsal, and organizer approval |

### What's Pending

| Item | Status | Owner |
|------|--------|-------|
| 2026 Game Schedule | Awaiting | Official source |
| Ticket URLs | Awaiting | GuamTime |
| Stream URLs | Awaiting | Clutch |
| Sponsor Logos | Awaiting | Event organizers |
| Rails staging DB/API | Pending | Shimizu Technology |

---

## Partner Integration Workflow

### For GuamTime (Ticketing Partner)

1. **Export:** Share `docs/exports/missing-ticket-links.csv` with GuamTime.
2. **Receive:** GuamTime provides ticket URLs matched to games.
3. **Import:** Use `/admin/links` bulk editor to apply URLs.
4. **Verify:** Run link health check.

### For Clutch (Streaming Partner)

1. **Export:** Share `docs/exports/missing-stream-links.csv` with Clutch.
2. **Receive:** Clutch provides stream/replay URLs.
3. **Import:** Use `/admin/links` bulk editor to apply URLs.
4. **Verify:** Run link health check.

---

## Admin Quick Reference

### Key URLs (Production)
- **Public Site:** `https://fd-alumni-hub.netlify.app`
- **Admin Panel:** `https://fd-alumni-hub.netlify.app/admin`
- **Link Editor:** `https://fd-alumni-hub.netlify.app/admin/links`
- **Missing Links:** `https://fd-alumni-hub.netlify.app/admin/missing-links`

### Local Rails/Vite Validation

```bash
# Terminal 1
cd api
bin/rails server -p 3001

# Terminal 2
cp web/.env.example web/.env
npm run web:dev
```

### Operator Scripts
```bash
# Regenerate partner package from the Next app workspace
npm --workspace @fd/web run partner-package

# Run QA smoke check
npm --workspace @fd/web run qa-check

# Full repo gate
./scripts/gate.sh
```

---

## Demo Talking Points

1. **Schedule Page** — Division filters, playoff bracket codes, mobile-responsive.
2. **Watch Page** — Partner attribution, stream/ticket CTAs when URLs populate.
3. **History Page** — Champion context, coverage progress, dynasty watch.
4. **Admin Panel** — Bulk link editor and missing-link workflow.
5. **Partner Package** — CSV exports and clear source-of-truth handoff.

---

## Next Steps After Demo

1. Import official 2026 game schedule when released.
2. Apply ticket URLs from GuamTime.
3. Apply stream URLs from Clutch.
4. Configure sponsors with logos.
5. Validate Rails/Vite staging before any cutover.
6. Final pre-tournament QA pass.

---

*Status maintained in `docs/PARTNER-DEMO-STATUS.md`*
