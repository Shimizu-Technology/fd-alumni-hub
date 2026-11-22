# FD Alumni Hub — Host Year (A2) & Finance Tracker (A3) Design

- **Date:** 2026-11-22
- **Verified baseline:** `origin/main` (`c570d15`) + PR #51 A1 Foundations (`agent/hub-a1-foundations`, commit `657d563`)
- **Owner:** FD Alumni Hub project lead for Leon Shimizu (Shimizu Technology)
- **Out-of-repo planning context:** Program plan v5 (`fd-co2017-host-year-plan-2026-11-21.md`) and HåfaPass readiness contract (`HafaPass` PR #201 `docs/FD_TOURNEY_2027_READINESS.md` §2)

---

## 1. Goals & Architectural Invariants

1. **Reusable across every host class.** Every fundraiser, update, pledge, budget line, ledger entry, and board role hangs off a `host_campaigns` record linked to `(tournament_id, class_cohort_id)`. Class of 2017 hosts 2027; Class of 2018 hosts 2028 using the same models, pages, and workflows with **zero** hardcoded class names, years, or dollar goals.
2. **One front door; the hub never takes cards.** Every flyer, Instagram bio, and WhatsApp post points to `fd-alumni.shimizu-technology.com` (and later the class's own domain).
   - Tournament and fundraiser tickets sell on **HåfaPass** (`hafapass.shimizu-technology.com`), read server-side from HåfaPass's public events API and linked via per-event `/go/:code` attribution links or `/events/:slug`.
   - Golf registration and golf sponsorships live on the separate **Golf Platform** (`fd-golf.shimizu-technology.com`); the hub links to it and records golf totals in the ledger.
   - Direct donations link out to the board-chosen channel (`donation_url` or offline instructions).
3. **Strict financial privacy by default.** `public_meter_enabled` defaults to `false`. When enabled, public visitors see **only** the campaign fundraising meter (`enabled`, `goalCents`, `raisedCents`, `percent`, `goalReached`, `updatedAt`). When disabled, the public payload returns `{ "enabled": false }` and omits all monetary fields. Expenses, net balance, pledges, receipts, reimbursements, and individual counterparties stay strictly behind authenticated campaign-board roles (`chair`, `treasurer`, `board`) and global `admin`.
4. **Immutable, auditable financial history.** Campaigns, finance records, and ledger entries are **never hard-deleted** (`on_delete: :restrict` across the entire tournament → campaign → finance chain). Ledger entries are void-only with immutable monetary fields, and every finance/membership/settings/receipt action writes an append-only row to `finance_audit_events` in the same transaction.
5. **Offline-safe while the Render API is paused.** Merging to `main` deploys the public Netlify site immediately (for frontend changes). All new public routes (`/host-year`, `/host-year/:slug`) follow A1's per-section degradation pattern so visitors get clear notices + retry (and intact static navigation/history) whenever the API is unavailable.
6. **Existing schema & timezone conventions.** Match `api/db/schema.rb`: bigint primary keys, integer cents (`*_cents`), snake_case DB columns, camelCase JSON API responses, UTC timestamps in DB, and **Guam calendar dates (`Pacific/Guam`, UTC+10)** for default `entry_date`, pledge `due_on` comparisons, and display formatting.

---

## 2. Verified Current Schema & A1 Hooks

Checked against `api/db/schema.rb` at `657d563`:

- **`tournaments`**: `id`, `year`, `name`, `start_date` (`date`, `NOT NULL`), `end_date` (`date`, `NOT NULL`), `status` (`upcoming`/`live`/`completed`/`cancelled`). Unique index on `(year, name)`.
  - **Future-year tournament creation note:** `Tournament.active_for_public` falls back to an `upcoming` tournament when no `live` or `completed` tournament matches. When creating a placeholder future tournament row (e.g., 2028) early so the incoming class can draft its campaign, keep the active/completed current tournament intact and ensure `Tournament.active_for_public` prefers `live`, then latest `completed`, then earliest `upcoming` with games before falling back to an empty placeholder.
- **`class_cohorts`**: `id`, `key` (unique, e.g. `"17"`), `graduation_year` (unique, e.g. `2017`), `display_name` (`"Class of 2017"`), `short_label` (`"'17"`).
- **`users`**: `id`, `email` (unique lower), `clerk_id` (unique), `first_name`, `last_name`, `role` (`admin`/`staff`/`viewer`), `active`. Users are deactivated (`active = false`), never hard-deleted.
- **`admin_whitelists`**: `id`, `email` (unique lower), `role` (`admin`/`staff`/`viewer`), `active`, `notes`. Remains strictly for global tournament roles (campaign invites use a dedicated `campaign_invitations` table).
- **`sponsors`**: `id`, `tournament_id`, `name`, `logo_url`, `target_url`, `tier`, `active`, `position`. A 2027 tournament sponsor pledged in late 2026 attaches to the 2027 tournament row.
- **`article_links`**: requires `url` (`NOT NULL`, unique per tournament) and models external press links (GSPN, PostGuam, GuamPDN). Native class updates live in `campaign_posts`.
- **`PublicImageUploadPresigner`**: signs **public** image-only S3 POSTs under `S3_PUBLIC_BASE_URL` (currently `articles/*`, `media/*`, `sponsors/*`, `ingest/*`, `admin/*`). Extended in A2.1b with a `campaigns` purpose (`campaigns/<campaign_id>/...`). Finance receipts use a separate **private** bucket (`S3_PRIVATE_BUCKET`) and presigner (`PrivateReceiptStorage`).

---

## 3. Milestone A2: Host Year (Data Model, HåfaPass Contract, API & Public UI)

### 3.1 Database tables

#### `host_campaigns`
One campaign per tournament edition (`tournament_id` unique), hosted by one `class_cohort_id`. Campaigns are archived, never hard-deleted.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `tournament_id` | `bigint` | FK → `tournaments.id` (`on_delete: :restrict`), `NOT NULL`, unique index |
| `class_cohort_id` | `bigint` | FK → `class_cohorts.id` (`on_delete: :restrict`), `NOT NULL`, indexed |
| `slug` | `string` | `NOT NULL`, unique index, format `\A[a-z0-9-]{3,64}\z` (e.g. `"2027-class-of-2017"`) |
| `title` | `string` | `NOT NULL` (e.g. `"Class of 2017 Host Year"`) |
| `tagline` | `string` | Nullable |
| `description` | `text` | Nullable, public intro copy |
| `status` | `string` | `NOT NULL`, default `"draft"`, CHECK IN `('draft', 'active', 'closing', 'archived')` |
| `featured` | `boolean` | `NOT NULL`, default `false` (marks the default campaign rendered at `/host-year`) |
| `goal_cents` | `bigint` | `NOT NULL`, **no hardcoded default**, CHECK `> 0` |
| `countdown_target_at` | `datetime` | Nullable (falls back to `tournament.start_date` 6:00 PM Guam if nil) |
| `countdown_label` | `string` | Nullable (e.g. `"Tentative tip-off · Jun 25, 2027"`) |
| `hero_image_url` | `string` | Nullable (`https://` validated) |
| `donation_url` | `string` | Nullable (`https://` validated + optional `DONATION_URL_ALLOWED_HOSTS` allowlist; **admin-only** write) |
| `donation_instructions` | `text` | Nullable (offline/check/Bank of Guam instructions; **admin-only** write) |
| `golf_url` | `string` | Nullable (`https://` validated, e.g. `"https://fd-golf.shimizu-technology.com"`) |
| `hafapass_organizer_slug` | `string` | Nullable, format `\A[a-z0-9_-]{1,64}\z` (e.g. `"co2017"`) |
| `hafapass_tournament_organizer_slug` | `string` | Nullable, format `\A[a-z0-9_-]{1,64}\z` (e.g. `"fdaa"`) |
| `hafapass_distribution_code` | `string` | Nullable, format `\A[a-z0-9_-]{1,64}\z` (used **only** for a campaign-level `"All tickets"` CTA if configured; never stamped onto unrelated events) |
| `fdaa_upfront_cents` | `bigint` | `NOT NULL`, default `0`, CHECK `>= 0` (reference allocation, configured per host year) |
| `fdaa_ticket_share_bps` | `integer` | `NOT NULL`, default `0`, CHECK `0..10000` (configured per host year, e.g. `1600` = 16.00%) |
| `public_meter_enabled` | `boolean` | `NOT NULL`, default **`false`** (privacy by default; toggled on once books are ready) |
| `include_fdaa_in_public_meter` | `boolean` | `NOT NULL`, default `false` (controls whether `fdaa_allocation` / `ticket_share` income counts in the public meter numerator) |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes & DB constraints:
- `UNIQUE (tournament_id)`
- `UNIQUE (slug)`
- Partial unique index: `UNIQUE (featured) WHERE featured = true` — guarantees at most one featured campaign for `/host-year` while allowing simultaneous rollover (`2027` in `closing` reconciling late payouts while `2028` is `active` and `featured: true`!).
- CHECK constraint: `NOT featured OR status IN ('active', 'closing')` (draft or archived campaigns cannot be featured).
- Lifecycle rules:
  - `draft`: visible only to authenticated campaign members and global `admin`; never exposed on public endpoints (`404`).
  - `active`: publicly visible; content & finance writes enabled.
  - `closing`: publicly visible (e.g. post-tournament wrap-up); finance writes stay enabled for late HåfaPass payouts/reimbursements while the next host class can already be `active` + `featured`.
  - `archived`: publicly visible as historical record; **read-only** for all campaign roles (outgoing board keeps read-only access for handoff/audits; admins can deactivate individual memberships anytime). Any admin break-glass write requires an explicit reason and writes to `finance_audit_events`.

#### `campaign_events`
Fundraisers, host nights, golf tournament, and board meetings attached to a `host_campaign`. Archived (`archived_at`) instead of hard-deleted so linked ledger entries keep intact per-event history.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :restrict`), `NOT NULL` |
| `kind` | `string` | `NOT NULL`, default `"fundraiser"`, CHECK IN `('fundraiser', 'host_night', 'golf', 'merch_drop', 'meeting', 'other')` |
| `title` | `string` | `NOT NULL` |
| `starts_at` | `datetime` | Nullable (TBA events allowed) |
| `ends_at` | `datetime` | Nullable |
| `date_label` | `string` | Nullable (human fallback when `starts_at` is TBA, e.g. `"May 2027 (TBA)"`) |
| `venue` | `string` | Nullable |
| `description` | `text` | Nullable |
| `image_url` | `string` | Nullable (`https://` validated) |
| `hafapass_event_id` | `string` | Nullable, format `\A[a-zA-Z0-9_-]{1,64}\z` (primary stable key for matching HåfaPass events even if slugs are renamed) |
| `hafapass_event_slug` | `string` | Nullable, format `\A[a-z0-9_-]{1,64}\z` (display / fallback match) |
| `hafapass_distribution_code` | `string` | Nullable, format `\A[a-z0-9_-]{1,64}\z` (per-event `/go/:code` link) |
| `external_url` | `string` | Nullable (`https://` validated, e.g. `https://fd-golf.shimizu-technology.com`) |
| `cta_label` | `string` | Nullable (e.g. `"Buy tickets"`, `"Register foursome"`) |
| `status` | `string` | `NOT NULL`, default `"planned"`, CHECK IN `('planned', 'open', 'sold_out', 'completed', 'cancelled')` |
| `public_visible` | `boolean` | `NOT NULL`, default `true` (`false` for internal board meetings) |
| `goal_cents` | `bigint` | Nullable, CHECK `>= 0` (internal event goal; never serialized publicly) |
| `position` | `integer` | `NOT NULL`, default `0` |
| `archived_at` | `datetime` | Nullable (soft-archive; archived events excluded from public list and new ledger pickers, preserved on historical entries) |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes: `INDEX (host_campaign_id, archived_at, public_visible, starts_at, position)`.

#### `campaign_posts`
Class announcements and fundraising recaps (separate from external `article_links`).

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :restrict`), `NOT NULL` |
| `author_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), nullable |
| `title` | `string` | `NOT NULL` |
| `body` | `text` | `NOT NULL` (plain text / paragraphs; rendered as text nodes, never `dangerouslySetInnerHTML`) |
| `image_url` | `string` | Nullable (`https://` validated) |
| `published_at` | `datetime` | Nullable (`nil` = draft; `<= Time.current` = publicly visible) |
| `pinned` | `boolean` | `NOT NULL`, default `false` |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes: `INDEX (host_campaign_id, pinned, published_at)`.

#### `hafapass_event_snapshots`
Persistent PostgreSQL cache for HåfaPass public events (because `api/config/environments/production.rb` uses `:memory_store`, which is lost on Render restarts/cold starts — exactly when HåfaPass may also be cold).

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `organizer_slug` | `string` | `NOT NULL`, unique index |
| `payload_json` | `jsonb` | `NOT NULL`, default `[]` (normalized public display fields only) |
| `fetched_at` | `datetime` | Nullable (last successful fetch) |
| `refreshing_until` | `datetime` | Nullable (stampede/pile-up lease lock) |
| `last_error` | `string` | Nullable (truncated error summary for ops debugging) |
| `last_error_at` | `datetime` | Nullable |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

### 3.2 HåfaPass Server-Side Events Integration

Aligned with HåfaPass PR #201 (`docs/FD_TOURNEY_2027_READINESS.md` §2):

- **Env vars on Hub Rails API:**
  - `HAFAPASS_API_BASE_URL` (default `https://hafapass-api.onrender.com/api/v1`)
  - `HAFAPASS_WEB_BASE_URL` (default `https://hafapass.shimizu-technology.com`)
  - `HAFAPASS_EVENTS_CACHE_TTL_SECONDS` (default `300`, i.e. 5 minutes)
- **Service `Hafapass::EventsClient` + job `Hafapass::RefreshEventsJob`:**
  - Query string built via `URI.encode_www_form(organizer: slug, per_page: 50, page: page, include_sold_out: "true")` with **no** auth headers (`open_timeout: 2`, `read_timeout: 3`), following pagination up to 3 pages (150 events max).
  - **Non-blocking public read path:** `GET /api/v1/public/host-year` reads `hafapass_event_snapshots` directly and **never** blocks for multi-second upstream calls when a snapshot exists.
    - If `fetched_at` is fresh (`<= TTL`): serve immediately (`stale: false`).
    - If `fetched_at` is expired (`> TTL`): serve the last good snapshot immediately with `stale: true` and enqueue `Hafapass::RefreshEventsJob` (acquiring `refreshing_until = 60.seconds.from_now` via atomic conditional `UPDATE` to prevent pile-ups).
    - If no snapshot exists yet: enqueue refresh and return `{ available: false, stale: false, fetchedAt: nil, events: [] }` (or attempt one bounded `1.5s` fetch for a single slug on first boot, never failing the page).
  - `/api/v1/public/home` NEVER triggers synchronous HåfaPass HTTP fetches; it reads only local `host_campaigns` + `campaign_events`.
  - Malformed JSON or unexpected payload shape is treated as a refresh error, preserving the prior good snapshot (`stale: true`) or returning `available: false`.
  - **Normalized fields exposed per HåfaPass event (strict whitelist — never leaks internal organizer fields):**
    - `id` (string), `slug`, `title`, `shortDescription`, `startsAt`, `endsAt`, `venueName`, `venueCity`
    - `ticketState`: explicit enum derived from HåfaPass status & ticket types:
      - `"cancelled"` if HåfaPass event `status == "cancelled"`
      - `"sold_out"` if active ticket types exist and all have `quantity_remaining == 0`
      - `"on_sale"` if `purchasable == true`
      - `"upcoming"` if event is published/future and sales have not opened yet
      - `"sales_ended"` otherwise (never lumps "not on sale yet" or "cancelled" into `sold_out`)
    - `minAllInPriceCents` (omitted / `null` when `stale: true`), `ticketTypes` (omitted when `stale: true` so visitors see `"Check availability on HåfaPass"` rather than stale remaining counts)
    - `buyUrl`:
      - If matched to a `campaign_event` with `hafapass_distribution_code`: `#{HAFAPASS_WEB_BASE_URL}/go/#{code}`
      - Otherwise: `#{HAFAPASS_WEB_BASE_URL}/events/#{event.slug}` (never blindly applies a campaign-level code to unrelated events).
  - **Matching, precedence, and dedupe:**
    - Match `campaign_events` to HåfaPass events by `hafapass_event_id` first, falling back to `hafapass_event_slug`.
    - Status precedence: manual `campaign_events.status == "cancelled"` always wins; otherwise non-stale live HåfaPass `ticketState` (`on_sale`, `sold_out`, `upcoming`, `sales_ended`, `cancelled`) drives the badge.
    - Dedupe: matched HåfaPass events enrich their `campaign_event` card and are excluded from the unmatched `hafapass.events` list so no fundraiser appears twice.

### 3.3 Public API Endpoints (A2)

- `GET /api/v1/public/host-year` (optional `?slug=` or `?year=`):
  - Strictly excludes `status = 'draft'` (returns `404`).
  - Default resolution (no query param): `HostCampaign.where(featured: true, status: %w[active closing]).first` → fallback to latest `status: %w[active closing]` → fallback to latest `archived` campaign.
  - `?year=` resolves via `HostCampaign.joins(:tournament).where(tournaments: { year: year }, status: %w[active closing archived]).order(featured: :desc, updated_at: :desc).first!`.
  - When `public_meter_enabled == false`, `campaign.meter` is strictly `{ "enabled": false }` (no `goalCents`, `raisedCents`, `percent`, `updatedAt`).
  - When `public_meter_enabled == true`, `campaign.meter` is `{ "enabled": true, "goalCents": ..., "raisedCents": ..., "percent": ..., "goalReached": ..., "updatedAt": ... }` (where `percent` is clamped to `0..100` for bar display while `goalReached: raisedCents >= goalCents`).
  - **Privacy invariant:** Public serializer never includes `spentCents`, `netCents`, `fdaaUpfrontCents`, `fdaaTicketShareBps`, `goalCents` on events, `budgetLines`, `pledges`, `ledgerEntries`, non-public `campaign_events` (`public_visible: false`), archived `campaign_events`, or unpublished `campaign_posts` (`published_at IS NULL OR published_at > NOW()`).
- `GET /api/v1/public/home` (additive field): includes `activeHostCampaign` summary (`slug`, `title`, `tagline`, `countdownTargetAt`, `countdownLabel`, `meter` following the same privacy rules, `nextEvent` from local `campaign_events`).

### 3.4 Public UI & Motion

- **Public Host Year page (`/host-year` and `/host-year/:slug`):**
  - Hero with host class title/tagline, countdown (days/hours/minutes updated once per minute — no ticking seconds), Donate & Golf CTAs (rendering `https://` URLs only).
  - **Fundraising Meter** (rendered **only** when `campaign.meter.enabled === true`; hidden during A2.3 before A3.1 wires real totals): prints `"Raised $X of $Y"` dynamically formatted from `goalCents` in static DOM first, with a `"Goal reached"` badge when `goalReached` is true.
    - **Signature moment (one big moment on Host Year):** CSS/rAF bar fill once on entry (`0% → clampedPercent`), skipped when `prefers-reduced-motion: reduce` via a new `web/src/hooks/useMotionOk.ts` hook. No count-up numbers, no animation library.
  - **Fundraiser calendar:** upcoming events first (with HåfaPass live price/status badge + `/go/:code` or `/events/:slug` Buy link, or `"Check availability on HåfaPass"` when `stale: true`), past completed fundraisers below. Supporting scroll-reveal timeline via a new `web/src/components/RevealOnScroll.tsx` (CSS opacity/transform only, still fallback).
  - **Class news & updates:** pinned posts first, reverse chronological, rendered as plain text paragraphs.
- **Hub Home (`/`) motion:** one restrained hero headline/photo reveal (skipped on short screens & reduced motion); Today and Schedule cards stay completely still.
- **Mobile bottom navigation bar (`PublicLayout`, separate slice A2.3b):** fixed mobile bottom bar (`<= 768px`, respecting `env(safe-area-inset-bottom)`): **Home · Schedule · Standings · Host Year (or Tickets when tournament is live) · More** drawer.
- **All operational / admin / finance pages:** zero decorative motion.

---

## 4. Milestone A3: Finance Tracker & Campaign Roles

### 4.1 Database tables

#### `campaign_memberships`
Board roles scoped to a specific `host_campaign`. Allows multiple roles per user on the same campaign (e.g. a small board where one officer is both `chair` and `treasurer`).

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :restrict`), `NOT NULL` |
| `user_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), `NOT NULL` |
| `role` | `string` | `NOT NULL`, CHECK IN `('chair', 'treasurer', 'board')` |
| `active` | `boolean` | `NOT NULL`, default `true` |
| `invited_by_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), nullable |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes: `UNIQUE (host_campaign_id, user_id, role)`, `INDEX (user_id, active)`.

#### `campaign_invitations`
Separate email-invite table (leaves `admin_whitelists` dedicated to global tournament roles and fixes the existing-user / multi-campaign invite problem).

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :restrict`), `NOT NULL` |
| `email` | `string` | `NOT NULL` (normalized lowercase & stripped) |
| `role` | `string` | `NOT NULL`, CHECK IN `('chair', 'treasurer', 'board')` |
| `invited_by_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), `NOT NULL` |
| `accepted_at` | `datetime` | Nullable |
| `accepted_by_user_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), nullable |
| `revoked_at` | `datetime` | Nullable |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes & behavior:
- Partial unique index: `UNIQUE (host_campaign_id, LOWER(email), role) WHERE accepted_at IS NULL AND revoked_at IS NULL`.
- `ClerkAuth.fetch_verified_email` inspects Clerk's `email_addresses` array and returns **only** an email whose `verification.status == "verified"`.
- On **every** authentication in `ClerkAuthenticatable` (not just initial user creation!), if the user's Clerk email is verified and matches pending unrevoked `campaign_invitations`, atomically create/activate the corresponding `campaign_memberships` and stamp `accepted_at` / `accepted_by_user_id` (plus write a `finance_audit_events` entry).
- People & Roles UI also supports adding `campaign_memberships` directly for existing `users`.

