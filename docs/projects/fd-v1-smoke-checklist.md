# FD Alumni Hub — V1 Smoke Checklist

## Setup
- [ ] `apps/web/.env.local` configured
- [ ] `npx prisma migrate dev --name init_foundation`
- [ ] `npx prisma db seed`
- [ ] bootstrap admin via `/api/admin/bootstrap-whitelist`

## Public pages
- [ ] `/` shows tournament status + counts
- [ ] `/schedule` lists grouped games by day
- [ ] status badges render (scheduled/live/final)
- [ ] stream/ticket links open in new tab
- [ ] `/standings` table loads
- [ ] `/watch` sections render (live/upcoming/replay)
- [ ] `/news` cards render

## Admin pages
- [ ] `/admin` auth gate works
- [ ] `/admin/games` loads and allows status/score/url save
- [ ] `/admin/standings` recompute button works and updates rows
- [ ] `/admin/news` and `/admin/sponsors` lists load

## API sanity
- [ ] `GET /api/public/home` returns 200
- [ ] `GET /api/public/schedule` returns 200
- [ ] `GET /api/public/standings` returns 200
- [ ] `PATCH /api/admin/games/:id` updates correctly
- [ ] `POST /api/admin/standings/recompute` returns ok

## Data quality
- [ ] Historical 2024/2025 tournaments present
- [ ] 2025 sample results visible
- [ ] records with partial confidence clearly noted in DB notes
