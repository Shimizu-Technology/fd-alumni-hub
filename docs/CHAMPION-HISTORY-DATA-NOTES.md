# Champion History Data Notes

The public champion archive currently stores the verified primary/overall champion list that came from the FD alumni champions graphic plus later WhatsApp/GSPN confirmations.

## Gold and Maroon champions

Organizers have confirmed that recent tournaments can have two championship tracks:

- **Maroon champion** — younger/open bracket and the main tournament champion. This is usually the headline championship and is commonly played on Friday.
- **Gold champion** — older-class bracket champion. This matters historically and is commonly played on Thursday.

The exact first year of the Gold/Maroon split still needs verification. Do not fabricate Gold champion records until an organizer, bracket sheet, GSPN article, or trusted archive source confirms the year-by-year winners.

## Current database shape

`tournament_champions` supports future dual-champion history with:

- `bracket`: `overall`, `maroon`, `gold`, or `unknown`
- `primary`: whether this record should count in the main public title leaderboard
- `champion_key`: canonical class key, e.g. `06`, `02/04`, `16/17`

Current seeded records use `bracket: overall` and `primary: true` because they come from the existing headline champion list. When Gold/Maroon records are verified, seed them as separate rows for the same tournament year:

```json
{ "year": 2026, "bracket": "maroon", "primary": true, "champion": "Class of 2016/17", "source": "Organizer bracket" }
{ "year": 2026, "bracket": "gold", "primary": false, "champion": "Class of 1996", "source": "Organizer bracket" }
```

## Combined class handling

Combined classes remain separate from individual classes:

- `02` titles count only for Class of 2002.
- `04` titles count only for Class of 2004.
- `02/04` titles count only for the combined 2002/2004 team.

Class profile pages may show related combined records as context, but title totals must not merge combined and individual class records.

## Future data task

Before finalizing the historical title archive:

1. Verify the first year with separate Gold and Maroon champions.
2. Collect Gold champion, runner-up, score, and source for every available year.
3. Convert recent `overall` records to `maroon` only when confirmed that the listed champion is the Maroon/open winner.
4. Keep Gold records out of the primary leaderboard unless organizers explicitly want a combined all-brackets leaderboard.