#### `finance_audit_events`
Append-only audit trail for memberships, campaign settings, receipts, and finance records. Never updated or deleted via API.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :restrict`), `NOT NULL` |
| `actor_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), `NOT NULL` |
| `record_type` | `string` | `NOT NULL` (e.g. `"LedgerEntry"`, `"HostCampaign"`, `"CampaignMembership"`, `"Pledge"`, `"BudgetLine"`) |
| `record_id` | `bigint` | `NOT NULL` |
| `action` | `string` | `NOT NULL` (e.g. `"create"`, `"update"`, `"void"`, `"approve_reimbursement"`, `"mark_reimbursed"`, `"attach_receipt"`, `"view_receipt"`, `"settings_change"`, `"membership_change"`) |
| `changes_json` | `jsonb` | `NOT NULL`, default `{}` |
| `reason` | `string` | Nullable (required for voids and archived break-glass actions) |
| `ip_address` | `string` | Nullable |
| `created_at` | `datetime` | `NOT NULL` |

Indexes: `INDEX (host_campaign_id, created_at DESC)`, `INDEX (record_type, record_id)`.

#### `budget_lines`
Planned income and expense categories per campaign. Soft-archived (`archived_at`) instead of hard-deleted.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :restrict`), `NOT NULL` |
| `kind` | `string` | `NOT NULL`, CHECK IN `('income', 'expense')` |
| `category` | `string` | `NOT NULL` |
| `budget_cents` | `bigint` | `NOT NULL`, default `0`, CHECK `>= 0` |
| `position` | `integer` | `NOT NULL`, default `0` |
| `notes` | `text` | Nullable |
| `archived_at` | `datetime` | Nullable |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Indexes: `UNIQUE (host_campaign_id, kind, LOWER(category)) WHERE archived_at IS NULL`.

#### `pledges`
Tracks promised sponsor or donor commitments vs received income.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :restrict`), `NOT NULL` |
| `sponsor_id` | `bigint` | FK → `sponsors.id` (`on_delete: :restrict`), nullable |
| `donor_name` | `string` | `NOT NULL` |
| `contact_info` | `string` | Nullable (filtered from Rails logs via `filter_parameters`) |
| `tier` | `string` | Nullable (`Diamond`, `Platinum`, `Gold`, `Silver`, `Donor`, `In-Kind`) |
| `is_in_kind` | `boolean` | `NOT NULL`, default `false` (in-kind pledges are tracked separately and **never** added to cash `pledgedTotalCents` or `raisedCents`) |
| `promised_cents` | `bigint` | `NOT NULL`, CHECK `> 0` |
| `due_on` | `date` | Nullable (compared against Guam calendar date) |
| `status` | `string` | `NOT NULL`, default `"promised"`, CHECK IN `('promised', 'partial', 'fulfilled', 'cancelled')` |
| `notes` | `text` | Nullable |
| `recorded_by_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), `NOT NULL` |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Concurrency & invariants:
- `received_cents` is computed dynamically as `SUM(ledger_entries.amount_cents)` where `pledge_id = pledge.id AND entry_type = 'income' AND voided_at IS NULL`.
- Any ledger write referencing `pledge_id` acquires `pledge.with_lock` inside the same transaction before calling `Pledge#sync_fulfillment_status!`.
- Linking a new live income entry to a `cancelled` pledge is rejected (`422`).
- Overpayments (`received_cents > promised_cents`) set `status = "fulfilled"` and compute `overpayment_cents = received_cents - promised_cents` (no negative outstanding balance).

