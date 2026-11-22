# FD Alumni Hub — Tournament Core (B1), Game Night (B2), and Close-Out & Handoff (C) Design

- **Date:** 2026-11-22
- **Status:** Draft for cross-family review (implementation contract for Track 1 Milestones B1, B2, and C)
- **Baseline:** `Shimizu-Technology/fd-alumni-hub` `main` at `8b4c0a9` (A1 Foundations #51, Host Year A2 #53–#58, Board Finance Tracker A3 #59–#61 merged)
- **Plan Reference:** `fd-co2017-host-year-plan-2026-11-21.md` (v5) §2.3, §4.1, §4.4, §5 Track 1
- **Related Docs:**
  - `docs/HOST-YEAR-AND-FINANCE-DESIGN.md` (A2/A3 contract)
  - `docs/DOMAIN-AND-CLERK-SETUP.md` (activation & Leon-gated steps)
  - `docs/S3-UPLOAD-SETUP.md` (public media + private receipt buckets)

---

## 1. Goals & Non-Goals

### Goals
1. **Milestone B1 (Tournament Core):** Make the tournament data model and operator workflows cleanly multi-year, reusable across 2027, 2028, and future host classes without hard-coded 2026 scripts or global division leaks:
   - Per-tournament `divisions` with explicit `counts_for_standings`.
   - First-class `phase`, `game_number`, bracket wiring, and delay/postpone status columns on `games`.
   - Per-division pool-only standings (excluding unassigned-division teams, non-standings divisions like `Special`, father-son games, playoffs, exhibitions, and placeholders).
   - Generic CSV / FDMSAA PDF-text schedule and roster importer with dry-run review & diff before commit.
   - Guided new-tournament Setup Wizard (2027, 2028, …).
   - Standardized, tier-ranked sponsor tiers (`diamond`, `platinum`, `gold`, `silver`, `community`) with hardened URLs.
   - Public `/tickets` page reading HåfaPass events via the existing non-blocking `Hafapass::EventsClient` + `HafapassEventSnapshot` contract.
2. **Milestone B2 (Game Night):** Make running live games inside The Jungle reliable on phones even with spotty gym Wi-Fi or typhoon reschedules:
   - Playoff bracket view (`/bracket`) with round-by-round mobile UX and safe winner advancement.
   - Dedicated least-privilege `scorekeeper` role + mobile-first `/admin/scorekeeper` screen with optimistic locking (`409` conflict handling) and local offline retry queue with idempotent replay.
   - Enhanced `/today` page (live scores, delay badges, HåfaPass ticket fallback) + site-wide `tournament_alerts` storm/delay banner.
   - Automated frontend unit tests (Vitest), end-to-end smoke tests (Playwright in CI), and `brakeman` + `bundler-audit` + Vitest enforced in `scripts/gate.sh`.
3. **Milestone C (Close-Out & Handoff):** Make August wrap-up and Class-of-2017 → Class-of-2018 handoff repeatable in minutes:
   - Printable/exportable Board Final Report (tournament outcomes + full finance reconciliation + compliance checks).
   - Checked archival workflow for closing a tournament year and freezing its `host_campaign`.
   - Safe Campaign Clone workflow creating the next host class's draft campaign, tournament, divisions, budget categories, and event templates without leaking prior financial records or board memberships.
   - Non-technical `docs/BOARD-HANDOFF-RUNBOOK.md`.

### Non-Goals
- **No external infra mutations:** Render API, Clerk production, Netlify env vars, DNS, and S3 remain paused/untouched until Leon runs the activation checklist in `docs/DOMAIN-AND-CLERK-SETUP.md`. Every new public route (`/tickets`, `/bracket`) must degrade gracefully while the API is offline.
- **No payment processing on the hub:** Tickets and team registration checkout stay on HåfaPass (`/go/:code` deep links); golf stays on HafaGolf; donations link out.
- **No decorative motion on admin/scorekeeper/bracket operational screens:** Follow plan v5 §4.4 (restrained hover/reveal only on public pages; zero animation library).

---

## 2. Current Schema & Code Audit (Verified on `main` `8b4c0a9`)

| Area | Current State in Code | Gaps Addressed Here |
|---|---|---|
| `divisions` (`api/db/schema.rb:176-186`, `api/app/models/division.rb`) | Global table (`slug` globally unique, `starts_year`, no `tournament_id`). Teams & games store both `division_id` (`on_delete: :nullify`) and string `division`. | Divisions aren't scoped per tournament; renaming or toggling a division affects every year; no `counts_for_standings` flag (special-cased by string `"Special"`). |
| `games` (`api/db/schema.rb:219-247`, `api/app/models/game.rb`) | `STATUSES = %w[scheduled live final]`. No `phase`, `game_number`, `bracket_round`, `bracket_slot`, `next_game_id`, `status_note`, `lock_version`, or score audit fields. `pool_phase?` / `playoff_phase?` / `fatherson_phase?` parse `notes` (`phase=pool`) and `bracket_code`. `external_url` allows arbitrary schemes (`[a-z][a-z0-9+.-]*:`). | Needs first-class columns, DB CHECK constraints, `delayed`/`postponed`/`cancelled` statuses, optimistic locking + mutation idempotency for phone scorekeepers, and `SafeUrlValidation` on `stream_url`/`ticket_url`. |
| `standings` (`api/app/services/standings/recompute.rb`, `api/app/controllers/api/v1/public/standings_controller.rb`) | Excludes `Special`, father-son, placeholder, and playoff games, but **does not exclude teams with `division_id IS NULL`** (shows `"Unassigned"`), does not lock `@tournament` during delete-and-recreate, returns flat standings array, and computes `scoreCoverage` across all games rather than pool games. | Exclude teams with no division or non-standings division; count pool games only; lock tournament during recompute; add 2-team head-to-head tiebreaker; return per-division standings groups + pool score coverage. |
| Schedule import (`api/app/services/data_import/fd_2026_schedule_import.rb`) | Hard-coded to `data/schedules/fd-2026-pool-play-2026-06-27.json` and `fd-2026-*` legacy IDs. No web UI, no dry-run preview. | Build generic CSV & FDMSAA PDF-text schedule + roster parsers with preview/review/commit API and admin UI reusing `ClassArchive::TeamEntryLabels` + `ClassArchive::Resolver`. |
| `sponsors` (`api/db/schema.rb:459-473`, `api/app/models/sponsor.rb`, `web/src/pages/public/SponsorsPage.tsx`) | `tier` is an unvalidated freeform string; `SponsorsPage.tsx:47` renders `href={sponsor.targetUrl}` without `externalHref()` and groups in insertion order. | Canonical tiers (`diamond`, `platinum`, `gold`, `silver`, `community`), tier rank ordering, optional `description`, `SafeUrlValidation` + `externalHref()`, tiered public grid. |
| Tickets (`web/src/App.tsx`, `web/src/components/PublicLayout.tsx`) | No `/tickets` route yet. `Hafapass::EventsClient` (`api/app/services/hafapass/events_client.rb`) already fetches & caches `hafapass_organizer_slug` + `hafapass_tournament_organizer_slug` in `hafapass_event_snapshots` via `Hafapass::RefreshEventsJob`. | Add `GET /api/v1/public/tickets` + `/tickets` page reusing `Hafapass::EventsClient`, and update mobile bottom nav (`Home · Schedule/Today · Standings · Tickets · More`). |
| Roles (`api/app/models/user.rb`, `api/app/models/admin_whitelist.rb`, `api/app/controllers/concerns/clerk_authenticatable.rb`) | `ROLES = %w[admin staff viewer]`. No `scorekeeper` role. | Add `scorekeeper` role strictly limited to game reading + `PATCH /api/v1/admin/games/:id/score`. |
| Today & Alerts (`api/app/controllers/api/v1/public/today_controller.rb`, `web/src/pages/public/TodayPage.tsx`) | `game_day_notes` is per-date only (no site-wide multi-day storm banner). `TodayGameCard` doesn't display live/final scores or `statusNote`. | Add `tournament_alerts` site-wide banner, render scores + delay notes on `TodayPage`, and fall back to HåfaPass event ticket link when per-game `ticketUrl` is blank. |
| CI & Gate (`.github/workflows/ci.yml`, `scripts/gate.sh`, `web/package.json`) | CI runs `npm run build`, `brakeman`, `bundler-audit`, `rubocop`, `rails test`. No Vitest or Playwright in CI; `scripts/gate.sh` omits `brakeman`, `bundler-audit`, and frontend tests. | Add Vitest unit tests + Playwright Chromium smoke tests in CI and enforce full backend + frontend checks in `scripts/gate.sh`. |

---

## 3. Milestone B1 — Tournament Core Design

### 3.1 Per-Tournament Divisions (`divisions`)

#### Schema Migration (`20261122000007_scope_divisions_to_tournaments.rb`)
- Add columns to `divisions`:
  - `tournament_id` (`bigint`, nullable during backfill, then `null: false`, FK `tournaments`, `on_delete: :cascade`)
  - `counts_for_standings` (`boolean`, `null: false`, `default: true`)
- Remove global unique index `index_divisions_on_slug`.
- **Idempotent zero-data-loss backfill** (using anonymous AR models inside the migration):
  1. For each `Tournament`:
     - Collect all global `divisions` (`tournament_id IS NULL`) where `(active = true AND (starts_year IS NULL OR starts_year <= tournament.year))` **OR** referenced by any `team.division_id` / `game.division_id` in that tournament **OR** matching `lower(team.division)` / `lower(game.division)` in that tournament.
     - Insert a per-tournament `Division` row (`tournament_id = t.id`, `name`, `slug`, `position`, `active`, `starts_year`, `counts_for_standings = (name.downcase != 'special')`).
     - Re-point `teams.division_id` (and `teams.division`) for that tournament from old global `division_id` (or matching legacy `division` string when `division_id IS NULL`) to the new tournament-scoped `division_id`.
     - Re-point `games.division_id` (and `games.division`) for that tournament using the same mapping.
  2. Safety assertion before cleanup: verify `teams` and `games` have zero rows pointing to `divisions WHERE tournament_id IS NULL`.
  3. Delete all legacy global rows (`DELETE FROM divisions WHERE tournament_id IS NULL`).
- Set `change_column_null :divisions, :tournament_id, false`.
- Add indexes:
  - `add_index :divisions, [:tournament_id, :slug], unique: true`
  - `add_index :divisions, "tournament_id, lower((name)::text)", unique: true, name: "index_divisions_on_tournament_and_lower_name"`
  - `add_index :divisions, [:tournament_id, :active, :position], name: "index_divisions_on_tournament_active_position"`

#### Model & Validation Contract
- `Division`:
  - `belongs_to :tournament`
  - `DEFAULT_SPECS = [{ name: "Maroon", position: 1, counts_for_standings: true }, { name: "Gold", position: 2, counts_for_standings: true }, { name: "Platinum", position: 3, counts_for_standings: true }, { name: "Special", position: 4, counts_for_standings: false }].freeze`
  - `validates :name, presence: true, uniqueness: { scope: :tournament_id, case_sensitive: false }`
  - `validates :slug, presence: true, uniqueness: { scope: :tournament_id }`
  - `scope :for_tournament, ->(tournament) { where(tournament_id: tournament.respond_to?(:id) ? tournament.id : tournament) }`
  - `scope :standings_eligible, -> { active.where(counts_for_standings: true) }`
  - `Tournament#ensure_default_divisions!` idempotently creates `Division::DEFAULT_SPECS` for a tournament (called by Setup Wizard, `db:seed`, and optionally `POST /api/v1/admin/tournaments` when `seedDefaultDivisions: true`). Not an implicit `after_create` callback so tests with custom divisions stay deterministic.
  - `after_update :sync_assigned_names` updates `division` text on its own tournament's `teams`/`games`; if `saved_change_to_counts_for_standings?` or `saved_change_to_active?`, triggers `Standings::Recompute.call(tournament)`.
- `Team` & `Game`:
  - Validate `division_record.tournament_id == tournament_id` (replaces old `available_for?` year check; blocks cross-tournament division leakage).
  - `Team#special_division?` becomes `division_record ? !division_record.counts_for_standings? : resolved_division.to_s.casecmp?("Special")`.
- `Api::V1::Admin::DivisionsController`:
  - `GET /api/v1/admin/divisions?tournamentId=…` returns `{ tournamentId, divisions, allDivisions }` scoped strictly to `admin_tournament` (never leaks other tournaments' divisions).
  - `POST /api/v1/admin/divisions` (`require_admin!`) creates inside `admin_tournament` with `countsForStandings` support.
  - `PATCH /api/v1/admin/divisions/:id` (`require_admin!`) updates `name`, `slug`, `position`, `active`, `countsForStandings` (cannot move `tournament_id`).

---

### 3.2 First-Class Game Fields (`phase`, `game_number`, Bracket, Status, Locking)

#### Schema Migration (`20261122000008_add_tournament_core_fields_to_games.rb`)
Add to `games`:
- `phase` (`string`, `null: false`, `default: "pool"`)
- `game_number` (`string`, nullable)
- `bracket_round` (`string`, nullable)
- `bracket_slot` (`integer`, nullable)
- `next_game_id` (`bigint`, nullable, FK `games`, `on_delete: :nullify`)
- `next_game_slot` (`string`, nullable)
- `status_note` (`string`, nullable)
- `lock_version` (`integer`, `null: false`, `default: 0`)
- `last_score_mutation_id` (`string`, nullable)
- `score_updated_by_id` (`bigint`, nullable, FK `users`, `on_delete: :nullify`)
- `score_updated_at` (`datetime`, nullable)

Check constraints & indexes:
- `chk_games_phase`: `phase IN ('pool', 'playoff', 'fatherson', 'exhibition')`
- `chk_games_status`: `status IN ('scheduled', 'live', 'final', 'delayed', 'postponed', 'cancelled')`
- `chk_games_bracket_round`: `bracket_round IS NULL OR bracket_round IN ('play_in', 'round_of_16', 'quarterfinal', 'semifinal', 'final', 'third_place')`
- `chk_games_bracket_slot_positive`: `bracket_slot IS NULL OR bracket_slot > 0`
- `chk_games_next_game_not_self`: `next_game_id IS NULL OR next_game_id <> id`
- `chk_games_next_game_slot_consistency`: `(next_game_id IS NULL) = (next_game_slot IS NULL) AND (next_game_slot IS NULL OR next_game_slot IN ('home', 'away'))`
- `index_games_on_tournament_phase_start`: `[:tournament_id, :phase, :start_time]`
- `index_games_on_tournament_game_number_unique`: `"tournament_id, lower((game_number)::text)"`, `unique: true`, `where: "(game_number IS NOT NULL)"`
- `index_games_on_tournament_bracket`: `[:tournament_id, :division_id, :phase, :bracket_round, :bracket_slot]`
- `index_games_on_next_game_id`: `[:next_game_id]`

#### Backfill Logic (in migration)
- Infer `phase` on existing rows:
  - `'fatherson'` if `notes` contains `phase=fatherson` or `bracket_code` matches `/\AFS/i`
  - `'playoff'` if `notes` contains `phase=playoff` or `bracket_code` matches `/\A(?:[WL]?(?:MP|GP|PP)|[MGP]?(?:QF|SF|F)|L)\d*\z/i`
  - Otherwise `'pool'`
- Populate `game_number` from `bracket_code` where `bracket_code` is present and unique within `(tournament_id, lower(bracket_code))` (skipping duplicates safely so unique index creation never fails on historical data).

#### Model & URL Hardening
- `Game::PHASES = %w[pool playoff fatherson exhibition].freeze`
- `Game::STATUSES = %w[scheduled live final delayed postponed cancelled].freeze`
- `Game::BRACKET_ROUNDS = %w[play_in round_of_16 quarterfinal semifinal final third_place].freeze`
- `Game::NEXT_GAME_SLOTS = %w[home away].freeze`
- Include `SafeUrlValidation` on `stream_url` and `ticket_url` (rejecting non-`http`/`https` schemes and userinfo phishing; updating `external_url` to fail closed to `nil` on unsafe URLs).
- Validate `next_game` belongs to same `tournament_id`, has `phase == "playoff"`, and contains no graph cycle (walk `next_game_id` up to 8 hops).
- `Game#pool_phase?` reads `phase == "pool"`; `playoff_phase?` reads `phase == "playoff"`; `fatherson_phase?` reads `phase == "fatherson"`.
- `Game#api_json` adds `phase`, `gameNumber`, `bracketRound`, `bracketSlot`, `nextGameId`, `nextGameSlot`, `statusNote`, `lockVersion`, `scoreUpdatedAt`, `scoreUpdatedByName`.

---

### 3.3 Per-Division Pool-Only Standings

#### Rules (`Team`, `Game`, `Standings::Recompute`)
- **Eligible Teams:** Must belong to the tournament AND:
  1. `division_id.present?` (teams with no division assigned are excluded — `"no_division"`).
  2. `division_record.active? && division_record.counts_for_standings?` (excludes `Special` — `"non_standings_division"`).
  3. `!fatherson_team?` (`"fatherson_team"`).
  4. `!placeholder_team?` (`"placeholder_team"`).
- **Counted Games:** Must belong to the tournament AND:
  1. `status == "final"` with non-nil `home_score` and `away_score`.
  2. `!placeholder?`.
  3. `phase == "pool"` (excludes `playoff`, `fatherson`, `exhibition`).
  4. Both `home_team` and `away_team` are eligible AND `home_team.division_id == away_team.division_id` (excludes cross-division exhibitions — `"cross_division"`).
  5. If `game.division_id.present?`, `game.division_record.counts_for_standings?` is `true` and matches teams' `division_id`.
- **Concurrency Safety:** `Standings::Recompute#call` wraps delete + insert inside `@tournament.with_lock` so simultaneous scorekeeper updates never race on `(tournament_id, team_id)` uniqueness.
- **Per-Division Ranking & Tiebreakers:**
  1. `wins DESC`
  2. `losses ASC`
  3. Two-team head-to-head pool record (when exactly 2 teams in a division share the same `wins`/`losses` and have a decisive head-to-head pool win differential)
  4. `point_differential DESC` (`points_for - points_against`)
  5. `points_for DESC`
  6. `display_name ASC`
- **Public API (`GET /api/v1/public/standings`):**
  - Accepts optional `year`, `division` (name or slug), `divisionId`.
  - Computes `scoreCoverage` over **eligible pool games** (`scoredPoolGames`, `totalPoolGames`, `percent`; also keeps `scoredGames`/`totalGames` aliases for compatibility).
  - Returns `divisionStandings`: array of `{ division: { id, name, slug, position }, standings: [...ranked with rank 1..N...], scoreCoverage: {...} }` ordered by `division.position`.
  - Retains top-level `standings` (flat list ordered by division then rank) and `divisions` (list of standings-eligible division names) so existing callers continue working.
- **Public UI (`StandingsPage.tsx`):**
  - Renders one clear card/table per division (Maroon, Gold, Platinum) when "All divisions" is selected, or the focused division table when filtered. Each division starts cleanly at `#1`.

---

### 3.4 Generic Schedule & Roster Importer (Dry-Run Review → Commit)

#### Endpoints (`require_staff!` — or `require_admin!`? Staff runs tournament ops per Plan v5 §4.1, so `require_staff!` on preview & commit, with `overwriteScores: true` restricted to `require_admin!`!)
1. `POST /api/v1/admin/tournaments/:id/schedule-import/preview`
   - Request: `{ format: "csv" | "fdmsaa_text" | "auto", content: string, defaultVenue?: string, defaultYear?: number }` (max 500 KB, max 400 rows).
   - Service: `Imports::ScheduleParser` + `Imports::SchedulePreview`.
   - Behavior:
     - Parses CSV headers (case-insensitive aliases: `date`, `time`, `game_number`/`game #`/`game`, `away`/`away_team`, `home`/`home_team`, `division`, `phase`, `venue`, `bracket_code`, `bracket_round`, `bracket_slot`, `placeholder`, `notes`) OR FDMSAA PDF copy-paste text (day headers like `Friday, June 25, 2027` or `06/25/2027`, times like `6:00 PM` / `6:00pm`, game codes `G1` / `M1` / `FS1`, `Away vs. Home` or `Away at Home` or tab-separated columns).
     - Canonicalizes team names via `ClassArchive::TeamEntryLabels.canonical_label` and resolves class cohorts via `ClassArchive::Resolver.class_keys` (read-only during preview — **zero DB writes during preview!**).
     - Matches divisions against `tournament.divisions` (case-insensitive by name or slug; never auto-creates unknown divisions).
     - Matches existing games by `(tournament_id, lower(game_number))` first, then `(tournament_id, start_time, home_team_id, away_team_id)`.
     - Classifies each row:
       - `action`: `"create"` | `"update"` | `"unchanged"` | `"error"`
       - `errors`: blocking issues (invalid date/time, missing team, same team vs self on non-placeholder, unknown division, invalid phase, duplicate `game_number` in batch)
       - `warnings`: non-blocking flags (new team will be created, unrecognized class cohort, existing game already has a score and won't be overwritten, team scheduled twice within 70 min, cross-division pool game)
   - Response: `{ summary: { total, creates, updates, unchanged, errors, warnings, newTeams: [...] }, availableDivisions: [...], rows: [...] }`.
2. `POST /api/v1/admin/tournaments/:id/schedule-import/commit`
   - Request: `{ rows: [...reviewed normalized rows...], createMissingTeams?: true, overwriteScores?: false }` (`overwriteScores: true` returns `403` unless `current_user.admin?`).
   - Re-validates every row server-side inside `ActiveRecord::Base.transaction` (never trusts client preview flags!).
   - Rejects the batch with `422` if any submitted row has blocking errors.
   - Upserts teams (assigning matched `division_id` if blank), upserts games idempotently, preserves manual scores/status/links unless explicitly overwritten, and runs `Standings::Recompute.call(tournament)` once after commit.
   - Response: `{ createdTeams, createdGames, updatedGames, unchangedGames, recompute }`.
3. `POST /api/v1/admin/tournaments/:id/roster-import/preview` & `/commit`
   - Accepts CSV or pasted lines (`team, name, jersey_number, position, nickname`).
   - Preview matches `team` against `tournament.teams` (via exact name or `ClassArchive::TeamEntryLabels.canonical_label`), flags unmatched teams as errors and duplicate `(team, name)` rows as updates/skips.
   - Commit upserts `RosterEntry` rows atomically inside a transaction.
4. **Admin UI (`AdminScheduleImportPage.tsx` at `/admin/import`):**
   - Two tabs: **Schedule Import** and **Roster Import**.
   - Step 1: Upload `.csv` file OR paste text directly from the FDMSAA PDF.
   - Step 2: Interactive review table showing diff badges (`New`, `Update`, `Unchanged`, `Warning`, `Error`), inline division/phase dropdown overrides for flagged rows, ability to exclude individual rows, and new-team confirmation list.
   - Step 3: Commit button disabled while blocking errors exist; shows exact created/updated counts + link to `/admin/games`.
   - Keep `DataImport::Fd2026ScheduleImport` working for legacy seed compatibility while delegating/aligning its `phase` and `game_number` fields.

---

### 3.5 Guided Tournament Setup Wizard (2027, 2028, …)

- **Endpoint:** `POST /api/v1/admin/tournaments/setup` (`require_admin!`)
  - Request payload:
    - `tournament`: `{ name, year, startDate, endDate, status }`
    - `divisions`: array of `{ name, position, countsForStandings }` (defaults to `Division::DEFAULT_SPECS` if omitted)
    - `hostCampaign` (optional): `{ enabled: boolean, classCohortId, slug, title, tagline, goalCents, hafapassOrganizerSlug, hafapassTournamentOrganizerSlug, hafapassDistributionCode, copyBudgetFromCampaignId }`
  - Executes atomically in one transaction:
    1. Creates `Tournament`.
    2. Creates per-tournament `Division` rows.
    3. Optionally creates `HostCampaign` (in `draft` status, `featured: false`, `public_meter_enabled: false`) + optional cloned `BudgetLine` categories + `FinanceAuditEvent` (`create_campaign`).
  - Returns `{ tournament, divisions, hostCampaign }` (`201 Created`).
- **Admin UI (`AdminTournamentWizardPage.tsx` at `/admin/tournaments/setup`):**
  - 4-step wizard (`1. Tournament Details → 2. Divisions → 3. Host Class Campaign (optional) → 4. Review & Create`), pre-filled cleanly for the next tournament year (e.g., 2027 tentative Jun 25 – Jul 16, FD Phoenix Center), with post-create quick actions (`Import Schedule`, `Manage Teams`, `Invite Board Members`).

---

### 3.6 Sponsor Tiers

#### Schema Migration (`20261122000009_standardize_sponsor_tiers.rb`)
- Add `description` (`text`, nullable) to `sponsors`.
- Backfill existing `sponsors.tier`:
  - Normalize case-insensitively: `"diamond"` → `"diamond"`, `"platinum"` → `"platinum"`, `"gold"` → `"gold"`, `"silver"` → `"silver"`, `"community"` / `"community partner"` / blank → `"community"`.
  - Any unrecognized legacy string maps to `"community"` (preserving the raw label in `description` if `description` is blank so zero data is lost).
- Set `sponsors.tier` `default: "community"`, `null: false`, and add DB CHECK constraint `chk_sponsors_tier`: `tier IN ('diamond', 'platinum', 'gold', 'silver', 'community')`.
- Add index `[:tournament_id, :active, :tier, :position]`.

#### Model, API & UI
- `Sponsor::TIERS = %w[diamond platinum gold silver community].freeze`
- `Sponsor::TIER_LABELS = { "diamond" => "Diamond Sponsors", "platinum" => "Platinum Sponsors", "gold" => "Gold Sponsors", "silver" => "Silver Sponsors", "community" => "Community Partners" }.freeze`
- `Sponsor::TIER_ORDER_SQL`: deterministic `CASE tier WHEN 'diamond' THEN 1 WHEN 'platinum' THEN 2 WHEN 'gold' THEN 3 WHEN 'silver' THEN 4 ELSE 5 END`.
- Include `SafeUrlValidation` on `logo_url` and `target_url`.
- `Sponsor#api_json` includes `tier`, `tierLabel`, `tierRank`, `description`.
- `Public::SponsorsController#index` returns sponsors ordered by `TIER_ORDER_SQL, position, name`, plus `tiers` metadata.
- `SponsorsPage.tsx`: renders sections in strict `Diamond → Platinum → Gold → Silver → Community Partners` order with larger visual prominence for Diamond/Platinum, uses `externalHref(sponsor.targetUrl)` on every link, and degrades gracefully offline.
- `AdminSponsorsPage.tsx`: replaces freeform tier text input with a canonical tier `<select>` + optional `description` textarea.

---

### 3.7 Public Tickets Page (`/tickets`) Reading HåfaPass Events

#### Backend (`GET /api/v1/public/tickets`)
- **Controller:** `Api::V1::Public::TicketsController < BaseController`.
- Reuses `Hafapass::EventsClient` + `HafapassEventSnapshot` + `Hafapass::RefreshEventsJob` (zero new HTTP clients, zero synchronous network calls on public requests).
- Adds `Hafapass::EventsClient.for_tickets_page(campaign)`:
  - Reads snapshot for `campaign.hafapass_tournament_organizer_slug` (FDAA tournament org) and separately for `campaign.hafapass_organizer_slug` (host class fundraiser org), scheduling async background refresh if stale and outside error backoff.
  - Categorizes tournament events into:
    - `passes`: events where `isPass == true` (Season Pass, 2-Night Championship Pass)
    - `gameNights`: non-pass tournament events with `startsAt` (daily tickets, sorted chronologically)
    - `otherEvents`: any remaining tournament org events (e.g., Team Registration)
  - Also returns `fundraiserEvents` (upcoming open class fundraiser events) so visitors looking for tickets see both tournament and fundraiser tickets without confusion.
  - Returns `{ tournament, campaign: { slug, title, allTicketsUrl }, hafapass: { available, stale, fetchedAt }, passes, gameNights, otherEvents, fundraiserEvents, doorInfo }`.
  - `doorInfo`: practical static/structured guidance (cash accepted at door, free admission with ID for alumni on regular nights / children / seniors / FD students, venue `"FD Phoenix Center (The Jungle)"`).
- Fails gracefully when no campaign or no `hafapass_tournament_organizer_slug` is configured (`available: false`, empty arrays, `doorInfo` still populated).

#### Frontend (`web/src/pages/public/TicketsPage.tsx` at `/tickets`)
- Dedicated `/tickets` route in `App.tsx`, `PublicLayout.tsx` desktop nav, and **mobile bottom nav**:
  - Bottom nav becomes **Home · Schedule (or Today when `tournament.status === 'live'`) · Standings · Tickets · More** per Plan v5 §4.1!
  - Host Year stays in desktop nav, Home hero feature, and top of the More drawer.
- Layout:
  1. Featured **Passes** section (Season Pass & Championship Pass cards with live all-in price, status badge `On Sale` / `Sold Out` / `Upcoming`, subtle CSS hover lift per §4.4, deep link to HåfaPass `/go/:code` or `/events/:slug`).
  2. **Daily Game Nights** list with date, tip-off/doors time, min price, availability badge, and "Get Tickets" deep link.
  3. **Door & Admission Info** panel (cash at the door, free admission IDs, venue, storm-change reassurance).
  4. **Class Fundraiser Tickets** callout linking to `/host-year` when `fundraiserEvents` exist.
  5. Clean **Offline / Coming Soon** fallback when API is paused or HåfaPass snapshot isn't configured yet.

---

## 4. Milestone B2 — Game Night Design

### 4.1 Bracket / Playoff View & Winner Advancement

#### Backend
- `GET /api/v1/public/bracket?year=&divisionId=`:
  - Returns `{ tournament, divisions: [{ division: {...}, rounds: [{ round, label, games: [...] }] }] }` for all `phase: "playoff"` games grouped by `division_id` and `bracket_round` (`play_in` → `round_of_16` → `quarterfinal` → `semifinal` → `final` + `third_place`), ordered by `bracket_slot ASC, start_time ASC, id ASC`.
- **Winner Advancement Service (`Games::AdvanceBracketWinner`):**
  - Called when a `playoff` game is finalized (either via `Admin::GamesController#update` or `Admin::GamesController#score`), provided `game.next_game_id.present?`, `game.status == "final"`, `home_score != away_score`, and `!game.placeholder?`.
  - Locks `next_game` (`next_game.with_lock`):
    - Only advances if `next_game.status == "scheduled"` (never mutates a `live`/`final` downstream game!).
    - Determines winner (`home_score > away_score ? home_team : away_team`).
    - Updates `next_game.home_team` (if `next_game_slot == "home"`) or `next_game.away_team` (if `next_game_slot == "away"`), ONLY if the existing team in that slot is a placeholder team (`placeholder_team?`) OR matches the loser of the current game (re-correcting a score mistake before the next game tips off!).
    - Automatically sets `next_game.placeholder = false` once neither `home_team` nor `away_team` is a placeholder team.
- **Public UI (`web/src/pages/public/BracketPage.tsx` at `/bracket` + link from `/schedule`):**
  - Division filter tabs (`Maroon`, `Gold`, `Platinum`).
  - **Mobile (390px):** Clean round switcher pills (`Quarterfinals · Semifinals · Championship`) showing stacked matchup cards with seed/bracket code, scores, winner highlight, and status badge (zero microscopic zoomed-out SVG!).
  - **Desktop (1024px+):** Structured multi-column bracket grid aligned by round (`QF → SF → Final`) showing game numbers, tip-off times, live/final scores, and highlighted winners.
- **Admin UI (`AdminGamesPage.tsx`):**
  - Supports setting `phase`, `gameNumber`, `bracketRound`, `bracketSlot`, `nextGameId`, `nextGameSlot`, and `statusNote` cleanly.

---

### 4.2 `scorekeeper` Role, Phone Score Entry & Offline Retry

#### Role & RBAC Boundaries
- Add `"scorekeeper"` to `User::ROLES` (`%w[admin staff scorekeeper viewer]`) and `AdminWhitelist::ROLES` (`%w[admin staff scorekeeper viewer]`).
- `User#scorekeeper?` (`role == "scorekeeper"`), `User#can_score_games?` (`admin? || staff? || scorekeeper?`).
- `User#staff?` remains `admin? || role == "staff"` (strictly unchanged so `scorekeeper` cannot access any staff-only admin endpoint!).
- `User#api_json` adds `isScorekeeper: scorekeeper?`, `canScoreGames: can_score_games?`.
- `ClerkAuthenticatable#require_scorekeeper_or_staff!`: requires `current_user&.can_score_games?`, else `403 Forbidden`.
- **Exact backend permissions for `scorekeeper`:**
  - Allowed:
    - `GET /api/v1/me`
    - `GET /api/v1/admin/tournaments` (read-only selector)
    - `GET /api/v1/admin/games` & `GET /api/v1/admin/games/:id` (read-only)
    - `PATCH /api/v1/admin/games/:id/score` (narrow score-only endpoint!)
  - Denied (`403 Forbidden`):
    - `POST /api/v1/admin/games`, `PATCH /api/v1/admin/games/:id` (general edit of teams/times/links/notes)
    - All teams, divisions, rosters, links, sponsors, news, media, alerts, game-day-notes, polls, standings recompute, schedule import, tournaments write, campaigns, whitelists, ingest, and campaign finance/host-year endpoints (unless the user also holds an explicit `CampaignMembership`).
- **Admin People UI (`AdminPeoplePage.tsx`):** Add `"scorekeeper"` option to the whitelist role dropdown so admins can grant/revoke court-side scorekeeper access in one click.

#### Dedicated Score Endpoint (`PATCH /api/v1/admin/games/:id/score`)
- Permitted parameters ONLY: `homeScore`, `awayScore`, `status` (any of `Game::STATUSES`), `statusNote`, `lockVersion`, `forceOverwrite`, `clientMutationId`.
- **Idempotency (`clientMutationId`):**
  - If `clientMutationId` is present and matches `game.last_score_mutation_id`, immediately return `200 OK` with `{ game: game.api_json, idempotentReplay: true }` — preventing duplicate conflict popups when a phone retries after a lost HTTP response!
- **Optimistic Concurrency (`lockVersion`):**
  - If `lockVersion` is provided and `forceOverwrite` is not truthy: assign `game.lock_version = lockVersion.to_i`. If another user updated the game meanwhile, rescue `ActiveRecord::StaleObjectError` and return **`409 Conflict`** with `{ error: "This game was updated by another scorekeeper.", currentGame: game.reload.api_json }`.
- **Validation guards:**
  - Marking `status: "final"` requires both `homeScore` and `awayScore` present (non-negative integers, max 300).
  - Records `score_updated_by: current_user`, `score_updated_at: Time.current`, `last_score_mutation_id: clientMutationId`.
  - Triggers `Standings::Recompute.call(game.tournament)` when `game.phase == "pool"` (or status transitioned to/from `"final"`), and `Games::AdvanceBracketWinner.call(game)` when `game.phase == "playoff"` and `status == "final"`.

#### Phone-First Scorekeeper UI (`/admin/scorekeeper` — `AdminScorekeeperPage.tsx`)
- `AdminLayout.tsx`:
  - `RequireScorekeeperRoute` allows `isAdmin || isStaff || isScorekeeper`.
  - Scorekeeper-only users land automatically on `/admin/scorekeeper` and see only the **Scorekeeper** item in the nav.
- Mobile UX (built for one-handed gym table use at 390px, zero decorative motion):
  - Default filter: **Today's Games** (Guam date) with quick toggle to **All Tournament Games** and **Live / Unfinalized**.
  - Tap a game to expand/open its scorepad:
    - Large readable team names + giant score counters (`>= 48px` tap targets).
    - Quick increment buttons: `+1`, `+2`, `+3`, `-1` per team + direct numeric input.
    - One-tap status controls: **Tip-Off (Live)**, **Delay / Postpone** (with quick reason chips: `"Power outage"`, `"Weather / storm"`, `"Court delay"` + custom note), **Mark Final** (explicit confirm modal showing final score before locking).
- **Offline Retry Queue (`web/src/lib/scoreQueue.ts`):**
  - Persists pending score mutations in `localStorage` keyed by `fd_score_queue_v1:<userId>`, coalescing by `gameId` with a stable `clientMutationId` (`crypto.randomUUID()`).
  - If `PATCH .../score` fails due to network error (`!navigator.onLine` or `TypeError`/timeout/5xx), enqueues the mutation, shows an amber `"Saved on phone — waiting to sync (N)"` status bar, and auto-flushes on `window` `online` event + backoff timer (5s → 15s → 30s) + manual **"Sync now"** button.
  - On `409 Conflict`, stops auto-retrying that game and surfaces a clear two-button conflict card: **"Use latest server score (X–Y)"** or **"Keep my score (A–B)"** (sends `forceOverwrite: true`).

---

### 4.3 Site-Wide Storm / Delay Banner & Enhanced Today Page

#### Schema Migration (`20261122000010_create_tournament_alerts.rb`)
Create `tournament_alerts`:
- `tournament_id` (`bigint`, nullable — `nil` means site-wide across all tournaments; FK `tournaments`, `on_delete: :cascade`)
- `severity` (`string`, `null: false`, `default: "warning"`, CHECK `IN ('info', 'warning', 'urgent')`)
- `title` (`string`, `null: false`, max 140)
- `message` (`text`, `null: false`, max 1000)
- `active` (`boolean`, `null: false`, `default: true`)
- `starts_at` (`datetime`, nullable)
- `expires_at` (`datetime`, nullable)
- `created_by_id` (`bigint`, nullable, FK `users`, `on_delete: :nullify`)
- `updated_by_id` (`bigint`, nullable, FK `users`, `on_delete: :nullify`)
- `timestamps`
- Index: `[:active, :starts_at, :expires_at]` and `[:tournament_id, :active]`

#### API & UI
- `TournamentAlert.currently_active`: `where(active: true).where("starts_at IS NULL OR starts_at <= ?", now).where("expires_at IS NULL OR expires_at > ?", now).order(severity_priority, updated_at: :desc)` (`urgent` > `warning` > `info`).
- **Public:**
  - `GET /api/v1/public/alerts` returns `{ alerts: [...] }` (fast single-query endpoint consumed non-blockingly by `PublicLayout` so active storm/power-outage banners show on **every public page**, with zero failure impact when API is offline).
  - Also included on `GET /api/v1/public/today` (`alerts: [...]`) and `GET /api/v1/public/home` (`alerts: [...]`).
- **Admin (`Api::V1::Admin::AlertsController`, `require_staff!`):**
  - `GET / POST / PATCH / DELETE /api/v1/admin/alerts` (integrated directly into `AdminGameDayPage.tsx` with one-click `"Post Storm / Delay Alert"` and `"Clear Alert"` controls).
- **Enhanced `TodayPage.tsx`:**
  - Displays live/final scores prominently on every `TodayGameCard` (fixing the missing score display in current `TodayPage.tsx:124-143`).
  - Renders `delayed` / `postponed` / `cancelled` status badges and `game.statusNote` callout right on the card.
  - Falls back to the tournament's HåfaPass day ticket URL (from `HafapassEventSnapshot` / `/tickets`) when per-game `ticketUrl` is blank.

---

### 4.4 Vitest, Playwright Smoke Tests in CI & Brakeman in `scripts/gate.sh`

- **Vitest (`web/`):**
  - Add devDependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
  - Add `web/vitest.config.ts` and root + `web` `"test": "vitest run"` scripts.
  - Unit & component test suites covering:
    - `web/src/lib/__tests__/urls.test.ts` (`externalHref`, `safeHttpsHref`, XSS protocol rejection)
    - `web/src/lib/__tests__/datetime.test.ts` (Guam timezone formatting)
    - `web/src/lib/__tests__/scoreQueue.test.ts` (offline queue enqueue, coalesce, flush, 409 conflict handling, idempotent retry)
    - `web/src/lib/__tests__/sponsors.test.ts` (tier sorting & grouping)
    - `web/src/lib/__tests__/uploads.test.ts` (HEIF→HEIC normalization, 15MB limit, MIME rejection)
    - `web/src/components/__tests__/PublicLayout.test.tsx` (offline banner, storm alert banner, mobile nav accessibility)
- **Playwright Smoke Suite (`web/e2e/smoke.spec.ts`):**
  - Add `@playwright/test` + `web/playwright.config.ts` launching `vite preview` cleanly on `127.0.0.1:4173`.
  - Covers desktop (`1280×800`) + mobile (`390×844`) across `/`, `/host-year`, `/tickets`, `/schedule`, `/standings`, `/bracket`, `/today`, `/sponsors`, `/history`, and `/admin/campaign/finance` (offline graceful degradation + fail-closed Clerk gate), asserting: zero uncaught `pageerror`, zero unexpected console errors, zero horizontal overflow, >=44px mobile bottom nav touch targets, Escape focus restoration.
- **GitHub Actions CI (`.github/workflows/ci.yml`):**
  - `web` job runs: `npm ci` → `npm run build` → `npm test` (Vitest) → `npx playwright install --with-deps chromium` → `npm run test:e2e`.
  - `rails_api` job keeps: `brakeman`, `bundler-audit`, `rubocop`, `rails db:test:prepare test`.
- **Local Gate (`scripts/gate.sh`):**
  - Runs all 6 checks: `npm run build`, `npm test` (Vitest), `bundle exec brakeman --no-pager -q`, `bin/bundler-audit`, `bin/rubocop --no-color`, `bin/rails test`.

---

## 5. Milestone C — Close-Out & Handoff Tooling Design

### 5.1 Board Final Report (`HostCampaigns::FinalReport`)
- **Endpoint:** `GET /api/v1/campaign/:slug/finance/final-report` (`board`, `chair`, `treasurer`, `admin`, `Cache-Control: no-store`).
- **Payload:**
  - `campaign`: title, slug, host class, tournament year/dates/status, goal, status.
  - `tournamentOutcomes`: `{ teamsCount, poolGamesTotal, poolGamesFinal, playoffGamesTotal, playoffGamesFinal, scoreCoveragePercent, champions: [...] }` (from `tournament_champions` for that tournament/year).
  - `finance`: full `HostCampaigns::FinanceSummary` totals (raised by source, spent by budget category, budget vs actual variance, FDAA allocation + ticket share, net surplus, pledges promised/received/outstanding, reimbursements requested/approved/reimbursed).
  - `compliance`: `{ liveExpensesCount, expensesMissingReceiptCount, pendingReimbursementsCount, openCashPledgesCount, voidedEntriesCount, auditEventsCount, readyToArchive: boolean, blockers: [...] }`.
- **UI:** Dedicated **"Final Report & Close-Out"** sub-view/drawer inside `AdminCampaignFinancePage.tsx` (and linked from `AdminCampaignsPage.tsx`) with clean `@media print` styling (`Print / Save PDF`) plus JSON/CSV summary export.

### 5.2 Archive a Year (`POST /api/v1/admin/campaigns/:id/archive` + `GET .../closeout-check`)
- **`require_admin!`**.
- `GET /api/v1/admin/campaigns/:id/closeout-check` returns the structured readiness checklist (`unfinalizedGamesCount`, `pendingReimbursementsCount`, `openCashPledgesCount`, `missingReceiptsCount`, `championsRecordedCount`, `warnings`, `ready`).
- `POST /api/v1/admin/campaigns/:id/archive`:
  - Params: `{ completeTournament?: boolean (default true), forceReason?: string }`.
  - If open blockers exist (`pendingReimbursementsCount > 0` or `unfinalizedGamesCount > 0`) and `forceReason` is blank, returns `422` listing the unresolved items.
  - Atomically inside a transaction:
    1. Locks `campaign` (rejects with `422` if already archived).
    2. Updates `campaign.update!(status: "archived", featured: false)`.
    3. If `completeTournament` and `campaign.tournament.status != "completed"`, updates `campaign.tournament.update!(status: "completed")`.
    4. Writes `FinanceAuditEvent` (`action: "archive_campaign"`, `reason: forceReason`, `changes: { status: ["closing", "archived"], tournament_completed: true }`).

### 5.3 Clone Campaign for Next Host Class (`POST /api/v1/admin/campaigns/:id/clone`)
- **`require_admin!`**.
- Params:
  - `targetYear` (integer, e.g., `2028`), `tournamentName` (optional, default source tournament name), `startDate`, `endDate`, `targetTournamentId` (optional if tournament already exists)
  - `classCohortId` (e.g., Class of 2018), `slug` (e.g., `2028-class-of-2018`), `title`, `goalCents`
  - `copyDivisions` (default `true`), `copyBudgetCategories` (default `true`), `copyBudgetAmounts` (default `false`), `copyEventTemplates` (default `true`)
- Executes atomically inside a transaction:
  1. Finds `targetTournamentId` or creates a new `Tournament` (`status: "upcoming"`).
  2. If `copyDivisions` and target tournament has no divisions yet, clones source tournament's active `Division` rows (name, slug, position, `counts_for_standings`).
  3. Creates new `HostCampaign` in **`draft`** status (`featured: false`, `public_meter_enabled: false`, carrying over `fdaa_upfront_cents` / `fdaa_ticket_share_bps` defaults, clearing `hafapass_organizer_slug` / `hafapass_distribution_code` / `donation_url` / `golf_url` so prior class links can never leak into the new year!).
  4. If `copyBudgetCategories`, copies active `BudgetLine` rows (`budget_cents: copyBudgetAmounts ? line.budget_cents : 0`).
  5. If `copyEventTemplates`, copies active `CampaignEvent` templates (`kind`, `title`, `venue`, `description`, `position`) with `status: "planned"`, `starts_at: nil`, `ends_at: nil`, `date_label: "TBD"`, `public_visible: false`, and all HåfaPass/external URLs cleared!
  6. **Strict isolation invariant:** NEVER copies `ledger_entries`, `pledges`, `pending_receipt_uploads`, `finance_audit_events`, `campaign_memberships`, or `campaign_invitations`.
  7. Writes `FinanceAuditEvent` (`action: "clone_campaign"`, `changes: { cloned_from_campaign_id: source.id, ... }`) on the new campaign.
- **UI (`AdminCampaignsPage.tsx`):** Adds **"Close Out & Archive"** modal (showing readiness checklist) and **"Clone for Next Host Class"** modal right alongside each campaign row.

### 5.4 Board Handoff Runbook (`docs/BOARD-HANDOFF-RUNBOOK.md`)
- Plain-language guide for incoming host class officers covering:
  1. Role map (Admin vs Staff vs Scorekeeper vs Chair vs Treasurer vs Board).
  2. Onboarding a new host class (inviting emails, first login via Clerk, mobile home screen bookmark).
  3. Running fundraising & finance (recording income/expenses, snapping receipt photos, two-officer reimbursement approval, toggling the public fundraising meter).
  4. Linking HåfaPass fundraiser & tournament events.
  5. Pre-tournament setup wizard & importing the FDMSAA schedule PDF + rosters.
  6. Game-night operations (phone scorekeeper guide, offline gym Wi-Fi recovery, posting/clearing a storm/delay banner, bracket advancement).
  7. August close-out (printing the Final Report, archiving the year, cloning next year for the incoming host class).

---

## 6. PR-Sized Implementation Slices & Acceptance Checks

Every slice ships as an independent, CI-green, cross-family-reviewed PR in dependency order:

| Slice | Scope | Key Acceptance Checks |
|---|---|---|
| **B1.1 — Per-Tournament Divisions, Game Core Columns & Pool-Only Standings** | Migrations `000007` & `000008`, `Division` tournament scoping, `Game` `phase`/`game_number`/`bracket_*`/`status`/`status_note`/`lock_version` + `SafeUrlValidation`, `Standings::Recompute` lock + no-division exclusion + pool-only + 2-team H2H tiebreaker, per-division `Public::StandingsController` & `StandingsPage.tsx`, updated `AdminDivisionsPage` / `AdminGamesPage`. | Existing divisions/teams/games migrate with 0 orphans; cross-tournament division rejected (`422`); unassigned-division / Special / father-son / playoff / placeholder excluded from standings; `StandingsPage` groups by division starting at `#1`; all Rails tests + RuboCop + Brakeman + `npm run build` green. |
| **B1.2 — Generic Schedule & Roster Importer + Tournament Setup Wizard** | `Imports::ScheduleParser/Preview/Commit`, `Imports::RosterParser/Preview/Commit`, `POST /api/v1/admin/tournaments/setup`, `AdminScheduleImportPage.tsx` (`/admin/import`), `AdminTournamentWizardPage.tsx` (`/admin/tournaments/setup`). | Preview makes 0 DB writes; CSV and FDMSAA pasted text both parse into diff; unknown divisions & invalid times block commit; existing scores protected unless admin + `overwriteScores`; setup wizard creates tournament + divisions + optional draft campaign atomically. |
| **B1.3 — Sponsor Tiers & Public Tickets Page** | Migration `000009` (`sponsors.tier` canonical CHECK + `description` + `SafeUrlValidation`), `SponsorsPage.tsx` & `AdminSponsorsPage.tsx`, `GET /api/v1/public/tickets`, `Hafapass::EventsClient.for_tickets_page`, `TicketsPage.tsx` (`/tickets`), mobile bottom nav update (`Home · Schedule/Today · Standings · Tickets · More`). | Sponsors ordered strictly Diamond → Platinum → Gold → Silver → Community with `externalHref`; `/tickets` reads snapshots non-blockingly, separates Passes vs Game Nights, degrades gracefully offline; Playwright mobile/desktop QA passes. |
| **B2.1 — Bracket View, Winner Advancement, Storm Alerts & Enhanced Today Page** | Migration `000010` (`tournament_alerts`), `GET /api/v1/public/bracket`, `Games::AdvanceBracketWinner` (cycle-safe, placeholder-safe), `BracketPage.tsx` (`/bracket`), `Api::V1::Public::AlertsController` & `Admin::AlertsController`, site-wide banner in `PublicLayout`, enhanced `TodayPage.tsx` (scores + delay notes + ticket fallback) & `AdminGameDayPage.tsx`. | Playoff final advances winner into `next_game` without mutating live/final games; cycles rejected (`422`); active storm banner shows on all public pages and degrades silently offline; mobile bracket uses round switcher with 0 horizontal overflow. |
| **B2.2 — `scorekeeper` Role & Mobile Offline-Resilient Score Entry** | `scorekeeper` role across `User`/`AdminWhitelist`/`ClerkAuthenticatable`/`AdminPeoplePage`, `PATCH /api/v1/admin/games/:id/score` (optimistic `lockVersion` `409` + `last_score_mutation_id` idempotency), `web/src/lib/scoreQueue.ts`, `AdminScorekeeperPage.tsx` (`/admin/scorekeeper`), `AdminLayout` gating. | `scorekeeper` can score games and gets `403` on every non-scoring admin & campaign endpoint; duplicate `clientMutationId` replays `200` cleanly; stale `lockVersion` returns `409` with `currentGame`; offline queue persists and syncs on reconnect. |
| **B2.3 — Vitest, Playwright CI Smoke Suite & `scripts/gate.sh`** | Vitest setup + unit/component tests, Playwright `web/e2e/smoke.spec.ts` + `playwright.config.ts`, updated `.github/workflows/ci.yml` & `scripts/gate.sh`. | CI runs Vitest + Playwright Chromium smoke tests on every PR; `./scripts/gate.sh` runs build, Vitest, Brakeman, bundler-audit, RuboCop, and Rails tests. |
| **C.1 — Final Report, Year Archival, Next-Year Campaign Clone & Board Runbook** | `HostCampaigns::FinalReport`, `GET .../finance/final-report`, `GET .../closeout-check`, `POST .../archive`, `POST .../clone`, UI in `AdminCampaignFinancePage` & `AdminCampaignsPage`, `docs/BOARD-HANDOFF-RUNBOOK.md`. | Final report matches live summary + compliance counts; archive blocks open reimbursements/games unless explicit `forceReason`; clone creates next year's draft campaign/divisions/budgets/event templates with zero leaked ledger/pledge/membership rows; runbook covers full annual cycle. |

---

## 7. Security, Privacy & Concurrency Invariants

1. **Least-privilege RBAC:** `scorekeeper` is strictly narrower than `staff`; `campaign` roles remain isolated from tournament ops; `admin`-only actions (`divisions` write, `tournaments/setup`, `archive`, `clone`, `overwriteScores`, `people`/`whitelists`) enforce `require_admin!`.
2. **Fail-closed URL safety:** Every user- or import-supplied URL (`Game#stream_url`, `Game#ticket_url`, `Sponsor#logo_url`, `Sponsor#target_url`) passes `SafeUrlValidation` (`http`/`https` only, no userinfo) and `externalHref()` on the frontend.
3. **No synchronous external HTTP on public paths:** `/api/v1/public/tickets` and `/api/v1/public/today` only read `HafapassEventSnapshot` and enqueue `Hafapass::RefreshEventsJob`.
4. **Concurrency safety:** `Standings::Recompute` locks `@tournament`; `Games::AdvanceBracketWinner` locks `next_game`; scorekeeper updates use `lock_version` optimistic locking + `last_score_mutation_id` idempotency; `archive`/`clone` run inside explicit DB transactions.
5. **Cross-year isolation:** Cloning a campaign never copies prior financial entries, receipts, pledges, audit logs, board memberships, or prior HåfaPass/donation links.
