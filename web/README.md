# FD Alumni Hub React/Vite App

Side-by-side Rails-backed frontend for the FD Alumni Basketball Tournament Hub.

This app is additive and is not the current production frontend. Production remains `apps/web` until Rails staging, data migration, and organizer review are complete.

## Local development

```bash
cp web/.env.example web/.env
# Fill VITE_CLERK_PUBLISHABLE_KEY for admin auth.
# Leave VITE_CLERK_JWT_TEMPLATE blank unless the Clerk app has a custom JWT template.

# terminal 1
cd api
bin/rails server -p 3001

# terminal 2
npm run web:dev
```

## Build

```bash
npm run web:build
```

## Routes

Public parity:
- `/`
- `/today`
- `/schedule`
- `/standings`
- `/watch`
- `/info`
- `/news`
- `/gallery`
- `/history`
- `/sponsors`

Admin parity:
- `/admin`
- `/admin/games`
- `/admin/game-day`
- `/admin/standings`
- `/admin/divisions`
- `/admin/links`
- `/admin/missing-links`
- `/admin/news`
- `/admin/media`
- `/admin/sponsors`
- `/admin/ingest`

Deployment planning for the Rails/Vite cutover lives in `docs/projects/fd-rails-vite-deployment-and-2026-schedule-plan.md`.

2026 launch polish, by-laws review notes, and future OCR schedule import planning live in `docs/projects/fd-2026-launch-polish-notes.md`.
