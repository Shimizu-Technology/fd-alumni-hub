# Champion History Data Notes

The public champion archive stores verified champion records from the FD alumni champions graphic plus later WhatsApp/GSPN confirmations. The archive now separates the **team entry that won** from the **individual class cohorts that should receive title credit**.

## Gold and Maroon champions

Organizers have confirmed that recent tournaments can have two championship tracks:

- **Maroon champion** — younger/open bracket and the main tournament champion. This is usually the headline championship and is commonly played on Friday.
- **Gold champion** — older-class bracket champion. This matters historically and is commonly played on Thursday.

The exact first year of the Gold/Maroon split still needs verification. Do not fabricate Gold champion records until an organizer, bracket sheet, GSPN article, or trusted archive source confirms the year-by-year winners.

## Current database shape

`tournament_champions` stores the champion entry exactly as reported:

- `bracket`: `overall`, `maroon`, `gold`, or `unknown`
- `primary`: whether this record should count in the main public title leaderboard
- `champion_key`: canonical team-entry key, e.g. `06`, `02/04`, `16/17`

Class archive tables then map those entries back to individual cohorts:

- `class_cohorts`: one row per graduating class, e.g. Class of 2017.
- `team_class_memberships`: which classes were represented by a tournament team entry.
- `tournament_champion_credits`: which individual classes receive credit for a championship record.

Current seeded records use `bracket: overall` and `primary: true` because they come from the existing headline champion list. When Gold/Maroon records are verified, seed them as separate rows for the same tournament year:

```json
{ "year": 2026, "bracket": "maroon", "primary": true, "champion": "Class of 2016/17", "source": "Organizer bracket" }
{ "year": 2026, "bracket": "gold", "primary": false, "champion": "Class of 1996", "source": "Organizer bracket" }
```

## Combined class handling

Team entries remain historically accurate, but title credit rolls up to every represented class:

- A solo `02` title credits Class of 2002 only.
- A solo `04` title credits Class of 2004 only.
- A shared `02/04` title remains a `02/04` champion entry, but credits both Class of 2002 and Class of 2004.
- A shared `16/17` title remains a `16/17` champion entry, but credits both Class of 2016 and Class of 2017.

This lets the public archive answer both questions:

1. Which team entry won the tournament that year?
2. How many title credits does each graduating class have across solo and combined teams?

## Known 2026 team aliases

`data/historical/fd-class-aliases.json` currently maps known non-obvious schedule labels:

- `MMX` → Class of 2010
- `GAMETIME` → Class of 2007
- `12 Pack` → Class of 2012 + Class of 2017 for the 2026 tournament

Unknown labels should remain unresolved until organizer/player confirmation is available. Do not guess labels like `435`, `815`, or `AD7` without a trusted source.

## Future data task

Before finalizing the historical title archive:

1. Verify the first year with separate Gold and Maroon champions.
2. Collect Gold champion, runner-up, score, and source for every available year.
3. Convert recent `overall` records to `maroon` only when confirmed that the listed champion is the Maroon/open winner.
4. Decide whether Gold records should appear in the primary leaderboard or in a separate Gold leaderboard.
5. Continue adding team-entry/class-membership aliases as organizers confirm how combined teams changed year to year.
