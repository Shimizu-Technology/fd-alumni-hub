# FD Alumni Hub — Host Year (A2) & Finance Tracker (A3) Design

- **Date:** 2026-11-22
- **Verified baseline:** `origin/main` (`c570d15`) + A1 Foundations (`agent/hub-a1-foundations`)
- **Owner:** FD Alumni Hub project lead for Leon Shimizu (Shimizu Technology)
- **Related plans:**
  - `Brain-Dump/work/shimizu-tech/fd-co2017-host-year-plan-2026-11-21.md` (v5, §§3, 4.1, 4.2, 4.4, 5 Track 1, 6, 8, 9)
  - `Brain-Dump/work/shimizu-tech/fd-alumni-tournament.md`
  - `HafaPass/docs/FD_TOURNEY_2027_READINESS.md` (§2 public events & `/go/:code` contract)

---

## 1. Goals & Architectural Invariants

1. **Reusable across every host class.** Every fundraiser, update, pledge, budget line, ledger entry, and board role hangs off a `host_campaigns` record linked to `(tournament_id, class_cohort_id)`. Class of 2017 hosts 2027; Class of 2018 hosts 2028 using the same models, pages, and workflows with zero hardcoded class names or years.
2. **One front door; the hub never takes cards.** Every flyer, Instagram bio, and WhatsApp post points to `fd-alumni.shimizu-technology.com` (and later the class's own domain).
   - Tournament and fundraiser tickets sell on **HåfaPass** (`hafapass.shimizu-technology.com`), read server-side from HåfaPass's public events API and linked via `/go/:code` attribution links.
   - Golf registration and golf sponsorships live on the separate **Golf Platform** (`fd-golf.shimizu-technology.com`); the hub links to it and records golf totals in the ledger.
   - Direct donations link out to the board-chosen channel (`donation_url` or offline instructions).
3. **Strict financial privacy.** Public visitors see **only** the campaign fundraising meter (`goalCents`, `raisedCents`, `percent`, `updatedAt`) when `public_meter_enabled` is true. Expenses, net balance, pledges, receipts, reimbursements, and individual counterparties stay strictly behind authenticated campaign-board roles (`chair`, `treasurer`, `board`) and global `admin`.
4. **Offline-safe while the Render API is paused.** Merging to `main` deploys the public Netlify site immediately. All new public routes (`/host-year`, `/host-year/:slug`) must follow A1's per-section degradation pattern so visitors get clear notices + retry (and intact static navigation/history) whenever the API is unavailable.
5. **Existing schema conventions.** Match `api/db/schema.rb`: bigint primary keys, integer cents (`*_cents`), snake_case DB columns, camelCase JSON API responses, cascading or nullifying foreign keys, and Guam time (`Pacific/Guam`) for display dates with UTC storage.

---

## 2. Verified Current Schema & A1 Hooks

Checked against `api/db/schema.rb` (post-A1):

- **`tournaments`**: `id`, `year`, `name`, `start_date` (`date`), `end_date` (`date`), `status` (`upcoming`/`live`/`completed`/`cancelled`).
- **`class_cohorts`**: `id`, `key` (unique, e.g. `"17"`), `graduation_year` (unique, e.g. `2017`), `display_name` (`"Class of 2017"`), `short_label` (`"'17"`).
- **`users`**: `id`, `email` (unique lower), `clerk_id` (unique), `first_name`, `last_name`, `role` (`admin`/`staff`/`viewer`), `active`.
- **`admin_whitelists`**: `id`, `email` (unique lower), `role` (`admin`/`staff`/`viewer`), `active`, `notes`.
- **`sponsors`**: `id`, `tournament_id`, `name`, `logo_url`, `target_url`, `tier`, `active`, `position`.
- **`article_links`**: requires `url` (`NOT NULL`, unique per tournament) and models external press links (GSPN, PostGuam, GuamPDN). Because native class announcements have no external publisher URL, class updates belong in a separate `campaign_posts` table.
- **`PublicImageUploadPresigner`**: signs **public** image-only S3 POSTs under `S3_PUBLIC_BASE_URL`. Finance receipts (images + PDFs) must use a separate **private** S3 presigner (`PrivateReceiptStorage`) that never exposes public URLs.

---

## 3. Milestone A2: Host Year (Data Model, HåfaPass Contract, API & Public UI)

### 3.1 Database tables

#### `host_campaigns`
One campaign per `(tournament_id, class_cohort_id)` (e.g. 2027 Tournament hosted by Class of 2017).

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `tournament_id` | `bigint` | FK → `tournaments.id` (`on_delete: :cascade`), `NOT NULL`, unique index |
| `class_cohort_id` | `bigint` | FK → `class_cohorts.id` (`on_delete: :restrict`), `NOT NULL`, indexed |
| `slug` | `string` | `NOT NULL`, unique index (e.g. `"2027-class-of-2017"`) |
| `title` | `string` | `NOT NULL` (e.g. `"Class of 2017 Host Year"`) |
| `tagline` | `string` | Nullable (e.g. class slogan/theme) |
| `description` | `text` | Nullable, public intro copy |
| `status` | `string` | `NOT NULL`, default `"draft"` (`draft`, `active`, `archived`) |
| `goal_cents` | `bigint` | `NOT NULL`, default `3_000_000` ($30,000), check `>= 0` |
| `countdown_target_at` | `datetime` | Nullable (falls back to `tournament.start_date` 6:00 PM Guam if nil) |
| `countdown_label` | `string` | Nullable (e.g. `"Tentative tip-off · Jun 25, 2027"`) |
| `hero_image_url` | `string` | Nullable (public S3 image URL) |
| `donation_url` | `string` | Nullable (external checkout / FDAA / Bank of Guam link) |
| `donation_instructions` | `text` | Nullable (e.g. check/Bank of Guam instructions for off-island alumni) |
| `golf_url` | `string` | Nullable (e.g. `"https://fd-golf.shimizu-technology.com"`) |
| `hafapass_organizer_slug` | `string` | Nullable (CO2017 HåfaPass org slug for fundraisers, e.g. `"co2017"`) |
| `hafapass_tournament_organizer_slug` | `string` | Nullable (FDAA HåfaPass org slug for tournament passes/tickets, e.g. `"fdaa"`) |
| `hafapass_distribution_code` | `string` | Nullable (default `/go/:code` attribution code for hub traffic) |
| `fdaa_upfront_cents` | `bigint` | `NOT NULL`, default `0`, check `>= 0` (reference allocation, e.g. $15,000) |
| `fdaa_ticket_share_bps` | `integer` | `NOT NULL`, default `1600`, check `0..10000` (16.00% = 1600 bps) |
| `public_meter_enabled` | `boolean` | `NOT NULL`, default `true` |
| `include_fdaa_in_public_meter` | `boolean` | `NOT NULL`, default `false` (toggle once board answers §9 #6) |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes:
- `UNIQUE (tournament_id)` — one host campaign per tournament edition
- `UNIQUE (slug)`
- `INDEX (status, created_at)`
- Partial unique index: at most one `status = 'active'` campaign (`WHERE status = 'active'`), so public `/host-year` deterministically resolves the current host campaign without ambiguity.

#### `campaign_events`
Fundraisers, host nights, golf tournament, and board meetings attached to a `host_campaign`.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :cascade`), `NOT NULL` |
| `kind` | `string` | `NOT NULL`, default `"fundraiser"` (`fundraiser`, `host_night`, `golf`, `merch_drop`, `meeting`, `other`) |
| `title` | `string` | `NOT NULL` |
| `starts_at` | `datetime` | Nullable (TBA events allowed, e.g. `"May golf tourney"`) |
| `ends_at` | `datetime` | Nullable |
| `date_label` | `string` | Nullable (human fallback when `starts_at` is TBA, e.g. `"May 2027 (TBA)"`) |
| `venue` | `string` | Nullable |
| `description` | `text` | Nullable |
| `image_url` | `string` | Nullable (public S3 image) |
| `hafapass_event_slug` | `string` | Nullable (matches HåfaPass event `slug` to enrich card with live price/availability) |
| `hafapass_distribution_code` | `string` | Nullable (per-event `/go/:code`, overrides campaign default) |
| `external_url` | `string` | Nullable (e.g. `https://fd-golf.shimizu-technology.com` for golf or partner flyer) |
| `cta_label` | `string` | Nullable (e.g. `"Buy tickets"`, `"Register foursome"`) |
| `status` | `string` | `NOT NULL`, default `"planned"` (`planned`, `open`, `sold_out`, `completed`, `cancelled`) |
| `public_visible` | `boolean` | `NOT NULL`, default `true` (`false` for internal board meetings) |
| `goal_cents` | `bigint` | Nullable, check `>= 0` (internal event goal; never leaked publicly unless explicitly desired) |
| `position` | `integer` | `NOT NULL`, default `0` |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes: `INDEX (host_campaign_id, public_visible, starts_at, position)`.

#### `campaign_posts`
Class announcements and fundraising recaps (separate from external `article_links`).

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :cascade`), `NOT NULL` |
| `author_id` | `bigint` | FK → `users.id` (`on_delete: :nullify`), nullable |
| `title` | `string` | `NOT NULL` |
| `body` | `text` | `NOT NULL` (plain text / simple paragraphs; rendered safely without `dangerouslySetInnerHTML`) |
| `image_url` | `string` | Nullable (public S3 image) |
| `published_at` | `datetime` | Nullable (`nil` = draft; `<= Time.current` = publicly visible) |
| `pinned` | `boolean` | `NOT NULL`, default `false` |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes: `INDEX (host_campaign_id, pinned, published_at)`.

### 3.2 HåfaPass Server-Side Events Integration

Aligned with HåfaPass's documented contract (`HafaPass/docs/FD_TOURNEY_2027_READINESS.md` §2):

- **Env vars on Hub Rails API:**
  - `HAFAPASS_API_BASE_URL` (default `https://hafapass-api.onrender.com/api/v1`)
  - `HAFAPASS_WEB_BASE_URL` (default `https://hafapass.shimizu-technology.com`)
  - `HAFAPASS_EVENTS_CACHE_TTL_SECONDS` (default `300`, i.e. 5 minutes)
- **Service `Hafapass::EventsClient`:**
  - Calls `GET #{HAFAPASS_API_BASE_URL}/events?organizer=#{slug}&per_page=50&include_sold_out=true` with **no** auth headers (`open_timeout: 2`, `read_timeout: 3`).
  - Caches normalized event cards in `Rails.cache` under `"hafapass:events:v1:#{slug}"` for 5 minutes AND keeps a separate stale fallback cache entry (`"hafapass:events:stale:v1:#{slug}"`, 24h) so if HåfaPass has a cold start or brief blip, the hub serves the last known event list (with `stale: true`) instead of failing the Host Year page.
  - If HåfaPass is unreachable and no stale entry exists, returns `{ events: [], available: false, fetchedAt: nil }` — the Host Year page still renders all hub-authored `campaign_events`, countdown, meter, and posts cleanly.
  - **Normalized fields exposed to frontend per HåfaPass event:**
    - `id`, `slug`, `title`, `shortDescription`, `startsAt`, `endsAt`, `venueName`, `venueCity`, `status`, `purchasable`, `soldOut` (`!purchasable && ticketTypes.all? { |t| t.quantityRemaining == 0 }`)
    - `minAllInPriceCents` (lowest `all_in_price_cents` across active `ticket_types`, or `0` if free), `ticketTypes` (name, `allInPriceCents`, `quantityRemaining`, `onSale`)
    - `buyUrl`: if `distribution_code` is configured on the matching `campaign_event` or `host_campaign`, `#{HAFAPASS_WEB_BASE_URL}/go/#{code}`; otherwise `#{HAFAPASS_WEB_BASE_URL}/events/#{event.slug}`.
  - Note: never leak HåfaPass organizer internal/admin fields; whitelist only public display fields.

### 3.3 Public API Endpoints (A2)

- `GET /api/v1/public/host-year` (resolves active `host_campaign`, or optional `?slug=` / `?year=`):
  ```json
  {
    "campaign": {
      "id": "1",
      "slug": "2027-class-of-2017",
      "title": "Class of 2017 Host Year",
      "tagline": "Road to the 2027 FD Alumni Tournament",
      "description": "...",
      "status": "active",
      "tournament": { "id": "24", "year": 2027, "name": "...", "startDate": "2027-06-25", "endDate": "2027-07-16", "status": "upcoming" },
      "hostClass": { "id": "52", "key": "17", "graduationYear": 2017, "displayName": "Class of 2017", "shortLabel": "'17" },
      "countdownTargetAt": "2027-06-25T18:00:00+10:00",
      "countdownLabel": "Tentative tip-off · Jun 25, 2027",
      "heroImageUrl": null,
      "donationUrl": null,
      "donationInstructions": "...",
      "golfUrl": "https://fd-golf.shimizu-technology.com",
      "meter": {
        "enabled": true,
        "goalCents": 3000000,
        "raisedCents": 520000,
        "percent": 17.3,
        "updatedAt": "2026-11-22T04:00:00Z"
      }
    },
    "events": [ ... ],
    "posts": [ ... ],
    "hafapass": {
      "available": true,
      "stale": false,
      "fetchedAt": "2026-11-22T04:00:00Z",
      "events": [ ... ]
    }
  }
  ```
  - **Privacy invariant:** Public serializer never includes `spentCents`, `netCents`, `fdaaUpfrontCents`, `fdaaTicketShareBps`, `budgetLines`, `pledges`, `ledgerEntries`, or non-public `campaign_events` (`public_visible: false`) or unpublished `campaign_posts` (`published_at IS NULL OR published_at > NOW()`).
- `GET /api/v1/public/home` (additive field): include `activeHostCampaign` summary (`slug`, `title`, `tagline`, `countdownTargetAt`, `countdownLabel`, `meter`, `nextEvent`) so the Home page can feature Host Year during the off-season and shift focus to Today at The Jungle when tournament games are live!

### 3.4 Public UI & Motion (Plan §§4.1, 4.4)

- **Phone bottom navigation bar (`PublicLayout`):**
  - Replace the 10-item mobile-only hamburger-first flow with a fixed mobile bottom bar (`<= 768px`, respecting `env(safe-area-inset-bottom)`): **Home · Schedule · Standings · Host Year (or Tickets when tournament is live) · More**.
  - **More** drawer holds Host Year 2027 / Fundraisers, Today, Watch, Sponsors, History, News, Gallery, Info, and Admin link.
- **Public Host Year page (`/host-year` and `/host-year/:slug`):**
  - Hero with host class crest/title, countdown (days/hours/minutes updated once per minute — no ticking seconds), Donate & Golf CTAs.
  - **`$30K` Fundraising Meter** (`meter.enabled === true`): prints `"Raised $X of $30,000"` in static DOM first so the still page is complete.
    - **Signature moment (one big moment on Host Year):** CSS/rAF bar fill once on entry from real total (`0% → percent`), skipped when `prefers-reduced-motion: reduce` (`useMotionOk()`). No count-up numbers, no animation library.
  - **Fundraiser calendar:** upcoming events first (with HåfaPass live price badge + `"Buy tickets"` `/go/:code` link when matched by `hafapass_event_slug`, or `"Register for Golf"` card for `kind: "golf"`), past completed fundraisers below. Supporting scroll-reveal timeline (`reveal-on-scroll.tsx`, CSS opacity/transform only, still fallback).
  - **Class news & updates:** pinned posts first, reverse chronological.
- **Hub Home (`/`) motion:** one restrained hero headline/photo reveal (skipped on short screens & reduced motion); Today and Schedule cards stay completely still.
- **All operational / admin / finance pages:** zero decorative motion.

---

## 4. Milestone A3: Finance Tracker & Campaign Roles

### 4.1 Database tables

#### `campaign_memberships`
Board roles scoped to a specific `host_campaign` (so CO2017 board members only access the 2027 campaign, and CO2018 gets its own board in 2028).

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :cascade`), `NOT NULL` |
| `user_id` | `bigint` | FK → `users.id` (`on_delete: :cascade`), `NOT NULL` |
| `role` | `string` | `NOT NULL` (`chair`, `treasurer`, `board`) |
| `active` | `boolean` | `NOT NULL`, default `true` |
| `invited_by_id` | `bigint` | FK → `users.id` (`on_delete: :nullify`), nullable |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes: `UNIQUE (host_campaign_id, user_id)`, `INDEX (user_id, active)`.

#### `admin_whitelists` (additive columns for email invites)
Allows global admins to invite board members by email before their first Clerk sign-in (matching Plan §4.2):
- `host_campaign_id` (`bigint`, nullable, FK → `host_campaigns.id`, `on_delete: :nullify`)
- `campaign_role` (`string`, nullable, validated in `%w[chair treasurer board]` when `host_campaign_id` present)
- On first Clerk sign-in in `ClerkAuthenticatable#find_or_create_user`, if `whitelist.host_campaign_id` and `whitelist.campaign_role` are set, atomically find-or-create the user's `CampaignMembership` (with `User.role = whitelist.role`, typically `"viewer"` for board-only members who shouldn't touch tournament ops!).

#### `budget_lines`
Planned income and expense categories per campaign.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :cascade`), `NOT NULL` |
| `kind` | `string` | `NOT NULL` (`income`, `expense`) |
| `category` | `string` | `NOT NULL` (e.g. `"Beer & consumables"`, `"Banners & decals"`, `"Shirts & merch"`, `"Host-night food"`, `"Raffle prizes"`, `"Fundraiser events"`, `"Sponsorships"`, `"Golf tournament"`, `"Other"`) |
| `budget_cents` | `bigint` | `NOT NULL`, default `0`, check `>= 0` |
| `position` | `integer` | `NOT NULL`, default `0` |
| `notes` | `text` | Nullable |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes: `UNIQUE (host_campaign_id, kind, LOWER(category))`.

#### `pledges`
Tracks promised sponsor or donor commitments vs received income.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :cascade`), `NOT NULL` |
| `sponsor_id` | `bigint` | FK → `sponsors.id` (`on_delete: :nullify`), nullable |
| `donor_name` | `string` | `NOT NULL` |
| `contact_info` | `string` | Nullable (email/phone/board lead contact) |
| `tier` | `string` | Nullable (`Diamond`, `Platinum`, `Gold`, `Silver`, `Donor`, `In-Kind`) |
| `promised_cents` | `bigint` | `NOT NULL`, check `> 0` |
| `due_on` | `date` | Nullable |
| `status` | `string` | `NOT NULL`, default `"promised"` (`promised`, `partial`, `fulfilled`, `cancelled`) |
| `notes` | `text` | Nullable |
| `recorded_by_id` | `bigint` | FK → `users.id` (`on_delete: :nullify`), nullable |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Notes:
- `received_cents` is computed dynamically as `SUM(ledger_entries.amount_cents)` where `pledge_id = pledge.id AND entry_type = 'income' AND voided_at IS NULL` (single source of truth; no stale cached counter).
- Whenever a linked income entry is created/updated/voided, `Pledge#sync_fulfillment_status!` auto-updates `status` between `promised` (`0`), `partial` (`0 < received < promised`), and `fulfilled` (`received >= promised`) unless explicitly `cancelled`.

#### `ledger_entries`
Every dollar in and out of the host campaign. **Never hard-deleted — voided only.**

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :cascade`), `NOT NULL` |
| `entry_type` | `string` | `NOT NULL` (`income`, `expense`) |
| `amount_cents` | `bigint` | `NOT NULL`, check `> 0` |
| `entry_date` | `date` | `NOT NULL` |
| `budget_line_id` | `bigint` | FK → `budget_lines.id` (`on_delete: :nullify`), nullable |
| `campaign_event_id` | `bigint` | FK → `campaign_events.id` (`on_delete: :nullify`), nullable |
| `sponsor_id` | `bigint` | FK → `sponsors.id` (`on_delete: :nullify`), nullable |
| `pledge_id` | `bigint` | FK → `pledges.id` (`on_delete: :nullify`), nullable |
| `source` | `string` | `NOT NULL` (`fundraiser_net`, `sponsorship`, `donation`, `fdaa_allocation`, `ticket_share`, `merch`, `golf_net`, `expense`, `other`) |
| `payment_method` | `string` | `NOT NULL` (`cash`, `paypal`, `check`, `bank_transfer`, `fdaa`, `hafapass_payout`, `golf_payout`, `card`, `other`) |
| `counterparty` | `string` | `NOT NULL` (vendor, sponsor, donor, or `"Shimizu Technology / HåfaPass"`) |
| `description` | `text` | Nullable |
| `reference_number` | `string` | Nullable (check #, Bank of Guam deposit ref, HåfaPass payout ref, PayPal tx) |
| `paid_by` | `string` | Nullable (board member who paid out of pocket, e.g. `"Noah Peredo"`) |
| `reimbursement_status` | `string` | `NOT NULL`, default `"not_applicable"` (`not_applicable`, `requested`, `approved`, `reimbursed`) |
| `reimbursed_at` | `date` | Nullable |
| `reimbursement_reference` | `string` | Nullable (check # or transfer ref paying member back) |
| `receipt_key` | `string` | Nullable (private S3 key under `receipts/<campaign_id>/...`; NEVER a public URL) |
| `receipt_filename` | `string` | Nullable |
| `receipt_content_type` | `string` | Nullable (`image/*` or `application/pdf`) |
| `receipt_byte_size` | `integer` | Nullable |
| `recorded_by_id` | `bigint` | FK → `users.id` (`on_delete: :nullify`), `NOT NULL` |
| `approved_by_id` | `bigint` | FK → `users.id` (`on_delete: :nullify`), nullable |
| `voided_at` | `datetime` | Nullable |
| `voided_by_id` | `bigint` | FK → `users.id` (`on_delete: :nullify`), nullable |
| `void_reason` | `string` | Nullable (required when `voided_at` is set) |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Model & DB invariants:
- `budget_line`, `campaign_event`, and `pledge` must belong to the same `host_campaign_id`; `sponsor` must belong to `host_campaign.tournament_id`.
- `reimbursement_status` must be `"not_applicable"` on `income` entries.
- Voiding sets `voided_at`, `voided_by`, and requires non-blank `void_reason`. Once voided, an entry is immutable (cannot be edited or un-voided; record a new entry for corrections).
- Indexes: `INDEX (host_campaign_id, voided_at, entry_date)`, `INDEX (host_campaign_id, entry_type, voided_at)`, `INDEX (pledge_id, voided_at)`, `INDEX (host_campaign_id, reimbursement_status, voided_at)`.

### 4.2 Role-Based Access Control (RBAC)

New namespace `Api::V1::Campaign::BaseController < Api::V1::BaseController`:
- Runs `authenticate_user!` (does **not** require `User#staff?`, so board members with `User.role = "viewer"` can authenticate cleanly without gaining access to `/api/v1/admin/*` tournament ops!).
- Resolves `@campaign = HostCampaign.find_by!(slug: params[:campaign_slug])` (or by ID).
- Helper `require_campaign_role!(*allowed_roles)`:
  - Global `current_user.admin?` is always authorized (super-admin).
  - Otherwise requires an active `CampaignMembership` for `(host_campaign: @campaign, user: current_user)` whose `role` is in `allowed_roles`.
  - Returns `403 Forbidden` if authenticated without the required role; `401 Unauthorized` if unauthenticated.
- `/api/v1/me` adds `campaignMemberships: [{ campaignId, campaignSlug, campaignTitle, role }]` so the frontend immediately knows which admin sections to show and where to land the user!

| Capability / Endpoint group | Anonymous | Tournament `staff` (no membership) | Campaign `board` | Campaign `chair` | Campaign `treasurer` | Global `admin` |
| --- | --- | --- | --- | --- | --- | --- |
| Public `/api/v1/public/host-year` (meter raised/goal only) | Read | Read | Read | Read | Read | Read |
| Campaign overview & finance summary (totals, budget vs actual) | 401 | 403 | Read | Read | Read | Read |
| View ledger, pledges, budget lines, private receipt URL, CSV export | 401 | 403 | Read | Read | Read | Read |
| Edit Host Year page, events, news posts | 401 | 403 | 403 | **CRUD** | Read | **CRUD** |
| Create/edit/void ledger entries, budget lines, pledges, upload receipts, approve/mark reimbursements | 401 | 403 | 403 | 403 | **CRUD** | **CRUD** |
| Create/archive campaigns & manage `campaign_memberships` / `admin_whitelists` | 401 | 403 | 403 | 403 | 403 | **CRUD** |
| Tournament ops (`/api/v1/admin/*` games, scores, links) | 401 | **Staff** | 403 | 403 | 403 | **Admin** |

### 4.3 Private Receipt Storage (`PrivateReceiptStorage`)

- **Prefix isolation:** keys always live under `receipts/<campaign_id>/<timestamp>-<hex>-<safe_filename>`.
- **Bucket config:** reads `S3_PRIVATE_BUCKET` (falling back to `S3_BUCKET` when a single bucket enforces a bucket policy that allows public `GetObject` only on `articles/*`, `media/*`, `sponsors/*`, `ingest/*`, `campaigns/*` and blocks public reads on `receipts/*`). Document the exact S3 bucket policy in `docs/S3-UPLOAD-SETUP.md` during A3.
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`; max `15.megabytes` (`S3_RECEIPT_UPLOAD_MAX_BYTES`).
- **Upload flow:** `POST /api/v1/campaign/:campaign_slug/receipts/presign` (`treasurer` / `admin` only) returns a short-lived (60s) SigV4 presigned POST targeting `receipts/<campaign_id>/...` (no `publicUrl` returned!). Client uploads directly to S3, then saves `receiptKey` + metadata on the `ledger_entry`.
- **Download/view flow:** `GET /api/v1/campaign/:campaign_slug/ledger-entries/:id/receipt-url` (`board` / `chair` / `treasurer` / `admin`) verifies the entry belongs to `@campaign`, checks `receipt_key` starts with `"receipts/#{@campaign.id}/"`, and returns a SigV4 presigned GET URL with `expiresIn: 120` seconds and `ResponseContentDisposition: inline; filename="..."`.

### 4.4 Finance Totals, Reimbursements & CSV Export

- **`Campaign::FinanceSummary.call(campaign)`** (pure integer cents):
  - `goalCents`: `campaign.goal_cents`
  - `raisedCents`: sum of non-voided `income` entries
  - `raisedExcludingFdaaCents`: sum of non-voided `income` where `source NOT IN ('fdaa_allocation', 'ticket_share')`
  - `spentCents`: sum of non-voided `expense` entries
  - `netCents`: `raisedCents - spentCents`
  - `stillNeededCents`: `[goalCents - raisedCents, 0].max`
  - `publicMeterRaisedCents`: `campaign.include_fdaa_in_public_meter? ? raisedCents : raisedExcludingFdaaCents`
  - `pledgedTotalCents`, `pledgedReceivedCents`, `outstandingPledgesCents` (sum of `max(promised_cents - received_cents, 0)` across non-cancelled pledges)
  - `pendingReimbursementsCents`, `pendingReimbursementsCount`
  - `bySource`: totals per `source` (showing Antigu fundraiser net, sponsors, donations, golf, HåfaPass payouts, FDAA allocation, etc.)
  - `byMethod`: totals per `payment_method` (making cash/PayPal vs Bank of Guam check transfers transparent so personal-PayPal balances get reconciled cleanly!)
  - `budgetVsActual`: array of `{ budgetLineId, kind, category, budgetCents, actualCents, varianceCents }`
- **CSV Export (`GET /api/v1/campaign/:campaign_slug/ledger-entries/export.csv`):**
  - UTF-8 with BOM, formula-injection-safe CSV cells (prefix leading `=`, `+`, `-`, `@`, `\t`, `\r` with `'`), includes date, type, source, category, counterparty, method, reference, amount (dollars), paid_by, reimbursement_status, reimbursed_at, recorded_by, approved_by, voided_at, void_reason, and `has_receipt` (`yes`/`no` — never embeds expiring signed URLs in CSVs).

### 4.5 Admin Workspace by Role (Plan §4.1)

When signed in to `/admin`:
- `AdminLayout` accepts any user where `user.isStaff || user.campaignMemberships.length > 0`, and routes/lands them on their primary workspace:
  - **Money** (`treasurer`, `board`, `chair` read-only, `admin`): `/admin/campaign/finance` — overview cards ("Raised $X of $30K", "Net after expenses $Y", "Still needed", "Outstanding pledges", "Pending reimbursements"), mobile-first quick-add Income / Expense (with phone camera receipt upload!), Budget vs Actual, Pledges, Reimbursements queue, CSV export.
  - **Host Year** (`chair`, `admin`, `treasurer`/`board` read-only): `/admin/campaign/host-year` — campaign settings & countdown, fundraiser events CRUD (with HåfaPass slug & `/go/:code` wiring), class news posts CRUD.
  - **Tournament** (`staff`, `admin`): existing tournament ops sections.
  - **System** (`admin` only): People & Roles UI (`admin_whitelists` + `campaign_memberships` management — fixing the console-only allowlist gap!) and archive tools (`Ingest`).

---

## 5. PR-Sized Implementation Slices & Acceptance Checks

Each slice is a small, independently testable, cross-family-reviewed PR:

### Track A2 — Host Year

| Slice | Branch / Scope | Acceptance checks |
| --- | --- | --- |
| **A2.1** | `agent/hub-a2-1-campaigns-schema-api` — Migrations & models for `host_campaigns`, `campaign_events`, `campaign_posts`, `campaign_memberships`, `admin_whitelists` campaign invite columns; `Api::V1::Campaign::BaseController` + `require_campaign_role!`; public `GET /api/v1/public/host-year` & additive `activeHostCampaign` on `/public/home`; campaign content admin endpoints (`chair`/`admin`); `/api/v1/me` returning `campaignMemberships`. | Request specs cover anonymous, viewer, staff-without-membership (403), board (read-only), chair (content CRUD, 403 on admin-only), treasurer (read content), admin (full); public endpoint never leaks unpublished posts, private events, or financial internals; single-active-campaign DB constraint enforced; CI green. |
| **A2.2** | `agent/hub-a2-2-hafapass-client` — `Hafapass::EventsClient` (server-side fetch of `GET /api/v1/events?organizer=<slug>&per_page=50&include_sold_out=true`, 5-min cache + stale fallback + timeouts + `/go/:code` URL builder); merged into `/api/v1/public/host-year` response. | Unit & controller tests stub HåfaPass HTTP (live success, sold-out badge, cache hit, timeout/500 stale fallback, cold failure returning `available: false` without 500ing the hub); zero auth headers sent to HåfaPass. |
| **A2.3** | `agent/hub-a2-3-public-host-year-ui` — Public `/host-year` & `/host-year/:slug` page (countdown, `$30K` meter with single signature fill animation + `prefers-reduced-motion` fallback, fundraiser calendar with HåfaPass live price/status & `/go/:code` Buy links, Golf card, Donate CTA, class news); Home page off-season Host Year feature; mobile bottom nav bar (`Home · Schedule · Standings · Host Year/Tickets · More`). | Playwright desktop (1280×800) + mobile (390×844) QA with API ON and API OFF (graceful section degradation + retry); `prefers-reduced-motion` renders final meter width immediately; Impeccable scan clean; zero animation library added. |
| **A2.4** | `agent/hub-a2-4-chair-admin-ui` — `/admin/campaign/host-year` workspace for `chair` & `admin` (campaign settings/countdown/meter toggle, fundraiser events CRUD, class news posts CRUD, S3 hero/event/post image upload) + System → People & Roles UI (`admin` only) for managing `admin_whitelists` and `campaign_memberships`. | Browser QA verifies `chair` can manage Host Year content while tournament ops & finance write controls stay hidden; `admin` can invite board member by email and assign `chair`/`treasurer`/`board`; board-only invitee signs in without getting tournament staff access. |

### Track A3 — Finance Tracker

| Slice | Branch / Scope | Acceptance checks |
| --- | --- | --- |
| **A3.1** | `agent/hub-a3-1-finance-schema-api` — Migrations & models for `budget_lines`, `pledges`, `ledger_entries`; `Campaign::FinanceSummary`; full RBAC-enforced `Api::V1::Campaign::{Finance,BudgetLines,Pledges,LedgerEntries}Controller` (including void-only workflow, reimbursement transitions, pledge auto-status sync, CSV export); public meter wired to real `FinanceSummary` totals! | Request specs verify `treasurer` CRUD, `chair`/`board` read-only (403 on every write/void), `staff` without membership (403 on read & write), `anonymous` (401); hard delete rejected; voided entries excluded from totals and public meter; CSV formula-injection test passes; cross-campaign ID injection rejected (404/422). |
| **A3.2** | `agent/hub-a3-2-private-receipts` — `PrivateReceiptStorage` (private S3 presigned upload for images + PDFs up to 15 MB, short-lived 120s presigned GET gated by `require_campaign_role!`), updated `docs/S3-UPLOAD-SETUP.md` bucket policy for private `receipts/*` prefix. | Controller & service specs verify `treasurer`/`admin` can presign uploads, `board`/`chair` cannot presign uploads (403) but can request signed GET URLs, non-members get 403, invalid MIME/oversized files get 400, cross-campaign `receipt_key` rejected, and public URL is never emitted. |
| **A3.3** | `agent/hub-a3-3-finance-ui` — Mobile-first `/admin/campaign/finance` workspace: overview ("Raised $X of $30K" + "Net after expenses $Y" + still needed + pledges + reimbursements), quick-add Income & Expense forms (phone camera/PDF receipt upload, void flow with reason), Budget vs Actual table, Pledges tracker, Reimbursements tab, CSV export button. | Playwright mobile (390×844) + desktop QA: treasurer logs income + expense with receipt, voids an entry, marks reimbursement paid, downloads CSV; board/chair sees read-only view with zero write buttons; meter on public `/host-year` reflects live total while hiding expenses. |

---

## 6. Fallbacks & Open Board Decisions (Plan §§6, 9)

- **Fallbacks if schedule tightens (§6):**
  - Pledges and reimbursement approval workflow can stay deferred while plain income/expense entries + receipt uploads + CSV export ship first (A3.1/A3.3 cleanly support plain income/expense even with zero pledges).
  - If HåfaPass `CO2017` org isn't created yet, `campaign_events.external_url` works immediately for any fundraiser link or flyer.
- **Board answers to plug into campaign settings once confirmed (§9 — none block building):**
  1. Named `chair`, `treasurer`, and 1–2 `board` emails → entered via the new People & Roles admin UI.
  2. Donation channel (`donation_url` / `donation_instructions`): class Bank of Guam account vs FDAA 501(c)(3) for tax receipts → stored as campaign settings.
  3. Whether the `$30K` goal includes FDAA's `$15K` and 16% ticket share, and raised vs net → handled by `include_fdaa_in_public_meter` toggle + showing both Raised and Net on the board dashboard.
  4. Class slogan/theme, Mar 6 Bryan Ho 5K/beer mile details, May golf date, and Nov 20 Antigu fundraiser final numbers → entered directly through the Host Year & Finance admin screens once live.
