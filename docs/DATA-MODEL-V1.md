# Data Model — V1

## Tournament
- id
- year
- name
- start_date
- end_date
- status (upcoming/live/completed)

## Team
- id
- class_year_label (e.g., 2016/2017)
- display_name
- division

## Game
- id
- tournament_id
- home_team_id
- away_team_id
- start_time
- venue
- status (scheduled/live/final)
- home_score
- away_score
- stream_url (nullable)
- ticket_url (nullable)

## Standing
- id
- tournament_id
- team_id
- wins
- losses
- points_for
- points_against

## ArticleLink
- id
- title
- source (GSPN/Official)
- url
- published_at

## Sponsor
- id
- name
- logo_url
- target_url
- tier
- active
