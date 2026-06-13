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
- `/schedule`
- `/standings`
- `/watch`
- `/news`
- `/gallery`
- `/history`
- `/sponsors`

Admin parity:
- `/admin`
- `/admin/games`
- `/admin/standings`
- `/admin/divisions`
- `/admin/links`
- `/admin/missing-links`
- `/admin/news`
- `/admin/media`
- `/admin/sponsors`
- `/admin/ingest`
