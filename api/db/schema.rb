# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_06_28_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "admin_whitelists", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "legacy_id"
    t.text "notes"
    t.string "role", default: "admin", null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_admin_whitelists_on_lower_email", unique: true
    t.index ["legacy_id"], name: "index_admin_whitelists_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
  end

  create_table "article_links", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "excerpt"
    t.bigint "game_id"
    t.string "image_url"
    t.string "legacy_id"
    t.datetime "published_at"
    t.string "source", null: false
    t.string "title", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.string "url", null: false
    t.index ["game_id"], name: "index_article_links_on_game_id"
    t.index ["legacy_id"], name: "index_article_links_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["tournament_id", "published_at"], name: "index_article_links_on_tournament_id_and_published_at"
    t.index ["tournament_id", "url"], name: "index_article_links_on_tournament_id_and_url", unique: true
    t.index ["tournament_id"], name: "index_article_links_on_tournament_id"
  end

  create_table "content_ingest_items", force: :cascade do |t|
    t.string "confidence"
    t.datetime "created_at", null: false
    t.text "excerpt"
    t.string "image_url"
    t.string "imported_to_id"
    t.string "kind", null: false
    t.string "legacy_id"
    t.text "notes"
    t.string "source", null: false
    t.string "status", default: "pending", null: false
    t.string "title", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.string "url", null: false
    t.index ["legacy_id"], name: "index_content_ingest_items_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["source", "status"], name: "index_content_ingest_items_on_source_and_status"
    t.index ["tournament_id", "status", "kind"], name: "index_ingest_on_tournament_status_kind"
    t.index ["tournament_id", "url"], name: "index_ingest_on_tournament_and_url", unique: true
    t.index ["tournament_id"], name: "index_content_ingest_items_on_tournament_id"
  end

  create_table "divisions", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.string "slug", null: false
    t.integer "starts_year"
    t.datetime "updated_at", null: false
    t.index ["active", "starts_year", "position"], name: "index_divisions_on_active_and_starts_year_and_position"
    t.index ["slug"], name: "index_divisions_on_slug", unique: true
  end

  create_table "game_day_notes", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.text "announcement"
    t.datetime "created_at", null: false
    t.date "date", null: false
    t.text "food_menu"
    t.string "host_class"
    t.text "sponsor_shoutout"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["date", "active"], name: "index_game_day_notes_on_date_and_active"
    t.index ["tournament_id", "date"], name: "index_game_day_notes_on_tournament_id_and_date", unique: true
    t.index ["tournament_id"], name: "index_game_day_notes_on_tournament_id"
  end

  create_table "games", force: :cascade do |t|
    t.integer "away_score"
    t.bigint "away_team_id", null: false
    t.string "bracket_code"
    t.datetime "created_at", null: false
    t.string "division"
    t.bigint "division_id"
    t.integer "home_score"
    t.bigint "home_team_id", null: false
    t.string "legacy_id"
    t.text "notes"
    t.boolean "placeholder", default: false, null: false
    t.datetime "start_time", null: false
    t.string "status", default: "scheduled", null: false
    t.string "stream_url"
    t.string "ticket_url"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.string "venue"
    t.index ["away_team_id"], name: "index_games_on_away_team_id"
    t.index ["division_id"], name: "index_games_on_division_id"
    t.index ["home_team_id"], name: "index_games_on_home_team_id"
    t.index ["legacy_id"], name: "index_games_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["status"], name: "index_games_on_status"
    t.index ["tournament_id", "division"], name: "index_games_on_tournament_id_and_division"
    t.index ["tournament_id", "placeholder"], name: "index_games_on_tournament_id_and_placeholder"
    t.index ["tournament_id", "start_time"], name: "index_games_on_tournament_id_and_start_time"
    t.index ["tournament_id"], name: "index_games_on_tournament_id"
  end

  create_table "media_assets", force: :cascade do |t|
    t.string "article_url"
    t.text "caption"
    t.datetime "created_at", null: false
    t.bigint "game_id"
    t.string "image_url", null: false
    t.string "legacy_id"
    t.string "source", null: false
    t.string "tags"
    t.datetime "taken_at"
    t.string "title", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["game_id"], name: "index_media_assets_on_game_id"
    t.index ["legacy_id"], name: "index_media_assets_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["tournament_id", "image_url"], name: "index_media_assets_on_tournament_id_and_image_url"
    t.index ["tournament_id", "source", "taken_at"], name: "index_media_assets_on_tournament_id_and_source_and_taken_at"
    t.index ["tournament_id"], name: "index_media_assets_on_tournament_id"
  end

  create_table "prediction_polls", force: :cascade do |t|
    t.datetime "closes_at"
    t.datetime "created_at", null: false
    t.bigint "game_id"
    t.string "poll_type", null: false
    t.string "question", null: false
    t.boolean "show_results", default: true, null: false
    t.string "status", default: "open", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["game_id", "poll_type"], name: "index_prediction_polls_on_game_id_and_poll_type", unique: true, where: "(game_id IS NOT NULL)"
    t.index ["game_id"], name: "index_prediction_polls_on_game_id"
    t.index ["status", "closes_at"], name: "index_prediction_polls_on_status_and_closes_at"
    t.index ["tournament_id", "poll_type"], name: "index_prediction_polls_on_unique_tournament_poll", unique: true, where: "((poll_type)::text = 'tournament'::text)"
    t.index ["tournament_id"], name: "index_prediction_polls_on_tournament_id"
  end

  create_table "prediction_votes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "prediction_poll_id", null: false
    t.bigint "team_id", null: false
    t.datetime "updated_at", null: false
    t.string "voter_token_hash", null: false
    t.index ["prediction_poll_id", "team_id"], name: "index_prediction_votes_on_prediction_poll_id_and_team_id"
    t.index ["prediction_poll_id", "voter_token_hash"], name: "index_prediction_votes_on_poll_and_token_hash", unique: true
    t.index ["prediction_poll_id"], name: "index_prediction_votes_on_prediction_poll_id"
    t.index ["team_id"], name: "index_prediction_votes_on_team_id"
  end

  create_table "roster_entries", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.string "jersey_number"
    t.string "name", null: false
    t.string "nickname"
    t.string "position"
    t.integer "sort_order", default: 0, null: false
    t.bigint "team_id", null: false
    t.datetime "updated_at", null: false
    t.index ["team_id", "active", "sort_order"], name: "index_roster_entries_on_team_id_and_active_and_sort_order"
    t.index ["team_id", "name"], name: "index_roster_entries_on_team_id_and_name"
    t.index ["team_id"], name: "index_roster_entries_on_team_id"
  end

  create_table "sponsors", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.string "legacy_id"
    t.string "logo_url"
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.string "target_url"
    t.string "tier"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["legacy_id"], name: "index_sponsors_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["tournament_id", "active", "position"], name: "index_sponsors_on_tournament_id_and_active_and_position"
    t.index ["tournament_id"], name: "index_sponsors_on_tournament_id"
  end

  create_table "standings", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "legacy_id"
    t.integer "losses", default: 0, null: false
    t.integer "points_against", default: 0, null: false
    t.integer "points_for", default: 0, null: false
    t.bigint "team_id", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.integer "wins", default: 0, null: false
    t.index ["legacy_id"], name: "index_standings_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["team_id"], name: "index_standings_on_team_id"
    t.index ["tournament_id", "team_id"], name: "index_standings_on_tournament_id_and_team_id", unique: true
    t.index ["tournament_id", "wins", "losses"], name: "index_standings_on_tournament_id_and_wins_and_losses"
    t.index ["tournament_id"], name: "index_standings_on_tournament_id"
  end

  create_table "teams", force: :cascade do |t|
    t.string "class_year_label", null: false
    t.datetime "created_at", null: false
    t.string "display_name", null: false
    t.string "division"
    t.bigint "division_id"
    t.string "legacy_id"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["division_id"], name: "index_teams_on_division_id"
    t.index ["legacy_id"], name: "index_teams_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["tournament_id", "display_name"], name: "index_teams_on_tournament_and_display_name", unique: true
    t.index ["tournament_id", "division"], name: "index_teams_on_tournament_id_and_division"
    t.index ["tournament_id"], name: "index_teams_on_tournament_id"
  end

  create_table "tournament_champions", force: :cascade do |t|
    t.string "champion_key", default: "", null: false
    t.string "champion_label", default: "", null: false
    t.datetime "created_at", null: false
    t.string "edition_label", default: "", null: false
    t.text "notes"
    t.integer "position", default: 0, null: false
    t.string "runner_up_key"
    t.string "runner_up_label"
    t.string "score"
    t.string "slug", null: false
    t.string "source", default: "", null: false
    t.string "status", default: "completed", null: false
    t.bigint "tournament_id"
    t.datetime "updated_at", null: false
    t.integer "year", null: false
    t.index ["champion_key"], name: "index_tournament_champions_on_champion_key"
    t.index ["slug"], name: "index_tournament_champions_on_slug", unique: true
    t.index ["tournament_id"], name: "index_tournament_champions_on_tournament_id"
    t.index ["year", "position"], name: "index_tournament_champions_on_year_and_position"
  end

  create_table "tournaments", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.date "end_date", null: false
    t.string "legacy_id"
    t.string "name", null: false
    t.date "start_date", null: false
    t.string "status", default: "upcoming", null: false
    t.datetime "updated_at", null: false
    t.integer "year", null: false
    t.index ["legacy_id"], name: "index_tournaments_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["year", "name"], name: "index_tournaments_on_year_and_name", unique: true
    t.index ["year", "status"], name: "index_tournaments_on_year_and_status"
  end

  create_table "users", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.string "clerk_id"
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "first_name"
    t.string "last_name"
    t.string "legacy_id"
    t.string "role", default: "staff", null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_users_on_lower_email", unique: true
    t.index ["clerk_id"], name: "index_users_on_clerk_id", unique: true, where: "(clerk_id IS NOT NULL)"
    t.index ["legacy_id"], name: "index_users_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
  end

  add_foreign_key "article_links", "games", on_delete: :nullify
  add_foreign_key "article_links", "tournaments", on_delete: :cascade
  add_foreign_key "content_ingest_items", "tournaments", on_delete: :cascade
  add_foreign_key "game_day_notes", "tournaments", on_delete: :cascade
  add_foreign_key "games", "divisions", on_delete: :nullify
  add_foreign_key "games", "teams", column: "away_team_id"
  add_foreign_key "games", "teams", column: "home_team_id"
  add_foreign_key "games", "tournaments", on_delete: :cascade
  add_foreign_key "media_assets", "games", on_delete: :nullify
  add_foreign_key "media_assets", "tournaments", on_delete: :cascade
  add_foreign_key "prediction_polls", "games", on_delete: :cascade
  add_foreign_key "prediction_polls", "tournaments", on_delete: :cascade
  add_foreign_key "prediction_votes", "prediction_polls", on_delete: :cascade
  add_foreign_key "prediction_votes", "teams", on_delete: :cascade
  add_foreign_key "roster_entries", "teams", on_delete: :cascade
  add_foreign_key "sponsors", "tournaments", on_delete: :cascade
  add_foreign_key "standings", "teams", on_delete: :cascade
  add_foreign_key "standings", "tournaments", on_delete: :cascade
  add_foreign_key "teams", "divisions", on_delete: :nullify
  add_foreign_key "teams", "tournaments", on_delete: :cascade
  add_foreign_key "tournament_champions", "tournaments"
end
