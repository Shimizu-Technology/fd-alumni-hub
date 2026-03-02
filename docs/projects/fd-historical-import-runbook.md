# FD Historical Games Import Runbook

## Purpose
Import semifinals/finals and other historical games from organizer/Clutch/FD-provided spreadsheet exports.

## Input template
- `templates/fd_historical_games_import.csv`

Required columns:
- `year`
- `tournament_name`
- `game_date` (YYYY-MM-DD)
- `home_team_label`
- `away_team_label`
- `status` (`scheduled|live|final`)

Recommended columns:
- `game_time` (HH:MM)
- `stage` (Group, Quarterfinal, Semifinal, Final)
- `division`
- `home_score`, `away_score`
- `venue`
- `stream_url`, `ticket_url`
- `source_url`, `source_confidence`, `notes`

## Run
```bash
cd ~/work/fd-alumni-hub
node tools/import/fd_historical_games_import.mjs templates/fd_historical_games_import.csv
```

## Idempotency behavior
- Upsert key: tournament + homeTeam + awayTeam + startTime
- Re-running same file updates existing rows, does not duplicate.

## Validation checklist
- [ ] No same-team home/away errors
- [ ] Status values valid
- [ ] Dates parse correctly
- [ ] Imported rows visible in `/schedule`
- [ ] If status final, scores present where known

## Data quality policy
- Use `source_confidence` field (`confirmed|partial|inferred`)
- Keep `source_url` for audit traceability