#### `ledger_entries`
Every cash dollar in and out of the host campaign. **Never hard-deleted — voided only. Core monetary fields are immutable after creation.**

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :restrict`), `NOT NULL` |
| `entry_type` | `string` | `NOT NULL`, CHECK IN `('income', 'expense')` |
| `amount_cents` | `bigint` | `NOT NULL`, CHECK `> 0` |
| `entry_date` | `date` | `NOT NULL` (defaults to current Guam calendar date) |
| `budget_line_id` | `bigint` | FK → `budget_lines.id` (`on_delete: :restrict`), nullable |
| `campaign_event_id` | `bigint` | FK → `campaign_events.id` (`on_delete: :restrict`), nullable |
| `sponsor_id` | `bigint` | FK → `sponsors.id` (`on_delete: :restrict`), nullable |
| `pledge_id` | `bigint` | FK → `pledges.id` (`on_delete: :restrict`), nullable |
| `source` | `string` | `NOT NULL`, CHECK aligned with `entry_type`: income ∈ `('fundraiser_gross', 'fundraiser_net', 'sponsorship', 'donation', 'fdaa_allocation', 'ticket_share', 'merch', 'golf_net', 'other_income')`; expense ∈ `('event_expense', 'merch_cost', 'venue_ops', 'refund', 'other_expense')` |
| `payment_method` | `string` | `NOT NULL`, CHECK IN `('cash', 'paypal', 'check', 'bank_transfer', 'fdaa', 'hafapass_payout', 'golf_payout', 'card', 'other')` |
| `counterparty` | `string` | `NOT NULL` |
| `description` | `text` | Nullable |
| `reference_number` | `string` | Nullable (filtered from Rails logs) |
| `paid_by` | `string` | Nullable (display name of board member who paid out of pocket) |
| `paid_by_user_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), nullable (links out-of-pocket payer to a `User` for separation-of-duties checks) |
| `reimbursement_status` | `string` | `NOT NULL`, default `"not_applicable"`, CHECK IN `('not_applicable', 'requested', 'approved', 'reimbursed')` |
| `reimbursement_approved_by_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), nullable |
| `reimbursed_at` | `date` | Nullable |
| `reimbursement_reference` | `string` | Nullable (filtered from Rails logs) |
| `receipt_key` | `string` | Nullable, partial UNIQUE index `WHERE receipt_key IS NOT NULL` (private S3 key under `receipts/<campaign_id>/...`; filtered from logs) |
| `receipt_filename` | `string` | Nullable |
| `receipt_content_type` | `string` | Nullable |
| `receipt_byte_size` | `integer` | Nullable, CHECK `> 0` |
| `recorded_by_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), `NOT NULL` |
| `voided_at` | `datetime` | Nullable |
| `voided_by_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), nullable |
| `void_reason` | `string` | Nullable |
| `created_at`, `updated_at` | `datetime` | `NOT NULL` |

Model & DB CHECK invariants:
- `budget_line`, `campaign_event`, and `pledge` must belong to `host_campaign_id`; `sponsor` must belong to `host_campaign.tournament_id`; `budget_line.kind` must match `entry_type`.
- CHECK: `entry_type = 'income'` ⇒ `reimbursement_status = 'not_applicable'` AND `paid_by_user_id IS NULL`.
- CHECK: `(voided_at IS NULL) = (voided_by_id IS NULL) AND (voided_at IS NULL) = (void_reason IS NULL)`.
- CHECK: receipt columns are all-or-nothing (`(receipt_key IS NULL) = (receipt_filename IS NULL) = (receipt_content_type IS NULL) = (receipt_byte_size IS NULL)`).
- CHECK: `reimbursed_at IS NULL OR reimbursement_status = 'reimbursed'`.
- **Immutability rule:** After creation, `entry_type`, `amount_cents`, `entry_date`, `source`, `payment_method`, `counterparty`, `paid_by`, `paid_by_user_id`, and `pledge_id` are immutable. Corrections go through **void + re-enter**. Only `description`, `reference_number`, `budget_line_id`, `campaign_event_id`, `sponsor_id`, reimbursement workflow fields, and receipt attachment (audited) may be updated on a live entry. Once voided, every column is immutable.
- **Separation of duties on reimbursements:** `reimbursement_approved_by_id` must not equal `paid_by_user_id` (and when `paid_by_user_id` is nil, must not equal `recorded_by_id` unless approved by a second officer or global `admin` with an audit note). Reimbursements can be approved by a second `treasurer`, a `chair`, or global `admin`.
- **Accounting rule (avoid double-counting):** Use `fundraiser_net` / `golf_net` **only** for third-party net settlements where costs were already deducted before payout; use `fundraiser_gross` when logging expenses separately under that `campaign_event_id`. The UI warns if an event mixes `*_net` income with linked `event_expense` entries.
- Indexes: `INDEX (host_campaign_id, voided_at, entry_date)`, `INDEX (host_campaign_id, entry_type, voided_at)`, `INDEX (pledge_id, voided_at)`, `INDEX (host_campaign_id, reimbursement_status, voided_at)`.

#### `pending_receipt_uploads` (added in A3.2)
Server-side record issued when presigning a private receipt upload so clients cannot forge unuploaded keys or hijack another entry's receipt.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `bigint` | PK |
| `host_campaign_id` | `bigint` | FK → `host_campaigns.id` (`on_delete: :restrict`), `NOT NULL` |
| `uploaded_by_id` | `bigint` | FK → `users.id` (`on_delete: :restrict`), `NOT NULL` |
| `s3_key` | `string` | `NOT NULL`, unique index |
| `original_filename` | `string` | `NOT NULL` |
| `expected_content_type` | `string` | `NOT NULL` |
| `expires_at` | `datetime` | `NOT NULL` |
| `attached_at` | `datetime` | Nullable |
| `created_at` | `datetime` | `NOT NULL` |

### 4.2 Role-Based Access Control (RBAC) & Endpoint Map

New namespace `Api::V1::Campaign::BaseController < Api::V1::BaseController`:
- Runs `authenticate_user!` (does **not** require `User#staff?`, so board members with `User.role = "viewer"` cannot access `/api/v1/admin/*` tournament ops).
- Sets `response.headers["Cache-Control"] = "no-store"` on **every** response under `/api/v1/campaign/*`.
- Resolves `@campaign = HostCampaign.find_by!(slug: params[:campaign_slug])`.
- Helper `require_campaign_role!(*allowed_roles)`:
  - Global `current_user.admin?` is authorized (writes still audited in `finance_audit_events`).
  - Otherwise requires at least one active `CampaignMembership` for `(host_campaign: @campaign, user: current_user)` whose `role` is in `allowed_roles`.
  - Write helpers also reject writes when `@campaign.archived?` (returning `422` for campaign roles; admin break-glass requires explicit `break_glass_reason`).
