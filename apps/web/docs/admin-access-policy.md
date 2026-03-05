# Admin Access Policy

This document defines intended role requirements for `/admin` pages and `/api/admin/*` routes.

## Roles

- **staff**: active app user (`requireStaff()`)
- **admin**: active app user with admin role (`requireAdmin()`)

## Page-level policy

All admin UI pages under `/admin/*` are **staff** access.

Rationale:
- Staff users need day-to-day operational access (games, links, media, sponsors, standings, ingestion).
- Admin-only restrictions should be enforced on high-risk endpoints, not routine operational UI.

## API policy

### Staff endpoints (`requireStaff`)

Operational CRUD and workflow routes, including:
- games, articles, teams
- media and sponsors CRUD
- standings read/recompute
- tournament list refresh
- ingestion queue actions

> Note: There is an admin `/admin/links` page, but there are currently no dedicated `/api/admin/links/*` endpoints.
> Link updates are handled through existing games-related endpoints/workflows.

### Admin-only endpoints (`requireAdmin`)

High-risk import endpoints:
- `/api/admin/import/historical-games`

### Secret-guarded bootstrap endpoint

- `/api/admin/bootstrap-whitelist`
- Guarded by `x-bootstrap-secret` + `BOOTSTRAP_SECRET`.
- This endpoint is intentionally not role-guarded because it is used for initial bootstrap provisioning.

## Consistency rules

1. If a page is staff-access, any backing API it depends on should also be staff-access (unless explicitly documented as admin-only behavior).
2. Any admin-only endpoint must be documented in this file.
3. Any secret-guarded endpoint must document why role auth is not used.

## Regression checklist

- [ ] Staff can access `/admin` and load tournament selector + refresh.
- [ ] Staff can use media/sponsor workflows.
- [ ] Staff receives `403` on admin-only endpoints.
- [ ] Admin can access all staff endpoints and admin-only endpoints.
