# Domain and Clerk Production Setup (`fd-alumni.shimizu-technology.com`)

Every domain and Clerk setting in FD Alumni Hub is environment-driven. Moving the hub from `fd-alumni-tourney.netlify.app` to `https://fd-alumni.shimizu-technology.com` (and later to a class-owned domain) requires only dashboard/DNS configuration and environment variable updates—no code edits.

Modeled after HåfaPass's production setup on `hafapass.shimizu-technology.com`.

## Environment variables

### Netlify (frontend build)

| Variable | Value for `fd-alumni.shimizu-technology.com` | Notes |
| --- | --- | --- |
| `VITE_SITE_URL` | `https://fd-alumni.shimizu-technology.com` | Single source of truth for canonical URLs, Open Graph / Twitter tags, JSON-LD, `robots.txt`, and `sitemap.xml` (injected at build time by `web/config/siteUrl.ts`). |
| `VITE_API_BASE_URL` | `https://fd-alumni-hub.onrender.com/api/v1` | Rails API base URL (must include `/api/v1`). |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | From the **production** Clerk instance for `fd-alumni.shimizu-technology.com`. Never deploy `pk_test_...` to production. |
| `VITE_CLERK_JWT_TEMPLATE` | *(blank unless custom template used)* | Default Clerk session token + Rails `CLERK_SECRET_KEY` email fallback works without a custom template. |
| `VITE_GUAMTIME_URL` | `https://guamtime.net` | Fallback link while HafaPass integration rolls out in A2/B1. |
| `VITE_CLUTCH_URL` | `https://www.clutchguam.com` | Stream partner fallback link. |

### Render (Rails API)

| Variable | Value for `fd-alumni.shimizu-technology.com` | Notes |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://fd-alumni.shimizu-technology.com` | Canonical public frontend origin (automatically included in CORS). |
| `ALLOWED_ORIGINS` | `https://fd-alumni.shimizu-technology.com,https://fd-alumni-tourney.netlify.app` | Keep both origins during cutover so public pages on the old Netlify URL still work before redirect; remove the Netlify origin once traffic moves. Production fails closed without explicit origins. |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Matches Netlify's live publishable key. Used to derive issuer/JWKS if `CLERK_ISSUER` is omitted. |
| `CLERK_ISSUER` | `https://clerk.fd-alumni.shimizu-technology.com` | Production Clerk Frontend API origin (custom domain created in Clerk). |
| `CLERK_JWKS_URL` | `https://clerk.fd-alumni.shimizu-technology.com/.well-known/jwks.json` | Optional when `CLERK_ISSUER` is set; explicit value avoids ambiguity. |
| `CLERK_AUTHORIZED_PARTIES` | `https://fd-alumni.shimizu-technology.com` | Enforces JWT `azp` claim matching against the production frontend origin (falls back to `ALLOWED_ORIGINS` in production if unset). Note: a `pk_live_` Clerk instance bound to `fd-alumni.shimizu-technology.com` serves admin sign-in on that custom domain only, not on `*.netlify.app`. |
| `CLERK_SECRET_KEY` | `sk_live_...` | Production Clerk secret key for Backend API email fallback. |
| `CLERK_AUDIENCE` | *(optional)* | Set only if using a custom JWT template with an `aud` claim. |

### AWS S3 (admin uploads)

Add `https://fd-alumni.shimizu-technology.com` to the S3 bucket's CORS `AllowedOrigins` alongside `https://fd-alumni-tourney.netlify.app`.

## Activation checklist (run when ready to turn backends on)

1. **Cloudflare DNS (`shimizu-technology.com`):**
   - Add DNS-only (grey cloud) CNAME: `fd-alumni` → `fd-alumni-tourney.netlify.app`.
2. **Netlify (`fd-alumni-tourney`):**
   - Add custom domain `fd-alumni.shimizu-technology.com`, wait for TLS provisioning, and set `fd-alumni.shimizu-technology.com` as the **primary domain** so `fd-alumni-tourney.netlify.app` redirects to it (required so `/admin` Clerk sign-in always runs on the custom domain).