- `/api/v1/me` adds `campaignMemberships: [{ campaignId, campaignSlug, campaignTitle, status, roles: ["chair", ...] }]` (grouped by campaign so multi-role users see all their roles cleanly).

| Capability / Endpoint group | Anonymous | Tournament `staff` (no membership) | Campaign `board` | Campaign `chair` | Campaign `treasurer` | Global `admin` |
| --- | --- | --- | --- | --- | --- | --- |
| Public `GET /api/v1/public/host-year` (non-draft; meter only if enabled) | Read | Read | Read | Read | Read | Read |
| Campaign overview, finance summary, audit log, ledger, pledges, budget lines, receipt GET URL, CSV export | 401 | 403 | Read | Read | Read | Read |
| Host Year content settings (`title`, `tagline`, `description`, countdown, hero, `golf_url`), `campaign_events`, `campaign_posts`, campaign public image presign | 401 | 403 | 403 | **CRUD** | Read | **CRUD** |
| Financial campaign settings (`goal_cents`, `fdaa_*`, meter toggles) | 401 | 403 | 403 | 403 | **Update** | **Update** |
| Donation channel (`donation_url`, `donation_instructions`) | 401 | 403 | 403 | 403 | 403 | **Update** (audited) |
| Create/update-metadata/void ledger entries, budget lines, pledges, presign receipt upload, mark reimbursed | 401 | 403 | 403 | 403 | **Write** | **Write** |
| Approve reimbursement (`reimbursement_status: requested → approved`) | 401 | 403 | 403 | **Approve** (if not payer) | **Approve** (if not payer) | **Approve** |
| Create/archive campaigns, manage `campaign_memberships` / `campaign_invitations` / `admin_whitelists` | 401 | 403 | 403 | 403 | 403 | **CRUD** |
| Tournament ops (`/api/v1/admin/*`) | 401 | **Staff** | 403 | 403 | 403 | **Admin** |

