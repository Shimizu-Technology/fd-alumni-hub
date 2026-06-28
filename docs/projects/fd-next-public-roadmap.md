# FD Alumni Basketball Hub — Public Roadmap

Last updated: 2026-06-28
Status: planning notes; Rails/Vite is now the active app path and the legacy Next app is archived

## Current positioning

Use the public name:

> FD Alumni Basketball Hub

Keep the language as a central tournament hub unless FD/organizers explicitly approve more official wording.

The original Next.js app has been archived under `archive/legacy-next-app`; Rails API + React/Vite is now the active deployment path.

## Decisions from local review

- FD logo usage is approved for this project.
- Preferred public name: `FD Alumni Basketball Hub`.
- Public archive can show incomplete years as long as gaps are clearly labeled, e.g. `score pending`, `source pending`, or `research pending`.
- Predictions should not require user sign-in.
- Prediction voters can change their vote.
- Prediction voting closes when admins explicitly close it.
- Most public users will be on mobile; game-day/today UI should prioritize fast scanning on phones.
- Optional rosters should support:
  - player name required
  - jersey number optional
  - position optional
  - nickname optional

## Recommended implementation grouping

Instead of five separate PRs, group the work into two larger but still reviewable phases.

### Phase A — Public brand + archive depth

Goal: make the public app feel like a polished FD alumni tournament hub and turn history into a useful archive.

Scope:

1. Public visual refresh
   - Download and store approved FD logo assets from `fatherduenas.com`.
   - Use FD crest/logo in the public header and homepage hero.
   - Shift the public shell toward a stronger FD identity:
     - maroon page/background system
     - white/cream hero/content cards
     - dark headline text inside light hero surfaces
     - gold accents
   - Keep admin styling separate; this is primarily public-facing.

2. DB-backed history archive
   - Replace the static-only history experience with DB-backed tournament archive pages where possible.
   - Add routes like:
     - `/history/2025`
     - `/history/2024`
   - Each tournament detail page should show:
     - tournament dates/status
     - champion/runner-up/final score if known
     - game schedule/results
     - standings/score coverage if available
     - linked articles
     - media/gallery items
     - sponsors if available
     - research-gap labels for incomplete data
   - Keep the existing static champion ledger as fallback context for years with incomplete DB data.

Likely backend/API work:

- Add a public archive endpoint that returns a complete tournament bundle:
  - tournament
  - games
  - standings
  - articles
  - media assets
  - sponsors
  - derived champion/final summary where possible
- Consider adding explicit archive metadata later if derived champion data is not enough.

### Phase B — Game-day operations + fan engagement

Goal: make the hub useful during the live tournament and add lightweight fan participation.

Scope:

1. Today / Game Day page
   - Recommended public label: `Today` or `Today at The Jungle`.
   - Surface prominently on mobile, homepage, and schedule.
   - Show:
     - today’s games
     - live/final statuses
     - ticket/stream links
     - host class
     - food/menu notes
     - announcements
     - sponsor shoutouts if useful
     - last updated timestamp
   - Add admin controls for day-by-day game-day facts.

2. Team rosters
   - Add optional roster entries for each team.
   - Admin can add/edit/remove roster entries from Teams page.
   - Fields:
     - name required
     - jersey number optional
     - position optional
     - nickname optional
     - sort order / active optional if useful
   - Public side can expose rosters from team cards, standings, or a dedicated team detail view.

3. Predictions
   - Anonymous, no sign-in.
   - Game-level prediction: who wins this game?
   - Tournament-level prediction: who wins the tournament?
   - User can change their vote.
   - Admin can close voting.
   - Store a local anonymous device token in browser storage; do not collect unnecessary PII.
   - Treat one-device voting as a lightweight engagement feature, not fraud-proof polling.
   - Show public percentages/results after voting or once configured to show.

Likely backend/API work:

- `game_day_notes` or similar table for host class, food/menu, announcements, active date.
- `roster_entries` table tied to teams.
- Prediction poll/vote tables:
  - poll type: game or tournament
  - closes/open flag controlled by admin
  - vote target: team/game option
  - anonymous voter token hash
  - allow updating existing vote for same token/poll

## Mobile-first UX notes

- Public nav should stay simple; avoid adding too many top-level items.
- If adding `Today`, consider replacing lower-priority nav visibility on mobile or surfacing it as a prominent homepage/schedule card.
- Game cards should remain thumb-friendly with obvious Tickets/Stream/Prediction actions.
- Prediction UI should be one-tap, not a form.
- Tournament history detail pages should use compact sections and accordions on mobile.

## Open questions before Phase A implementation

- Which downloaded FD logo should be primary: crest-only, horizontal wordmark, or both by viewport?
- Should archive detail URLs use year (`/history/2025`) or Rails tournament id? Recommendation: year for public readability, fallback lookup by id if needed.
- Do organizers want any disclaimer text around historical/incomplete archive data?

## Open questions before Phase B implementation

- Preferred public nav label: `Today`, `Game Day`, or `At The Jungle`?
- Should predictions be visible before voting, after voting, or only after admins enable result display?
- Should admins be able to disable predictions per game/tournament?
- Should rosters be visible immediately when entered, or should there be a public/private toggle?
