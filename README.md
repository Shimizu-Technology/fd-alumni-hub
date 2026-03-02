# FD Alumni Basketball Tournament Hub

Official-style hub concept for Father Duenas Memorial School Alumni Basketball Tournament.

## V1 Goal
Single source of truth for:
- Full game schedule
- Standings
- Watch links (Clutch)
- Ticket links (GuamTime)
- News/articles (GSPN + official updates)
- Sponsors

## Product Principle
Spreadsheet-simple UX first. Add advanced stats/automation later.

## Docs
- `docs/BRAND-DESIGN-TOKENS.md` — FD-aligned palette, typography, and UX guardrails
- `docs/IA-V1.md` — page map + UX flow
- `docs/DATA-MODEL-V1.md` — core entities for MVP
- `docs/OUTREACH-DRAFTS.md` — collaboration messages for Zay/GSPN/GuamTime

## Suggested Stack (MVP)
- Next.js + TypeScript
- Postgres (or Supabase) for schedule/standings content
- Admin auth for score/schedule updates



## App Scaffold
- Next.js app lives in `apps/web`
- Run dev: `npm run dev` (from repo root)
- Build: `npm run build`