Explicit REST paths:
- **Admin lifecycle & people (`/api/v1/admin/*`, `require_admin!`):**
  - `GET/POST /api/v1/admin/campaigns`, `GET/PATCH /api/v1/admin/campaigns/:id` (includes status transitions, `featured`, `donation_url`, `donation_instructions`)
  - `GET/POST /api/v1/admin/campaigns/:campaign_id/memberships`, `PATCH /api/v1/admin/campaigns/:campaign_id/memberships/:id`
  - `GET/POST /api/v1/admin/campaigns/:campaign_id/invitations`, `POST /api/v1/admin/campaigns/:campaign_id/invitations/:id/revoke`
  - `GET/POST/PATCH /api/v1/admin/whitelists` (existing `admin_whitelists` for global tournament roles)
- **Campaign content (`/api/v1/campaign/:campaign_slug/*`):**
  - `GET/PATCH /api/v1/campaign/:campaign_slug/settings` (role-filtered strong params: content vs finance vs donation fields)
  - `POST /api/v1/campaign/:campaign_slug/uploads/presign` (`chair`/`admin`, public image under `campaigns/<id>/...`, rate-limited)
  - `GET/POST/PATCH /api/v1/campaign/:campaign_slug/events`, `POST .../events/:id/archive`
  - `GET/POST/PATCH/DELETE /api/v1/campaign/:campaign_slug/posts`