3. **Clerk production instance:**
   - Create/configure a production Clerk instance for `fd-alumni.shimizu-technology.com`.
   - Add Clerk's five DNS CNAME records in Cloudflare (`clerk.fd-alumni`, `accounts.fd-alumni`, `clkmail.fd-alumni`, `clk._domainkey.fd-alumni`, `clk2._domainkey.fd-alumni`) and verify in Clerk.
   - Add `https://fd-alumni.shimizu-technology.com` to Clerk allowed origins/redirect URLs.
4. **Render (`fd-alumni-hub`):**
   - Resume the Render Starter ($7/mo) service (free tier sleeps and causes cold-start failures).
   - Set the Render env vars from the table above and redeploy.
   - Run reviewed data tasks once migrations complete:
     - `bin/rails db:migrate` (scopes divisions per tournament, adds core game fields & optimistic locking, normalizes legacy game URLs)
     - `bin/rails fd:history:seed_champions` (updates 2021/2022/2024 runners-up and adds 2026 champions)
     - `DRY_RUN=1 bin/rails fd:standings:recompute_all` → inspect every excluded team (`no_division`, `non_standings_division`, etc.) and assign divisions to any active tournament teams missing one in `/admin/divisions` (or explicitly confirm hiding unassigned teams) before running `CONFIRM=1 bin/rails fd:standings:recompute_all` (or `YEAR=2026 bin/rails fd:standings:recompute_all`)
5. **Netlify redeploy:**
   - Set `VITE_SITE_URL=https://fd-alumni.shimizu-technology.com` and `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...` in Netlify UI and trigger a fresh production build (`VITE_*` values are baked at build time).
6. **Post-cutover verification:**
   - Confirm `GET https://fd-alumni-hub.onrender.com/health` returns `200 ok`.
   - Confirm `https://fd-alumni.shimizu-technology.com/robots.txt` and `/sitemap.xml` reference `https://fd-alumni.shimizu-technology.com`.
   - Confirm the live JS bundle contains `pk_live_` and no `pk_test_` or `clerk.accounts.dev`.
   - Sign in to `/admin` as an `admin` account and as a `staff` account to verify role boundaries.

## Moving to a class-owned domain later

1. Set the new domain as Netlify's primary domain and configure a 301 redirect from `fd-alumni.shimizu-technology.com`.
2. Update Clerk's production domain and DNS records, then rotate `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_ISSUER`, `CLERK_JWKS_URL`, and `CLERK_SECRET_KEY`.
3. Update `VITE_SITE_URL`, `PUBLIC_SITE_URL`, `ALLOWED_ORIGINS`, `CLERK_AUTHORIZED_PARTIES`, and S3 CORS, then redeploy Render and Netlify.

---

## Leon & Board Manual Checklist (Non-Code Gates)

These steps require Leon or the CO2017 board directly and are intentionally kept out of automated deployments:

1. **Infrastructure activation (Leon):**
   - Complete the Cloudflare DNS, Clerk production instance, Render Starter ($7/mo) unpause, Netlify env vars, and public + private S3 bucket setup (`docs/S3-UPLOAD-SETUP.md`, including `S3_PRIVATE_BUCKET` with Block Public Access enabled).
2. **CO2017 campaign bootstrap & board onboarding (Leon + Board):**
   - Sign in as `admin`, create the `2027-class-of-2017` campaign in `/admin/campaigns` (or via the Tournament Setup Wizard), and invite CO2017 chair, treasurer, and board emails in `/admin/people`.
   - Confirm board decisions in writing: official site status, donation channel (Bank of Guam class account vs FDAA 501(c)(3) link), golf date/format, and FDAA payout note.
3. **Enter Nov 20 Antigu fundraiser numbers (Treasurer / Leon):**
   - In production `/admin/campaign/finance`, enter the Nov 20 "Two Pints, One Purpose" income/expenses (~$5K+ net), starting budget categories, and any cash/PayPal balances being transferred to the Bank of Guam class account.
4. **Treasurer & Chair phone walkthrough (Leon + Treasurer + Chair):**
   - Walk through logging an expense with a phone receipt photo, approving a reimbursement from a second officer's phone, and exporting the CSV on real phones before broad board rollout.
5. **Pre-tournament June readiness (Leon + FDMSAA + Staff):**
   - Import the official 2027 FDMSAA schedule PDF within 24 hours of release using `/admin/import`, verify divisions/rosters, run a 30-minute scorekeeper phone drill inside The Jungle (including offline retry check), and verify HåfaPass passes/nights on `/tickets`.
