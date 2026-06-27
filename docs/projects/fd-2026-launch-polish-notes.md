# FD Alumni Hub 2026 Launch Polish Notes

_Last updated: 2026-06-27_

## Admin workflow polish

The Rails/Vite admin should bias toward day-to-day tournament operations instead of one-time setup work.

Implemented direction:

- Keep Add Team and Add Game available, but collapsed by default once records exist.
- Use the schedule importer as the primary way to populate a season schedule.
- Keep manual game/team creation for late organizer changes, playoff placeholders, make-up games, or emergency corrections.
- Support atomic bulk roster entry from pasted team lists so organizers are not forced to open the single-player modal repeatedly and failed batches do not partially write players.
- Support applying one common GuamTime ticket link across the schedule, then manually overriding championship or special-session games later.

## Ticket link guidance

Organizer guidance indicates most games can share one GuamTime ticket link, while championship sessions may need separate handling. The admin Links page should support:

1. Fill missing ticket links with a common GuamTime URL.
2. Replace all ticket links with a common GuamTime URL.
3. Manual row-by-row overrides after bulk fill.

Public copy should avoid hard-coding prices unless organizers provide final public pricing. GuamTime remains the source of truth for current price and checkout details.

## By-laws review summary

Source reviewed locally:

```text
/Users/leonshimizu/Desktop/2026 FD Alumni By-Laws_Basketball.pdf
```

Useful public-facing highlights:

- Waivers are required before players can play.
- Player eligibility is verified through FD administration / FDMSAA criteria.
- Teams need at least five eligible players to start.
- Complete uniforms are mandatory.
- No jewelry during games.
- Games use two 20-minute halves with a five-minute halftime.
- First 37 minutes run continuously; final three minutes of the second half use stop-clock rules.
- Pool-play ties use a three-point shootout; playoff ties use overtime.
- All teams make playoffs; tiebreakers start with head-to-head and points for/against.
- Forfeits and incomplete uniforms can trigger team fees.
- Sportsmanship and campus conduct rules apply.

Do **not** publish the raw PDF contents without organizer approval because the source includes personal contact details and internal language that should be summarized for a public hub.

## Future OCR schedule import

The 2026 schedule is now imported from a structured JSON file and idempotent Rails task. For future years, build on that foundation with an operator-reviewed OCR workflow:

1. Admin uploads schedule PDF/image.
2. Backend extracts tables using PDF text extraction first, OCR fallback second.
3. System presents a preview table with date, time, game number, away team, home team, phase, and warnings.
4. Admin fixes ambiguous rows in-browser.
5. System writes a structured schedule JSON snapshot with source metadata.
6. Admin imports the reviewed snapshot through the existing schedule importer pattern.
7. Import report shows created/updated/skipped rows.

Important: OCR should never silently write games directly to production. Keep a human review step because schedule PDFs can include blank cells, merged rows, bracket placeholders, and special rows like father-son games.