- **Campaign finance (`/api/v1/campaign/:campaign_slug/*`):**
  - `GET /api/v1/campaign/:campaign_slug/finance/summary`
  - `GET /api/v1/campaign/:campaign_slug/finance/audit-events`
  - `GET/POST/PATCH /api/v1/campaign/:campaign_slug/budget-lines`, `POST .../budget-lines/:id/archive`
  - `GET/POST/PATCH /api/v1/campaign/:campaign_slug/pledges`
  - `GET /api/v1/campaign/:campaign_slug/ledger-entries/export.csv` (**declared before `:id`**)
  - `GET/POST/PATCH /api/v1/campaign/:campaign_slug/ledger-entries`
  - `POST /api/v1/campaign/:campaign_slug/ledger-entries/:id/void`
  - `POST /api/v1/campaign/:campaign_slug/ledger-entries/:id/approve-reimbursement`
  - `POST /api/v1/campaign/:campaign_slug/ledger-entries/:id/mark-reimbursed`
  - `POST /api/v1/campaign/:campaign_slug/receipts/presign` (A3.2, `treasurer`/`admin`, rate-limited)
  - `GET /api/v1/campaign/:campaign_slug/ledger-entries/:id/receipt-url` (A3.2, `board`/`chair`/`treasurer`/`admin`, audited)

### 4.3 Private Receipt Storage (`PrivateReceiptStorage`)

