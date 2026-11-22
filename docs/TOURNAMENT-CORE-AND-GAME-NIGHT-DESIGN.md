# FD Alumni Hub — Tournament Core (B1), Game Night (B2), and Close-Out & Handoff (C) Design

- **Date:** 2026-11-22 (v2 — incorporates cross-family architecture review findings)
- **Status:** Revised implementation contract for Track 1 Milestones B1, B2, and C
- **Baseline:** `Shimizu-Technology/fd-alumni-hub` `main` at `066832b` (A1 Foundations #51, Host Year A2 #53–#58, Board Finance Tracker A3 #59–#61, and B2.3 Vitest/Playwright CI & `gate.sh` #63 merged)
- **Plan Reference:** `fd-co2017-host-year-plan-2026-11-21.md` (v5) §2.3, §4.1, §4.4, §5 Track 1
- **Related Docs:**
  - `docs/HOST-YEAR-AND-FINANCE-DESIGN.md` (A2/A3 contract)
  - `docs/DOMAIN-AND-CLERK-SETUP.md` (activation & Leon-gated steps)
  - `docs/S3-UPLOAD-SETUP.md` (public media + private receipt buckets)

---

## 1. Goals & Non-Goals

### Goals
1. **Milestone B1 (Tournament Core):** Make the tournament data model and operator workflows cleanly multi-year, reusable across 2027, 2028, and future host classes without hard-coded 2026 scripts or global division leaks:
   - Per-tournament `divisions` with explicit `counts_for_standings` and zero-data-loss migration.
   - First-class `phase`, `game_number`, bracket wiring, delay/postpone status, optimistic `lock_version`, and safe HTTPS URLs on `games`.
   - Per-division pool-only standings (excluding unassigned-division teams, non-standings divisions like `Special`, father-son games, playoffs, exhibitions, and placeholders) with persisted `division_rank` and locked recomputation.
   - Generic CSV / FDMSAA PDF-text schedule and roster importer with dry-run review, unmatched-game visibility, and atomic commit.
   - Guided new-tournament Setup Wizard (2027, 2028, …) sharing `Tournaments::Bootstrap` with Campaign Clone.
   - Standardized, tier-ranked sponsor tiers (`diamond`, `platinum`, `gold`, `silver`, `community`) with hardened HTTPS URLs.
   - Public `/tickets` page reading HåfaPass events via the existing non-blocking `Hafapass::EventsClient` + `HafapassEventSnapshot` contract.
2. **Milestone B2 (Game Night):** Make running live games inside The Jungle reliable on phones even with spotty gym Wi-Fi or typhoon reschedules:
   - Playoff bracket view (`/bracket`) with round-by-round mobile UX and safe winner advancement.
   - Dedicated least-privilege `scorekeeper` role + mobile-first `/admin/scorekeeper` screen with optimistic locking (`409` conflict handling across **all** game write endpoints) and local offline retry queue with digest-checked idempotent replay.
   - Enhanced `/today` page (live scores, delay badges, HåfaPass ticket fallback) + site-wide `tournament_alerts` storm/delay banner.
   - *(Completed in PR #63, `066832b`)* Vitest unit tests, Playwright Chromium smoke tests in CI, and `brakeman` + `bundler-audit` + Vitest enforced in `scripts/gate.sh`.
3. **Milestone C (Close-Out & Handoff):** Make August wrap-up and Class-of-2017 → Class-of-2018 handoff repeatable in minutes:
   - Printable/exportable Board Final Report (tournament outcomes + full finance reconciliation + compliance checks).
   - Checked archival workflow (single enforced path; direct `status: "archived"` updates blocked on generic campaign PATCH).
   - Strict allowlist Campaign Clone creating the next host class's draft campaign, tournament, divisions, budget categories, and event templates without leaking prior financial records, donation instructions, or board memberships.
   - Non-technical `docs/BOARD-HANDOFF-RUNBOOK.md`.

### Non-Goals
- **No external infra mutations:** Render API, Clerk production, Netlify env vars, DNS, and S3 remain paused/untouched until Leon runs the activation checklist in `docs/DOMAIN-AND-CLERK-SETUP.md`. Every new public route (`/tickets`, `/bracket`) degrades gracefully while the API is offline.
- **No payment processing on the hub:** Tickets and team registration checkout stay on HåfaPass (`/go/:code` deep links); golf stays on HafaGolf; donations link out.
- **No decorative motion on admin/scorekeeper/bracket operational screens:** Follow plan v5 §4.4 (restrained hover/reveal only on public pages; zero animation library).

---

## 2. Current Schema & Code Audit (Verified on `main` `066832b`)

| Area | Current State in Code | Gaps Addressed Here |
|---|---|---|
| `divisions` (`api/db/schema.rb:176-186`, `api/app/models/division.rb`, `api/db/seeds.rb:4-36`) | Global table (`slug` globally unique, `starts_year`, no `tournament_id`). Legacy `Diamond` was globally deactivated (`20261122000001`). `seeds.rb` creates global divisions before any tournament and queries `Division.find_by!(name: "Maroon")`. | Scope divisions per tournament (`tournament_id NOT NULL`, `counts_for_standings`), keep referenced historical divisions active for their tournament, update `seeds.rb`, and retire `startsYear` UI in `AdminDivisionsPage`. |
| `games` (`api/db/schema.rb:219-247`, `api/app/models/game.rb`, `Admin::GamesController`, `Admin::LinksController`) | `STATUSES = %w[scheduled live final]`. No `phase`, `game_number`, bracket fields, `status_note`, `lock_version`, or score audit columns. Legacy `stream_url`/`ticket_url` may contain bare domains or `http://` (`next_prisma_snapshot/import.rb:129-130`); `SafeUrlValidation` (`safe_url_validation.rb:39`) is HTTPS-only. `AdminGamesPage#saveDetails` always resends stale `status`. | Add core columns + CHECK constraints, normalize legacy URLs in migration + validate on change, add `lock_version` optimistic locking across **all** game update paths (including `Admin::GamesController#update` and `AdminGamesPage` / `AdminMissingLinksPage`), and split details saves from score/status saves. |
| `standings` (`api/app/services/standings/recompute.rb`, `Standing.ranked`, `Public::StandingsController`, `Admin::StandingsController`, `HistoryDetailPage`) | Does not exclude `division_id IS NULL`; `plan` runs outside any tournament lock; `Standing.ranked` sorts in SQL (`wins DESC, losses ASC, points_for DESC, points_against ASC`); `scoreCoverage` counts all games rather than pool games. | Run `plan` + `delete` + `insert` inside `@tournament.with_lock`; exclude unassigned-division & non-standings divisions; persist `division_rank` computed by one canonical Ruby `Standings::Ranker`; expose per-division groups + pool-only `scoreCoverage` across public, admin, and history consumers. |
| Schedule import (`api/app/services/data_import/fd_2026_schedule_import.rb`) | Hard-coded to 2026 JSON; never sets team/game divisions (`:66-75`). No web UI or dry-run preview. | Generic CSV & FDMSAA PDF-text schedule + roster parsers with zero-write preview (including unmatched existing games for typhoon reschedules) and atomic commit. |
| `sponsors` (`api/db/schema.rb:459-473`, `api/app/models/sponsor.rb`, `TodayController:26`, `SponsorsPage.tsx:47`) | Unvalidated freeform `tier`; raw `href={sponsor.targetUrl}` without `externalHref()`; legacy URLs may be bare/`http://`; `TodayController` ignores tier ordering. | Canonical tiers (`diamond` → `platinum` → `gold` → `silver` → `community`), careful backfill mapping `"Title"`/`"Presenting"` → `"diamond"`, URL normalization migration + `SafeUrlValidation` on change, tier-ordered `SponsorsController` & `TodayController`, `safeHttpsHref` in `SponsorsPage`. |
| Tickets (`web/src/App.tsx`, `web/src/components/PublicLayout.tsx`) | No `/tickets` route. `Hafapass::EventsClient` already manages non-blocking snapshots (`hafapass_event_snapshots` + `Hafapass::RefreshEventsJob`). | Add `GET /api/v1/public/tickets` (public campaigns only via `HostCampaign.resolve_public`, filtered to tournament window, defined stale-snapshot badges) + `/tickets` page + mobile bottom nav update. |
| Roles (`api/app/models/user.rb`, `admin_whitelist.rb`, `clerk_authenticatable.rb`, `Admin::BaseController:5`) | `ROLES = %w[admin staff viewer]`. `Admin::BaseController` enforces `require_staff!` globally. | Add `scorekeeper` role with explicit `skip_before_action :require_staff!` + `require_scorekeeper_or_staff!` ONLY on read-only tournaments/games + `PATCH .../score`, restricted to `live`/`upcoming` tournaments and non-finalized games. |
| Today & Alerts (`TodayController`, `TodayPage.tsx:124-143`) | `game_day_notes` is per-date only; `TodayGameCard` does not display live/final scores or delay notes. | Add `tournament_alerts` (scoped to `tournament_id IS NULL OR current tournament`), render scores + delay notes + HåfaPass ticket fallback on `TodayPage`. |
| CI & Gate (`.github/workflows/ci.yml`, `scripts/gate.sh`) | **Completed in PR #63 (`066832b`):** Vitest (`7` files / `16` tests), Playwright Chromium E2E (`4` smoke specs + failure trace upload), and `gate.sh` (`build` + `Vitest` + `brakeman` + `bundler-audit` + `rubocop` + `rails test`). | Extend Vitest & Playwright specs with each new B1/B2/C slice. |

---

## 3. Milestone B1 — Tournament Core Design

### 3.1 Per-Tournament Divisions (`divisions`)

#### Schema Migration (`20261122000007_scope_divisions_to_tournaments.rb`, irreversible `down` raising `ActiveRecord::IrreversibleMigration`)
- Add columns to `divisions`:
  - `tournament_id` (`bigint`, nullable during backfill, then `null: false`, FK `tournaments`, `on_delete: :cascade`)
  - `counts_for_standings` (`boolean`, `null: false`, `default: true`)
- Remove global unique index `index_divisions_on_slug`.
- **Idempotent zero-data-loss backfill** (using anonymous `Class.new(ActiveRecord::Base)` models inside the migration):
  1. For each `Tournament`:
     - Find every global `divisions` row (`tournament_id IS NULL`) that is either:
       - referenced by any `team.division_id` or `game.division_id` in that tournament, **OR**
       - matched case-insensitively by any non-blank `team.division` or `game.division` in that tournament, **OR**
       - currently `active = true AND (starts_year IS NULL OR starts_year <= tournament.year)`.
     - Insert a per-tournament `Division` row (`tournament_id = t.id`, `name`, `slug`, `position`, `counts_for_standings = (name.downcase != 'special')`).
     - **Historical preservation rule (M2):** Any division actually referenced by a `team` or `game` in that tournament is created with **`active: true`** for that tournament even if the legacy global row (e.g., `Diamond`) was later deactivated globally. This prevents historical standings from losing teams on recompute.
     - For any non-blank legacy `team.division` or `game.division` string in that tournament that matches **no** global division row, create an active per-tournament `Division` (`counts_for_standings: (label.downcase != 'special')`) so zero legacy assignments are dropped.
     - Re-point `teams.division_id` (and `teams.division`) and `games.division_id` (and `games.division`) in that tournament to the tournament's new `Division` rows.
  2. Safety assertion before cleanup: verify `teams` and `games` have zero rows pointing to `divisions WHERE tournament_id IS NULL`.
  3. Delete all legacy global rows (`DELETE FROM divisions WHERE tournament_id IS NULL`).
- Set `change_column_null :divisions, :tournament_id, false`.
- Add indexes:
  - `index_divisions_on_tournament_and_slug`: `[:tournament_id, :slug]`, `unique: true`
  - `index_divisions_on_tournament_and_lower_name`: `"tournament_id, lower((name)::text)"`, `unique: true`
  - `index_divisions_on_tournament_active_position`: `[:tournament_id, :active, :position]`

#### Model, Seeds & Controller Contract
- `Division`:
  - `belongs_to :tournament`
  - `DEFAULT_SPECS = [{ name: "Maroon", position: 1, counts_for_standings: true }, { name: "Gold", position: 2, counts_for_standings: true }, { name: "Platinum", position: 3, counts_for_standings: true }, { name: "Special", position: 4, counts_for_standings: false }].freeze`
  - `validates :name, presence: true, uniqueness: { scope: :tournament_id, case_sensitive: false }`
  - `validates :slug, presence: true, uniqueness: { scope: :tournament_id }`
  - `scope :for_tournament, ->(tournament) { where(tournament_id: tournament.respond_to?(:id) ? tournament.id : tournament) }`
  - `scope :standings_eligible, -> { active.where(counts_for_standings: true) }`
  - `Tournament#ensure_default_divisions!` idempotently creates `Division::DEFAULT_SPECS` for a tournament (called by `Tournaments::Bootstrap`, `db:seed`, and `POST /api/v1/admin/tournaments` when `seedDefaultDivisions` is truthy).
  - `after_update :sync_assigned_names` updates `division` text on its own tournament's `teams`/`games`; if `saved_change_to_counts_for_standings?` or `saved_change_to_active?`, triggers `Standings::Recompute.call(tournament)`.
- `Team` & `Game`:
  - Validate `division_record.tournament_id == tournament_id` (blocks cross-tournament division linking).
  - `Team#special_division?` uses `division_record ? !division_record.counts_for_standings? : resolved_division.to_s.casecmp?("Special")`.
- `api/db/seeds.rb` & existing tests:
  - Remove top-level global `Division.find_or_create_by!` loop before tournaments exist; instead call `tournament.ensure_default_divisions!` on each seeded tournament and look up `tournament.divisions.find_by!(name: "Maroon")`.
  - Rewrite year-based `division_test.rb` assertions to test per-tournament scoping & cross-tournament rejection.
- `Api::V1::Admin::DivisionsController` & `AdminDivisionsPage.tsx`:
  - Scoped strictly to `admin_tournament` (`GET`, `POST`, `PATCH`; `POST`/`PATCH` require `require_admin!`; `tournament_id` immutable on update).
  - Remove obsolete `startsYear` form input from `AdminDivisionsPage.tsx` and add `countsForStandings` checkbox.
- **B1.1 acceptance requirement (M2):** Run `DRY_RUN=1 bin/rails fd:standings:recompute_all` on seeded/test datasets before and after the migration and verify any historical team exclusions (e.g., 2026 teams lacking divisions) are explicitly surfaced in the PR summary and handled without silent emptiness.

---

### 3.2 First-Class Game Fields, HTTPS URL Cleanup & Optimistic Locking

#### Schema Migration (`20261122000008_add_tournament_core_fields_to_games.rb`, irreversible `down` on URL normalization)
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
- `last_score_mutation_digest` (`string`, nullable)
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
- `index_games_on_next_game_slot_unique` **(M1)**: `[:next_game_id, :next_game_slot]`, `unique: true`, `where: "(next_game_id IS NOT NULL)"` — prevents two feeder games from pointing to the same downstream slot.

#### Backfill & Legacy URL Normalization (H1)
1. **Phase & game_number backfill:**
   - `'fatherson'` if `notes` includes `phase=fatherson` or `bracket_code ~* '^FS'`
   - `'playoff'` if `notes` includes `phase=playoff` or `bracket_code ~* '^([WL]?(MP|GP|PP)|[MGP]?(QF|SF|F)|L)[0-9]*$'`
   - Otherwise `'pool'`
   - Copy unique per-tournament `bracket_code` into `game_number` (skipping any duplicates safely).
2. **Stored URL normalization on `games.stream_url` & `games.ticket_url` (H1):**
   - Policy decision: **HTTPS-only** via existing `SafeUrlValidation` (`api/app/models/concerns/safe_url_validation.rb:39`, allowing `http://localhost` / `http://127.0.0.1` only in dev/test).
   - Migration normalizes existing rows before enforcing validation: trims whitespace, converts `//host/...` → `https://host/...`, converts `http://host/...` → `https://host/...`, prefixes bare domains (`guamtime.net/...`) with `https://`, and sets unparseable / non-HTTP(S) / userinfo URLs to `NULL` while logging a summary count + affected game IDs.
   - Model backstop: `validate :validate_safe_urls` runs `if: :will_save_change_to_stream_url?` and `if: :will_save_change_to_ticket_url?` so an untouched legacy URL can **never** block a game-night score update or unrelated edit.
   - `Game#external_url` fails closed to `nil` for non-`https:` URLs (except dev/test localhost).
   - Admin link/game forms (`AdminGamesPage.tsx`, `AdminLinksPage.tsx`, `AdminMissingLinksPage.tsx`) normalize and validate with `safeHttpsHref` (auto-upgrading bare domains / `http://` to `https://` before submit or rejecting unsafe protocols cleanly).

#### Bracket Graph Validation (L2)
- `next_game` must belong to the same `tournament_id`, have `phase IN ("playoff", "fatherson")` (allowing Father-Son mini-brackets while excluding `pool`/`exhibition`), and match `division_id` when both have divisions set.
- Cycle detection walks `next_game_id` up to `MAX_BRACKET_DEPTH = 8` hops; if the walk hits `self.id` OR exceeds 8 hops without terminating, reject with a validation error (`422`).
- `last_score_mutation_id` validated when present: `\A[a-zA-Z0-9_-]{8,64}\z`.

#### Universal Optimistic Locking on All Game Writes (H2)
- Because `games.lock_version` enables ActiveRecord optimistic locking for every `Game` save:
  - **Every** write endpoint (`PATCH /api/v1/admin/games/:id`, `PATCH /api/v1/admin/games/:id/score`, and `PATCH /api/v1/admin/links/bulk`) accepts optional `lockVersion` (required on `.../score` unless `forceOverwrite: true`) and rescues `ActiveRecord::StaleObjectError` → **`409 Conflict`** with `{ error: "This game was updated by another user. Reload to review the latest values.", currentGame: game.reload.api_json }`.
  - `AdminGamesPage.tsx`:
    - Sends `lockVersion: game.lockVersion` on every save.
    - **`saveDetails` stops sending `status`, `homeScore`, and `awayScore`** (only sends schedule/venue/division/phase/links/notes fields), so staff fixing a stream URL can never overwrite a scorekeeper's `final` result!
    - Quick-score controls on `AdminGamesPage.tsx` route through `PATCH /api/v1/admin/games/:id/score` with `lockVersion` and handle `409 Conflict` with a reload prompt.
  - `AdminMissingLinksPage.tsx`: sends `lockVersion` per link item (or updates only `streamUrl`/`ticketUrl` via `LinksController#bulk_update`, which skips `status`/`scores` and surfaces per-game `409` cleanly).

---

### 3.3 Per-Division Pool-Only Standings

#### Schema Addition (in migration `000008` or dedicated `000009` step inside B1.1)
- Add `division_rank` (`integer`, nullable) to `standings` + index `[:tournament_id, :division_rank]`.

#### Exclusion & Computation Rules (`Team`, `Game`, `Standings::Recompute`, `Standings::Ranker`)
- **Eligible Teams:** Must belong to the tournament AND:
  1. `division_id.present?` (`"no_division"` — hides teams with no division assigned yet).
  2. `division_record.active? && division_record.counts_for_standings?` (`"non_standings_division"` — excludes `Special`).
  3. `!fatherson_team?` (`"fatherson_team"`).
  4. `!placeholder_team?` (`"placeholder_team"`).
- **Counted Games:** Must belong to the tournament AND:
  1. `status == "final"` with non-nil `home_score` and `away_score`.
  2. `!placeholder?`.
  3. `phase == "pool"` (`"non_pool_phase"` — excludes `playoff`, `fatherson`, `exhibition`).
  4. Both `home_team` and `away_team` are eligible AND `home_team.division_id == away_team.division_id` (`"cross_division"`).
  5. If `game.division_id.present?`, `game.division_record.counts_for_standings?` is `true` and matches teams' `division_id`.
- **Full-Scope Concurrency Lock (H3):**
  - `Standings::Recompute#call` executes **both `plan` (all reads) AND `delete_all` + `create!` (all writes) inside `@tournament.with_lock`**, eliminating lost updates when two courts finish simultaneously. Covered by a multi-thread / sequential race regression test.
- **Canonical Ranking & Tiebreakers (`Standings::Ranker`, persisted to `standings.division_rank`) (M3):**
  - Computed **per division** from counted pool games and persisted to `standings.division_rank` (`1..N` within each division) so **every** consumer (`Standing.ranked` → `order(Arel.sql("division_rank ASC NULLS LAST, wins DESC, losses ASC, (points_for - points_against) DESC, points_for DESC, id ASC"))`, public standings, admin standings, team profile, class profile) agrees 100%:
    1. **Win percentage** (`wins.to_f / games_played`, treating 0-0 teams as `0.0` ranked below teams with wins and above winless teams with losses — handles uneven mid-pool games played cleanly; when games played are equal, identical to `wins DESC, losses ASC`).
    2. **Wins DESC, Losses ASC** (distinguishes `0-0` vs `0-2`).
    3. **Two-team head-to-head pool record:** when a tied group has **exactly 2 teams** and they have a decisive pool head-to-head differential, the H2H winner ranks higher.
    4. **Point differential DESC** (`points_for - points_against`) — intentional improvement over the legacy SQL `points_for DESC, points_against ASC` tiebreaker to match FDMSAA basketball standings rules. If point differential splits a 3+-way tie down to a remaining 2-team tie, **re-apply step 3 (head-to-head)** to that remaining pair once.
    5. **Points for DESC**.
    6. **Display name ASC**.
- **Score Coverage Consistency (L5):**
  - `scoreCoverage` across `Public::StandingsController`, `Admin::StandingsController`, and `HistoryDetailPage` counts **eligible pool games** (`scoredPoolGames`, `totalPoolGames`, `percent`), keeping `scoredGames` and `totalGames` as matching aliases for backward compatibility and clearly labeling it **"Pool score coverage"** in the UI.
- **Public API (`GET /api/v1/public/standings`):**
  - Returns `divisionStandings: [{ division: { id, name, slug, position }, standings: [...with rank: division_rank...], scoreCoverage: {...} }]` ordered by `division.position`, alongside top-level `standings`, `divisions`, and `scoreCoverage`.
- **Public UI (`StandingsPage.tsx`):** Renders one clean table per division (each starting at `#1`) when "All divisions" is selected, or the selected division when filtered.

---

### 3.4 Generic Schedule & Roster Importer (Dry-Run Review → Commit)

#### Authorization Decision (M9)
- Preview (`schedule-import/preview`, `roster-import/preview`) and standard commit (`schedule-import/commit`, `roster-import/commit`) require **`require_staff!`** (staff runs tournament operations per Plan v5 §4.1).
- Setting `overwriteScores: true` on schedule commit requires **`current_user.admin?`** (`403 Forbidden` for non-admin staff).

#### Schedule Import (`Imports::ScheduleParser`, `Imports::SchedulePreview`, `Imports::ScheduleCommit`)
1. `POST /api/v1/admin/tournaments/:id/schedule-import/preview`
   - Request: `{ format: "csv" | "fdmsaa_text" | "auto", content: string, defaultVenue?: string }` (max 500 KB, max 400 rows).
   - **Zero-write invariant:** Never writes to `teams`, `games`, `class_cohorts`, or `divisions` during preview. Uses read-only `ClassArchive::TeamEntryLabels.canonical_label` and `ClassArchive::Resolver.class_keys`.
   - Matches divisions case-insensitively against `tournament.divisions` (never auto-creates unknown divisions).
   - Matches existing games by `(tournament_id, lower(game_number))` first, then `(tournament_id, start_time, home_team_id, away_team_id)`.
   - Classifies each row (`create` | `update` | `unchanged` | `error`) with explicit `errors` and `warnings`.
   - **Typhoon reschedule safety (M9):** Preview also computes and returns `unmatchedExistingGames`: any non-cancelled existing game in the tournament not matched by any row in the import (with its current `gameNumber`, `startTime`, matchup, and whether it already has scores), so operators immediately spot renumbered/rescheduled games instead of silently creating duplicates!
2. `POST /api/v1/admin/tournaments/:id/schedule-import/commit`
   - Re-validates every submitted row server-side inside `@tournament.with_lock` + `ActiveRecord::Base.transaction`.
   - Rejects with `422` if any row has blocking errors.
   - Upserts teams and games idempotently, preserves manual scores/status/links unless `overwriteScores: true` (admin-only), and runs `Standings::Recompute.call(tournament)` once after commit.

#### Roster Import (`Imports::RosterParser`, `Imports::RosterPreview`, `Imports::RosterCommit`) (M9)
- Migration adds unique index `index_roster_entries_on_team_and_lower_name`: `"team_id, lower(btrim((name)::text))"` (deduplicating any existing duplicate `(team_id, lower(trim(name)))` rows safely beforehand, keeping the most recently updated entry).
- Preview matches `team` against `tournament.teams` (exact or canonical label), reports creates/updates/unmatched-team errors with zero DB writes.
- Commit acquires `@tournament.with_lock` and atomically upserts `RosterEntry` records.

#### Admin UI (`AdminScheduleImportPage.tsx` at `/admin/import`)
- Two tabs (**Schedule Import** and **Roster Import**): upload CSV or paste FDMSAA PDF text → interactive diff table (with inline division/phase fixes, row exclusion, and `unmatchedExistingGames` warning list) → atomic Commit.
- Legacy `DataImport::Fd2026ScheduleImport` is updated to populate `phase` and `game_number` cleanly so `db:seed` stays consistent.

---

### 3.5 Guided Tournament Setup Wizard & Shared Bootstrap Service (L5)

- **Shared Service (`Tournaments::Bootstrap`):** Used by **both** the Setup Wizard (`POST /api/v1/admin/tournaments/setup`) and Campaign Clone (`POST /api/v1/admin/campaigns/:id/clone`), guaranteeing consistent transactional creation of `Tournament` + per-tournament `Division`s + optional `HostCampaign` (always `draft`, `featured: false`, `public_meter_enabled: false`) + optional cloned `BudgetLine`s + `FinanceAuditEvent`.
- **Endpoint:** `POST /api/v1/admin/tournaments/setup` (`require_admin!`) returns `201 Created` with `{ tournament, divisions, hostCampaign }`.
- **Admin UI (`AdminTournamentWizardPage.tsx` at `/admin/tournaments/setup`):** 4-step wizard (`1. Tournament Details → 2. Divisions → 3. Host Class Campaign (optional) → 4. Review & Create`), pre-filled for the next year (e.g., 2027), with post-create jump links to `/admin/import`, `/admin/divisions`, and `/admin/people`.

---

### 3.6 Sponsor Tiers

#### Schema Migration (`20261122000009_standardize_sponsor_tiers.rb`, irreversible `down` on tier/URL normalization)
- Add `description` (`text`, nullable) to `sponsors`.
- **Careful tier backfill (L4):**
  - Normalize case-insensitively:
    - `"diamond"`, `"title"`, `"presenting"`, `"presenting sponsor"`, `"title sponsor"` → `"diamond"` (never demotes major sponsors!)
    - `"platinum"` → `"platinum"`
    - `"gold"` → `"gold"`
    - `"silver"` → `"silver"`
    - `"community"`, `"community partner"`, `"bronze"`, blank → `"community"`
  - Any other unrecognized label maps to `"community"` and logs the original `(sponsor_id, name, old_tier)` to migration stdout for operator review (never silently exposing raw internal labels into public `description` unless non-internal).
- **Sponsor URL normalization (H1):** Normalize `sponsors.logo_url` and `sponsors.target_url` to HTTPS (`//` → `https:`, `http://` → `https://`, bare domain → `https://`, invalid → `NULL` with stdout log).
- Set `sponsors.tier` `default: "community"`, `null: false`, add CHECK `chk_sponsors_tier`: `tier IN ('diamond', 'platinum', 'gold', 'silver', 'community')`, and add index `[:tournament_id, :active, :tier, :position]`.

#### Model, API & UI
- `Sponsor::TIERS = %w[diamond platinum gold silver community].freeze`
- `Sponsor::TIER_LABELS` & `Sponsor.ordered_by_tier` (`CASE tier WHEN 'diamond' THEN 1 WHEN 'platinum' THEN 2 WHEN 'gold' THEN 3 WHEN 'silver' THEN 4 ELSE 5 END, position ASC, name ASC`).
- Include `SafeUrlValidation` on `logo_url` and `target_url` with `if: :will_save_change_to_logo_url?` / `if: :will_save_change_to_target_url?`.
- Update **both** `Public::SponsorsController#index` AND `Public::TodayController#show` (L4) to sort sponsors with `ordered_by_tier`.
- `SponsorsPage.tsx`: renders sections in strict `Diamond → Platinum → Gold → Silver → Community Partners` order with tier-scaled card prominence and `safeHttpsHref(sponsor.targetUrl)`.
- `AdminSponsorsPage.tsx`: canonical tier `<select>` + optional `description` textarea + `safeHttpsHref` normalization.

---

### 3.7 Public Tickets Page (`/tickets`) Reading HåfaPass Events

#### Backend (`GET /api/v1/public/tickets`)
- **Public campaign resolution (M8):** Uses `HostCampaign.resolve_public(slug: params[:campaignSlug], year: params[:year])` — strictly restricted to `FEATUREABLE_STATUSES` (`active`, `closing`) so `draft` campaigns are never exposed.
- Reuses `Hafapass::EventsClient` + `HafapassEventSnapshot` + `Hafapass::RefreshEventsJob` (zero synchronous HTTP calls).
- **Tournament-year event filtering (M8):** Because the FDAA tournament organizer slug (`hafapass_tournament_organizer_slug`) is shared across years, `Hafapass::EventsClient.for_tickets_page(campaign)` filters FDAA org events to the campaign's tournament window (`startsAt` between `tournament.start_date - 120.days` and `tournament.end_date + 45.days`, OR `startsAt` nil when `title`/`slug` does not reference a different year), preventing prior-year events from leaking into `otherEvents`.
- Categorizes tournament events into `passes` (`isPass == true`), `gameNights` (chronological single-night events), and `otherEvents` (e.g., team registration), plus `fundraiserEvents` (from `hafapass_organizer_slug` / `campaign_events`).
- **Stale snapshot fallback (M8):** When `hafapass.stale` is true (where `present_event` intentionally clears `ticketState` and prices to `nil`), cards render a neutral `"Check live availability on HåfaPass"` badge and direct buy link rather than showing stale prices or misleading "Sold out" / "On sale" pills.
- Returns `{ tournament, campaign: { slug, title, allTicketsUrl }, hafapass: { available, stale, fetchedAt }, passes, gameNights, otherEvents, fundraiserEvents, doorInfo }`.

#### Frontend (`web/src/pages/public/TicketsPage.tsx` at `/tickets`)
- Added to `App.tsx`, `PublicLayout.tsx` desktop nav, and **mobile bottom nav** per Plan v5 §4.1: **Home · Schedule (switches to Today when `tournament.status === 'live'`) · Standings · Tickets · More** (Host Year remains in desktop nav, Home hero feature, and top of More drawer).
- Subtle CSS hover lift on pass cards only (§4.4); degrades gracefully offline with Door & Admission Info panel intact.

---

## 4. Milestone B2 — Game Night Design

### 4.1 Bracket / Playoff View & Winner Advancement

- `GET /api/v1/public/bracket?year=&divisionId=`: returns `{ tournament, divisions: [{ division, rounds: [{ round, label, games }] }] }` for `phase: "playoff"` games grouped by `division_id` and `bracket_round`, ordered by `bracket_slot ASC, start_time ASC, id ASC`.
- **Winner Advancement Service (`Games::AdvanceBracketWinner`):**
  - Runs when a game with `next_game_id.present?`, `status == "final"`, `home_score != away_score`, and `!placeholder?` is saved.
  - Acquires `next_game.with_lock`:
    - Only modifies `next_game` while `next_game.status == "scheduled"` (never touches `live`/`final` downstream games).
    - Placeholder detection uses the existing `Team#placeholder_team?` predicate (`api/app/models/team.rb:36-44`) **(M1)**.
    - Updates target slot (`home_team` or `away_team`) ONLY if the current slot holds a `placeholder_team?` OR holds the loser of the current game (safe score correction before tip-off).
    - Clears `next_game.placeholder = false` once neither `home_team` nor `away_team` is a `placeholder_team?`.
- **Public UI (`BracketPage.tsx` at `/bracket` + link from `/schedule`):** Division tabs, mobile round-switcher pills at 390px (zero horizontal overflow), multi-column bracket grid on desktop (`1024px+`).

---

### 4.2 `scorekeeper` Role, Phone Score Entry & Offline Retry

#### Least-Privilege RBAC Mechanism (M4)
- Add `"scorekeeper"` to `User::ROLES` (`%w[admin staff scorekeeper viewer]`) and `AdminWhitelist::ROLES`.
- `User#scorekeeper?`, `User#can_score_games?` (`admin? || staff? || scorekeeper?`); `User#staff?` stays strictly `admin? || role == "staff"`.
- `ClerkAuthenticatable#require_scorekeeper_or_staff!` enforces `current_user&.can_score_games?`, else `403`.
- **Explicit controller opt-in (preserving `Admin::BaseController` default-deny):**
  - `Admin::TournamentsController`: `skip_before_action :require_staff!, only: [:index, :show]` + `before_action :require_scorekeeper_or_staff!, only: [:index, :show]` (read-only).
  - `Admin::GamesController`: `skip_before_action :require_staff!, only: [:index, :show, :score]` + `before_action :require_scorekeeper_or_staff!, only: [:index, :show, :score]`.
  - Every other admin controller (`Teams`, `Divisions`, `Links`, `Sponsors`, `Articles`, `Media`, `Alerts`, `GameDayNotes`, `Polls`, `Standings`, `Campaigns`, `Whitelists`, `Ingest`, `ScheduleImport`) keeps `require_staff!` or `require_admin!`. Verified by a comprehensive deny-matrix controller test.
- **Scorekeeper operational guardrails (M4):**
  - Scorekeepers (`!current_user.staff?`) can ONLY score games in tournaments with `status IN ("live", "upcoming")` (`403` on `completed`/`cancelled` tournaments).
  - Scorekeepers CANNOT reopen an already-`final` game back to `scheduled`/`live`/`delayed`, CANNOT modify scores on an already-`final` game, and CANNOT pass `forceOverwrite: true` over a `final` game (`403` — staff/admin only).

#### Dedicated Score Endpoint (`PATCH /api/v1/admin/games/:id/score`) & Digest-Checked Idempotency (H4)
- Permitted parameters ONLY: `homeScore`, `awayScore`, `status`, `statusNote`, `lockVersion`, `forceOverwrite`, `clientMutationId`.
- Server computes canonical `payload_digest = Digest::SHA256.hexdigest({ homeScore, awayScore, status, statusNote }.to_json)` (canonical key order).
- **Idempotency & Concurrency Flow (H4):**
  1. If `clientMutationId` is present and equals `game.last_score_mutation_id`:
     - If `payload_digest == game.last_score_mutation_digest`: return `200 OK` `{ game: game.api_json, idempotentReplay: true }`.
     - If `payload_digest != game.last_score_mutation_digest`: return `409 Conflict` `{ error: "Mutation ID reused with different score payload.", currentGame: game.api_json }`.
  2. Apply `game.lock_version = lockVersion.to_i` unless `forceOverwrite` is truthy (and permitted).
  3. On `ActiveRecord::StaleObjectError`: **reload `game` first** and re-check `last_score_mutation_id` + `last_score_mutation_digest` — if the concurrent request was a duplicate copy of the exact same mutation, return `200 OK` (`idempotentReplay: true`) instead of self-conflicting; otherwise return `409 Conflict` with `{ error: ..., currentGame: game.api_json }`.
- **Smart Recompute Trigger (M4):**
  - Run `Standings::Recompute.call(game.tournament)` ONLY when `game.phase == "pool"` AND `(was_final || game.status == "final")` — **NOT** on every live basket tap while `status == "live"`! (Avoids contending on `@tournament.with_lock` during live play.)
  - Run `Games::AdvanceBracketWinner.call(game)` when `game.status == "final"` and `game.next_game_id.present?`.

#### Phone-First Scorekeeper UI (`/admin/scorekeeper`) & Offline Retry Queue (H4, M5)
- `AdminLayout.tsx`: `RequireScorekeeperRoute` allows `isAdmin || isStaff || isScorekeeper`; scorekeeper-only users land on `/admin/scorekeeper` and see only the Scorekeeper nav item.
- **Offline Queue (`web/src/lib/scoreQueue.ts`, `localStorage` keyed by `fd_score_queue_v1:<userId>`):**
  - Coalesces queued edits per `gameId`, and **always mints a fresh `clientMutationId` (`crypto.randomUUID()`) whenever the payload changes** (H4), so a subsequent `+2` tap after a dropped response is never swallowed as an idempotent replay!
  - **Non-network HTTP status policy (M5):**
    - Network error / timeout / `5xx`: remain queued, auto-flush on `online` event + exponential backoff (5s → 15s → 30s) + manual `"Sync now"`.
    - `401 Unauthorized` (expired Clerk session): **keep item queued**, pause auto-retry, and show `"Session expired — sign in again to sync pending scores"`.
    - `403 Forbidden` (role revoked or game locked by staff): stop retrying, quarantine/remove with visible alert explaining why it was rejected.
    - `422 Unprocessable Entity`: stop retrying, display validation message inline so the user can correct it.
    - `409 Conflict`: stop retrying that game and render two-button resolution card (**"Use server score (X–Y)"** vs **"Keep my score (A–B)"**, the latter enabled only when allowed to `forceOverwrite`).

---

### 4.3 Site-Wide Storm / Delay Banner & Enhanced Today Page

#### Schema Migration (`20261122000010_create_tournament_alerts.rb`)
Create `tournament_alerts`:
- `tournament_id` (`bigint`, nullable — `nil` = site-wide; FK `tournaments`, `on_delete: :cascade`)
- `severity` (`string`, `null: false`, `default: "warning"`, CHECK `IN ('info', 'warning', 'urgent')`)
- `title` (`string`, `null: false`, max 140), `message` (`text`, `null: false`, max 1000)
- `active` (`boolean`, `null: false`, `default: true`), `starts_at` (`datetime`), `expires_at` (`datetime`)
- `created_by_id` / `updated_by_id` (`bigint`, nullable, FK `users`, `on_delete: :nullify`)
- Indexes: `[:active, :starts_at, :expires_at]`, `[:tournament_id, :active]`

#### API & UI (L3)
- `GET /api/v1/public/alerts`: scopes strictly to `tournament_id IS NULL OR tournament_id = current_tournament&.id` (`active = true`, within `starts_at..expires_at`, ordered `urgent → warning → info`, `updated_at DESC`), consumed non-blockingly by `PublicLayout` so active storm/power-outage banners appear on **every public page** and fail silently offline.
- Also included on `GET /api/v1/public/today` and `GET /api/v1/public/home`.
- `Api::V1::Admin::AlertsController` (`require_staff!`): `GET / POST / PATCH / DELETE /api/v1/admin/alerts`, managed inside `AdminGameDayPage.tsx`.
- `TodayPage.tsx`: renders live/final scores on `TodayGameCard`, renders `delayed`/`postponed`/`cancelled` badges + `game.statusNote`, and falls back to the tournament's HåfaPass event link when per-game `ticketUrl` is blank.

---

### 4.4 Testing & Quality Gate (B2.3 — Merged in PR #63, `066832b`)

- **Vitest** (`web/vitest.config.ts`, `npm test`) and **Playwright Chromium E2E** (`web/playwright.config.ts`, `web/e2e/smoke.spec.ts`, `npm run test:e2e`) are live in `.github/workflows/ci.yml` (including failure trace artifact upload).
- **`scripts/gate.sh`** runs `npm run build`, `npm test`, `bundle exec brakeman --no-pager -q`, `bin/bundler-audit`, `bin/rubocop --no-color`, and `bin/rails test`.
- Each upcoming B1/B2/C PR adds targeted Vitest unit tests (e.g., `scoreQueue.test.ts`, sponsor tier helpers) and extends `web/e2e/smoke.spec.ts` for `/tickets`, `/bracket`, and storm banners.

---

## 5. Milestone C — Close-Out & Handoff Tooling Design

### 5.1 Board Final Report (`HostCampaigns::FinalReport`)
- `GET /api/v1/campaign/:slug/finance/final-report` (`board`, `chair`, `treasurer`, `admin`, `Cache-Control: no-store`).
- Returns: `campaign`, `tournamentOutcomes` (teams, pool/playoff counts, pool score coverage, champions from `tournament_champions`), `finance` (`HostCampaigns::FinanceSummary` totals), and `compliance` (`liveExpensesCount`, `expensesMissingReceiptCount`, `pendingReimbursementsCount`, `openCashPledgesCount`, `voidedEntriesCount`, `auditEventsCount`, `readyToArchive`, `blockers`).
- Printable `@media print` view + JSON/CSV summary export inside `AdminCampaignFinancePage.tsx`.

### 5.2 Archive a Year (`GET .../closeout-check` & `POST .../archive`) (M6)
- **Single enforced archive path (M6):** `PATCH /api/v1/admin/campaigns/:id` explicitly **rejects** transitioning `status` to `"archived"` with `422` (`"Use POST /api/v1/admin/campaigns/:id/archive to archive a campaign after close-out checks."`), preventing bypass of readiness checks.
- `GET /api/v1/admin/campaigns/:id/closeout-check` (`require_admin!`):
  - `unfinalizedGamesCount`: counts tournament games where `status NOT IN ('final', 'cancelled') AND placeholder = false` (never penalizes cancelled games or unplayed placeholder bracket slots!).
  - Also reports `pendingReimbursementsCount`, `openCashPledgesCount`, `missingReceiptsCount`, `championsRecordedCount`, `blockers`, `warnings`, `ready`.
- `POST /api/v1/admin/campaigns/:id/archive` (`require_admin!`):
  - Requires `forceReason` when `blockers` (`pendingReimbursementsCount > 0 || unfinalizedGamesCount > 0`) are non-empty (`422` otherwise).
  - Atomically locks `campaign` (rejects `422` if already archived), captures `previous_status = campaign.status`, executes `campaign.update!(status: "archived", featured: false)`, optionally marks `tournament` `completed` (`completeTournament: true`), and records `FinanceAuditEvent` (`action: "archive_campaign"`, `changes: { "status" => [previous_status, "archived"], "tournament_completed" => ... }`, `reason: forceReason`).

### 5.3 Clone Campaign for Next Host Class (`POST /api/v1/admin/campaigns/:id/clone`) (M7)
- `require_admin!`, powered by shared `Tournaments::Bootstrap`.
- Validates `targetTournamentId` (if supplied) is not `source.tournament_id` and does not already have a `HostCampaign` (`422` cleanly before hitting the unique DB index on `host_campaigns.tournament_id`).
- **Strict Copy Allowlist (M7):**
  - From source `HostCampaign`, copies **ONLY**: `fdaa_upfront_cents`, `fdaa_ticket_share_bps`.
  - **Explicitly NEVER copies** (initialized fresh or `nil` on the new campaign): `tagline`, `description`, `hero_image_url`, `donation_url`, `donation_instructions`, `golf_url`, `countdown_target_at`, `countdown_label`, `hafapass_organizer_slug`, `hafapass_tournament_organizer_slug`, `hafapass_distribution_code`, `status` (always `"draft"`), `featured` (always `false`), `public_meter_enabled` (always `false`), `include_fdaa_in_public_meter` (always `false`).
  - Optional template copies:
    - `copyDivisions` (default `true`): active `Division` rows (name, slug, position, `counts_for_standings`).
    - `copyBudgetCategories` (default `true`): active `BudgetLine` rows (`budget_cents: copyBudgetAmounts ? line.budget_cents : 0`).
    - `copyEventTemplates` (default `true`): active `CampaignEvent` rows copying ONLY `kind`, `title`, `venue`, `description`, `position` (setting `status: "planned"`, `starts_at: nil`, `ends_at: nil`, `date_label: "TBD"`, `public_visible: false`, all HåfaPass/external URLs `nil`).
  - **Strict isolation invariant:** NEVER copies `ledger_entries`, `pledges`, `pending_receipt_uploads`, `finance_audit_events`, `campaign_memberships`, or `campaign_invitations`.
  - Records `FinanceAuditEvent` (`action: "clone_campaign"`) on the new campaign.

### 5.4 Board Handoff Runbook (`docs/BOARD-HANDOFF-RUNBOOK.md`)
- Practical non-technical handbook for incoming host classes (CO2017 → CO2018): role map, onboarding, finance & receipt capture, two-officer reimbursements, HåfaPass event linking, setup wizard & schedule import, game-night scorekeeping + offline recovery, storm/delay playbook, and August close-out/clone checklist.

---

## 6. PR-Sized Implementation Slices & Acceptance Checks

| Slice | Status | Scope & Key Acceptance Checks |
|---|---|---|
| **B2.3 — Vitest, Playwright CI & `gate.sh`** | **MERGED (#63, `066832b`)** | Vitest (`16/16`), Playwright Chromium E2E (`4/4` + CI failure traces), Brakeman + bundler-audit + RuboCop + Rails in `scripts/gate.sh`. |
| **B1.1 — Per-Tournament Divisions, Game Core Columns, Optimistic Locking & Pool-Only Standings** | Next | Migrations `000007` & `000008` (incl. HTTPS URL cleanup, `(next_game_id, next_game_slot)` unique index, `standings.division_rank`), `Division` tournament scoping + `seeds.rb` update, universal `lockVersion` `409` on game updates & `saveDetails` split, `@tournament.with_lock` full-scope `Standings::Recompute` + `Standings::Ranker`, per-division `StandingsPage` & `AdminDivisionsPage` cleanup. Pre/post `DRY_RUN=1` standings report verified. |
| **B1.2 — Generic Schedule & Roster Importer + Tournament Setup Wizard** | After B1.1 | `Imports::ScheduleParser/Preview/Commit` (with `unmatchedExistingGames`), `Imports::RosterParser/Preview/Commit` (with unique `(team_id, lower(trim(name)))` index), shared `Tournaments::Bootstrap`, `POST /admin/tournaments/setup`, `AdminScheduleImportPage` (`/admin/import`), `AdminTournamentWizardPage` (`/admin/tournaments/setup`). |
| **B1.3 — Sponsor Tiers & Public Tickets Page** | After B1.1 | Migration `000009` (`sponsors.tier` canonical CHECK preserving Title/Presenting as `diamond`, URL cleanup, `description`), tier-ordered `SponsorsController` & `TodayController`, `SponsorsPage` (`safeHttpsHref`), `GET /api/v1/public/tickets` (`HostCampaign.resolve_public`, tournament-window filtering, stale badge fallback), `TicketsPage` (`/tickets`), mobile bottom nav update, extended Playwright smoke tests. |
| **B2.1 — Bracket View, Winner Advancement, Storm Alerts & Enhanced Today Page** | After B1.1 | Migration `000010` (`tournament_alerts`), `GET /public/bracket`, `Games::AdvanceBracketWinner` (cycle-safe, `Team#placeholder_team?`), `BracketPage` (`/bracket`), `Public::AlertsController` (scoped to current tournament + site-wide) & `Admin::AlertsController`, site-wide banner in `PublicLayout`, enhanced `TodayPage` (scores, delay notes, ticket fallback) & `AdminGameDayPage`. |
| **B2.2 — `scorekeeper` Role & Mobile Offline-Resilient Score Entry** | After B2.1 | `scorekeeper` role with explicit controller opt-in & full deny-matrix test, `live`/`upcoming` + non-final guardrails, `PATCH /admin/games/:id/score` (digest-checked `last_score_mutation_id` + `StaleObjectError` replay check + final-transition-only recompute), `web/src/lib/scoreQueue.ts` (new UUID on edit + 401/403/409/422 handling + Vitest tests), `AdminScorekeeperPage` (`/admin/scorekeeper`), `AdminPeoplePage` & `AdminLayout` updates. |
| **C.1 — Final Report, Year Archival, Next-Year Campaign Clone & Board Runbook** | After B1.2 & B2.1 | `HostCampaigns::FinalReport`, `GET .../finance/final-report`, `GET .../closeout-check`, `POST .../archive` (blocking `PATCH` archive bypass), `POST .../clone` (strict copy allowlist via `Tournaments::Bootstrap`), UI in `AdminCampaignFinancePage` & `AdminCampaignsPage`, `docs/BOARD-HANDOFF-RUNBOOK.md`. |

---

## 7. Security, Privacy & Concurrency Invariants

1. **Least-privilege RBAC:** `scorekeeper` is strictly narrower than `staff`, locked to `live`/`upcoming` tournaments and non-finalized games, enforced by `Admin::BaseController` default-deny + deny-matrix tests.
2. **Fail-closed HTTPS URL safety:** Stored legacy URLs are normalized in migrations; `SafeUrlValidation` runs on changed URLs (`https://` only, no userinfo); frontend uses `safeHttpsHref()`.
3. **No synchronous external HTTP on public paths:** `/api/v1/public/tickets`, `/today`, and `/alerts` never make blocking outbound HTTP calls.
4. **Concurrency & idempotency safety:** `Standings::Recompute` locks `@tournament` across read + write; `Games::AdvanceBracketWinner` locks `next_game`; all game write paths enforce `lock_version` optimistic locking (`409`); score retries verify `(last_score_mutation_id, last_score_mutation_digest)` including inside `StaleObjectError` recovery.
5. **Cross-year isolation:** Cloning a campaign uses a strict copy allowlist and never copies prior financial entries, receipts, pledges, donation instructions, HåfaPass links, audit logs, or board memberships.
