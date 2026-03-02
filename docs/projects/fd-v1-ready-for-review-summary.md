# FD Alumni Hub V1 — Ready for Review Summary

## Branch
- `feature/v1-schedule-ui`

## Included in this branch
- Next.js scaffold + FD tokens + Sora/Geist
- Clerk auth + whitelist access model
- Prisma domain schema (tournament/team/game/standing/article/sponsor)
- Historical data research + seed pipeline (2024/2025 sourced records)
- Public pages wired to real data:
  - Home, Schedule, Standings, Watch, News
- Admin modules:
  - Overview, Games, Standings, News, Sponsors
- Admin actions:
  - Create: games, articles, sponsors
  - Update: games, articles, sponsors
  - Archive/deactivate: games, articles, sponsors
  - Recompute standings from final game results
- Mobile-first polish + inline save feedback

## Build/Test status
- `npm run build` passes
- API routes generated successfully

## Recommended Leon review flow
1) Verify auth + admin whitelist gate
2) Verify public schedule/standings/watch/news UX on mobile
3) Create/update/archive game from admin
4) Recompute standings and verify standings page updates
5) Add news/sponsor records and verify public rendering