- **Dedicated private bucket (fail closed):** requires `S3_PRIVATE_BUCKET` (with S3 Block Public Access enabled in AWS) in production; returns `503` / fails closed if unset (never falls back to public `S3_BUCKET`, avoiding conflicts with existing `admin/*` uploads and public bucket policies). Document exact setup in `docs/S3-UPLOAD-SETUP.md` during A3.2.
- **Signing implementation:** hand-rolled AWS SigV4 (reusing the HMAC-SHA256 signing primitives already in `PublicImageUploadPresigner`, zero new heavy AWS SDK dependency) for:
  1. Presigned POST upload (`expires: 60s`, prefix `receipts/<campaign_id>/<timestamp>-<hex>-<safe_filename>`)
  2. Server-side S3 `HEAD` verification on attach (verifying object existence and capturing authoritative `Content-Length` and `Content-Type` from S3)
  3. Presigned GET download (`expires: 120s`)
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`; max `15.megabytes` (`S3_RECEIPT_UPLOAD_MAX_BYTES`).
- **Safe attachment flow:**
  1. `POST .../receipts/presign` creates a `pending_receipt_uploads` row (expires in 10 min) and returns `{ uploadToken, upload: { url, fields } }` (no `publicUrl`).
  2. Client uploads directly to S3, then submits `receiptUploadToken` when creating/updating the `ledger_entry`.
  3. Server looks up the unattached, unexpired `pending_receipt_uploads` row for `@campaign`, calls S3 `HEAD` to verify existence/size/type, ensures `s3_key` is unused (`UNIQUE` partial index), saves receipt columns, stamps `attached_at`, and records a `finance_audit_events` entry.
- **Safe viewing flow:**
  - `GET .../ledger-entries/:id/receipt-url` verifies `@campaign` ownership, sanitizes `receipt_filename` (strips path separators, quotes, CR/LF, control chars), signs a 120s GET URL with RFC 5987 `response-content-disposition=inline; filename="<ascii>"; filename*=UTF-8''<encoded>`, and logs `view_receipt` in `finance_audit_events`.
  - Frontend renders inline preview for JPEG/PNG/WebP/PDF and a clean `"Download HEIC receipt"` button for `image/heic` (which most desktop browsers cannot render inline).

### 4.4 Finance Totals, Reimbursements & CSV Export

- **`HostCampaigns::FinanceSummary.call(campaign)`** (explicit top-level namespace avoids Zeitwerk collision inside `Api::V1::Campaign::*`; pure integer cents):
  - `goalCents`: `campaign.goal_cents`
  - `raisedCents`: sum of non-voided `income` entries
  - `raisedExcludingFdaaCents`: sum of non-voided `income` where `source NOT IN ('fdaa_allocation', 'ticket_share')`
  - `spentCents`: sum of non-voided `expense` entries
  - `netCents`: `raisedCents - spentCents`
  - `stillNeededCents`: `[goalCents - publicMeterRaisedCents, 0].max` (and `stillNeededGrossCents: [goalCents - raisedCents, 0].max`)
  - `publicMeterRaisedCents`: `campaign.include_fdaa_in_public_meter? ? raisedCents : raisedExcludingFdaaCents`
  - `pledgedTotalCents`, `pledgedReceivedCents`, `outstandingPledgesCents` (cash pledges only: `is_in_kind = false`, `status != 'cancelled'`; sum of `[promised_cents - received_cents, 0].max`), plus `inKindPledgesCount`
  - `pendingReimbursementsCents`, `pendingReimbursementsCount`
  - `bySource`, `byMethod`, `budgetVsActual` (joining active + historically referenced budget lines)
- **CSV Export (`GET /api/v1/campaign/:campaign_slug/ledger-entries/export.csv`):**
  - UTF-8 with BOM, `Cache-Control: no-store`.
  - Formula-escape **text cells only** (prefix leading `=`, `+`, `-`, `@`, `\t`, `\r` with `'`; numeric `amount_dollars` stays unprefixed numeric).
  - Includes voided rows explicitly with `voided` (`true`/`false`), `voided_at`, `void_reason`, plus `has_receipt` (`yes`/`no`; never embeds expiring signed URLs).
  - Frontend downloads via authenticated `fetch()` → `Blob` → temporary `URL.createObjectURL` click (never a plain `<a href>` which cannot send Bearer auth).
- **Log filtering:** Add `:contact_info`, `:receipt_key`, `:reference_number`, `:reimbursement_reference` to `Rails.application.config.filter_parameters`.

### 4.5 Admin Workspace by Role

When signed in to `/admin`:
- `AdminLayout` accepts any user where `user.isStaff || user.campaignMemberships.length > 0`, and lands board-only users directly on `/admin/campaign/finance` (or `/admin/campaign/host-year` for `chair`-only) instead of `/admin` overview (which requires `staff?` and would 403!).
  - **Money** (`treasurer`, `board`, `chair`, `admin`): `/admin/campaign/finance` — overview cards dynamically formatted from `goalCents`, mobile-first quick-add Income / Expense (with phone camera/PDF receipt upload), void flow with reason, Budget vs Actual, Pledges, Reimbursements approval queue, Audit Log, authenticated CSV export.
  - **Host Year** (`chair`, `admin`, read-only for `treasurer`/`board`): `/admin/campaign/host-year` — content settings & countdown, fundraiser events CRUD/archive (with HåfaPass ID/slug & per-event `/go/:code`), class news posts CRUD.
  - **Tournament** (`staff`, `admin`): existing tournament ops sections.
  - **System** (`admin` only): Campaigns lifecycle + donation settings, People & Roles UI (`admin_whitelists`, `campaign_memberships`, `campaign_invitations`), and archive tools (`Ingest`).

---

## 5. PR-Sized Implementation Slices & Acceptance Checks

Each slice is a small, independently testable, cross-family-reviewed PR:

### Track A2 — Host Year

