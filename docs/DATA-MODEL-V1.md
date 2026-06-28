# Data Model — V1

## Tournament
- id
- year
- name
- start_date
- end_date
- status (upcoming/live/completed)

## Team
Tournament-specific team entry. Games and standings attach here, while class history rolls up through memberships.

- id
- class_year_label / source label (e.g., `16/17`, `12 Pack`, `AD7`)
- display_name (public schedule name, e.g., `Pack 12`, `MMX`)
- division

## ClassCohort
- id
- key (e.g., 17, 02)
- graduation_year
- display_name

## TeamClassMembership
Maps one tournament team entry to one or more permanent graduating classes. A 2026 `Pack 12` team can represent Classes 2012 and 2017; a later tournament can split those classes into different team entries without rewriting history.

- team_id
- class_cohort_id
- source (`auto` alias/parser result or `manual` admin override)
- position

## TournamentChampion
- tournament_id
- year
- champion_label
- champion_key (team entry, e.g., 02/04)
- bracket (overall/maroon/gold/unknown)
- primary

## TournamentChampionCredit
- tournament_champion_id
- class_cohort_id
- credit_type

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