| Slice | Branch / Scope | Acceptance checks |
| --- | --- | --- |
| **A2.1a** | `agent/hub-a2-1a-campaigns-schema-public` — Migrations & models for `host_campaigns`, `campaign_events`, `campaign_posts`, `finance_audit_events` (`on_delete: :restrict`, CHECK constraints, `https://` & slug validators); public `GET /api/v1/public/host-year` (drafts excluded, meter omitted when disabled) & additive `activeHostCampaign` on `/public/home`; guard `Tournament.active_for_public` against future placeholders. | Model & request specs verify draft 404, featured/rollover resolution (`active` + `closing`), privacy when `public_meter_enabled: false`, `javascript:` URL rejection, no cascade deletes, CI green. |
| **A2.1b** | `agent/hub-a2-1b-campaign-rbac-invites-content` — `campaign_memberships` (multi-role), `campaign_invitations` (auto-accept on verified Clerk email in `ClerkAuthenticatable`), `Api::V1::Campaign::BaseController` (`Cache-Control: no-store`), `/api/v1/me` `campaignMemberships`, campaign content CRUD + `campaigns` image presign (`chair`/`admin`), admin campaign lifecycle & people/invitation endpoints, audit logging on settings/membership changes. | Request specs verify anonymous (401), viewer/staff-without-membership (403), board (read-only), chair (content CRUD, 403 on donation/finance/admin settings), treasurer (finance settings only, 403 on donation/content), multi-role user, existing-user invite acceptance on verified email only, archived campaign read-only enforcement. |
| **A2.2** | `agent/hub-a2-2-hafapass-client` — `hafapass_event_snapshots` table, `Hafapass::EventsClient` (strict query encoding, explicit `ticketState`, ID-first matching, dedupe, per-event `/go/:code`), `Hafapass::RefreshEventsJob` (non-blocking public read + lease lock); merged into `/api/v1/public/host-year`. | Unit & controller tests stub HåfaPass HTTP (live `on_sale`/`sold_out`/`upcoming`/`cancelled`, snapshot cache hit, stale fallback hiding ticket counts, malformed JSON resilience, zero auth headers, non-blocking read). |
| **A2.3** | `agent/hub-a2-3-public-host-year-ui` — New `useMotionOk` & `RevealOnScroll` helpers; public `/host-year` & `/host-year/:slug` page (countdown, dynamic goal meter hidden while `meter.enabled === false`, single signature bar-fill animation, fundraiser calendar with HåfaPass badges & `/go/:code`, Golf card, Donate CTA, class news); Home off-season Host Year feature. | Playwright desktop (1280×800) + mobile (390×844) QA with API ON and API OFF (per-section degradation + retry); `prefers-reduced-motion` renders final meter immediately; zero animation library added; Impeccable scan clean. |
| **A2.3b** | `agent/hub-a2-3b-mobile-bottom-nav` — Fixed mobile bottom nav bar (`Home · Schedule · Standings · Host Year/Tickets · More`) in `PublicLayout` respecting `env(safe-area-inset-bottom)`. | Playwright mobile (390×844) & desktop QA verifies all routes, drawer toggle, keyboard focus, safe-area padding, and zero overlap with page CTAs. |
| **A2.4** | `agent/hub-a2-4-chair-admin-ui` — `AdminLayout` gate (`isStaff \|\| campaignMemberships.length > 0`) & role-aware landing redirect; `/admin/campaign/host-year` workspace (`chair`/`admin`); System → Campaigns & People/Roles UI (`admin` only). | Browser QA verifies `chair` lands cleanly without 403s and edits Host Year while tournament ops & finance/donation controls stay hidden; `admin` invites board members & creates campaigns. |

### Track A3 — Finance Tracker

| Slice | Branch / Scope | Acceptance checks |
| --- | --- | --- |
| **A3.1** | `agent/hub-a3-1-finance-schema-api` — Migrations & models for `budget_lines`, `pledges`, `ledger_entries` (`on_delete: :restrict`, all CHECK constraints, Guam date defaults, `with_lock` pledge sync, immutable monetary fields, void-only, separation of duties on reimbursement approvals); `HostCampaigns::FinanceSummary`; full `Api::V1::Campaign` finance controllers + CSV export + audit events; reject `receipt_*` params until A3.2; wire real totals into public meter; add `filter_parameters`. | Request specs cover `treasurer` writes, `chair`/`board` read-only (plus non-payer reimbursement approval), `staff` 403, self-approval blocked, immutable field rejection, void-only + audit log, cancelled pledge rejection, CSV formula escaping on text only, `Cache-Control: no-store`, cross-campaign ID rejection. |
| **A3.2** | `agent/hub-a3-2-private-receipts` — `pending_receipt_uploads` table, `PrivateReceiptStorage` (dedicated `S3_PRIVATE_BUCKET` fail-closed, hand-rolled SigV4 POST/GET/HEAD, RFC 5987 headers, rate-limited presign, audited views); updated `docs/S3-UPLOAD-SETUP.md`. | Specs verify `treasurer`/`admin` presign, S3 HEAD size/type enforcement, replay/cross-campaign key rejection, `board`/`chair` 403 on presign & 200 on signed GET, filename header-injection sanitization, fail-closed when `S3_PRIVATE_BUCKET` unset. |
| **A3.3** | `agent/hub-a3-3-finance-ui` — Mobile-first `/admin/campaign/finance` workspace: dynamic goal/net/pledges/reimbursements overview, quick-add Income & Expense (camera/PDF receipt upload, HEIC download fallback, void modal with reason), Budget vs Actual, Pledges, Reimbursements queue, Audit Log view, authenticated Blob CSV download. | Playwright mobile (390×844) + desktop QA: treasurer logs income/expense with receipt, voids entry, second officer approves reimbursement, downloads CSV; board sees read-only view; public `/host-year` meter reflects live total while hiding expenses. |

---

## 6. Fallbacks & Resolved Decisions

- **Decisions locked by this design:**
  1. **Global `admin` finance access:** Shimizu Technology (`admin`) retains full access to support host classes, with every write and receipt view logged in `finance_audit_events`.
  2. **Public meter default & basis:** `public_meter_enabled` defaults `false`. Numerator counts non-voided cash `income` (never in-kind pledges), excluding `fdaa_allocation` / `ticket_share` unless `include_fdaa_in_public_meter` is explicitly turned on.
  3. **Archive access:** Archived campaigns become read-only for all campaign roles; outgoing board members retain read-only access for handoff unless deactivated by an admin.
  4. **Reimbursements entry:** Treasurers (or admins) enter out-of-pocket expenses with `paid_by_user_id`; a second officer (`chair`, another `treasurer`, or `admin`) approves reimbursement (`reimbursement_approved_by_id != paid_by_user_id`).
  5. **Sponsors ownership:** Sponsors remain per-tournament (2027 tournament sponsors link to the 2027 tournament row, and can be linked from 2027 campaign pledges/ledger entries).
- **Fallbacks if schedule tightens:**
  - Pledges and reimbursement approvals can stay unused/minimal while plain income/expense entries + receipt uploads + CSV export ship first.
  - If HåfaPass `CO2017` org isn't created yet, `campaign_events.external_url` works immediately for any fundraiser link or flyer.
- **Board inputs to plug into campaign settings once confirmed (none block building):**
  1. Named `chair`, `treasurer`, and `board` emails → invited via People & Roles UI.
  2. Donation channel (`donation_url` / `donation_instructions`) → configured by `admin` once the class chooses Bank of Guam vs FDAA 501(c)(3).
  3. Goal amount, FDAA allocation / ticket-share bps, and meter toggle (`include_fdaa_in_public_meter` + `public_meter_enabled`) → configured per campaign.
  4. Class slogan/theme, Mar 6 Bryan Ho 5K/beer mile details, May golf date, and Nov 20 Antigu fundraiser final numbers → entered directly through Host Year & Finance admin screens.
