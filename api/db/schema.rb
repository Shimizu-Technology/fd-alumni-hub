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

ActiveRecord::Schema[8.1].define(version: 2026_06_11_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "admin_whitelists", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.text "notes"
    t.string "role", default: "admin", null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_admin_whitelists_on_lower_email", unique: true
  end

  create_table "article_links", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "excerpt"
    t.string "image_url"
    t.datetime "published_at"
    t.string "source", null: false
    t.string "title", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.string "url", null: false
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
    t.text "notes"
    t.string "source", null: false
    t.string "status", default: "pending", null: false
    t.string "title", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.string "url", null: false
    t.index ["source", "status"], name: "index_content_ingest_items_on_source_and_status"
    t.index ["tournament_id", "status", "kind"], name: "index_ingest_on_tournament_status_kind"
    t.index ["tournament_id", "url"], name: "index_ingest_on_tournament_and_url", unique: true
    t.index ["tournament_id"], name: "index_content_ingest_items_on_tournament_id"
  end

  create_table "games", force: :cascade do |t|
    t.integer "away_score"
    t.bigint "away_team_id", null: false
    t.string "bracket_code"
    t.datetime "created_at", null: false
    t.string "division"
    t.integer "home_score"
    t.bigint "home_team_id", null: false
    t.text "notes"
    t.datetime "start_time", null: false
    t.string "status", default: "scheduled", null: false
    t.string "stream_url"
    t.string "ticket_url"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.string "venue"
    t.index ["away_team_id"], name: "index_games_on_away_team_id"
    t.index ["home_team_id"], name: "index_games_on_home_team_id"
    t.index ["status"], name: "index_games_on_status"
    t.index ["tournament_id", "division"], name: "index_games_on_tournament_id_and_division"
    t.index ["tournament_id", "start_time"], name: "index_games_on_tournament_id_and_start_time"
    t.index ["tournament_id"], name: "index_games_on_tournament_id"
  end

  create_table "media_assets", force: :cascade do |t|
    t.string "article_url"
    t.text "caption"
    t.datetime "created_at", null: false
    t.string "image_url", null: false
    t.string "source", null: false
    t.string "tags"
    t.datetime "taken_at"
    t.string "title", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["tournament_id", "image_url"], name: "index_media_assets_on_tournament_id_and_image_url", unique: true
    t.index ["tournament_id", "source", "taken_at"], name: "index_media_assets_on_tournament_id_and_source_and_taken_at"
    t.index ["tournament_id"], name: "index_media_assets_on_tournament_id"
  end

  create_table "sponsors", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.string "logo_url"
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.string "target_url"
    t.string "tier"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["tournament_id", "active", "position"], name: "index_sponsors_on_tournament_id_and_active_and_position"
    t.index ["tournament_id"], name: "index_sponsors_on_tournament_id"
  end

  create_table "standings", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "losses", default: 0, null: false
    t.integer "points_against", default: 0, null: false
    t.integer "points_for", default: 0, null: false
    t.bigint "team_id", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.integer "wins", default: 0, null: false
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
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["tournament_id", "display_name"], name: "index_teams_on_tournament_and_display_name", unique: true
    t.index ["tournament_id", "division"], name: "index_teams_on_tournament_id_and_division"
    t.index ["tournament_id"], name: "index_teams_on_tournament_id"
  end

  create_table "tournaments", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "end_date", null: false
    t.string "name", null: false
    t.datetime "start_date", null: false
    t.string "status", default: "upcoming", null: false
    t.datetime "updated_at", null: false
    t.integer "year", null: false
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
    t.string "role", default: "staff", null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_users_on_lower_email", unique: true
    t.index ["clerk_id"], name: "index_users_on_clerk_id", unique: true, where: "(clerk_id IS NOT NULL)"
  end

  add_foreign_key "article_links", "tournaments", on_delete: :cascade
  add_foreign_key "content_ingest_items", "tournaments", on_delete: :cascade
  add_foreign_key "games", "teams", column: "away_team_id"
  add_foreign_key "games", "teams", column: "home_team_id"
  add_foreign_key "games", "tournaments", on_delete: :cascade
  add_foreign_key "media_assets", "tournaments", on_delete: :cascade
  add_foreign_key "sponsors", "tournaments", on_delete: :cascade
  add_foreign_key "standings", "teams", on_delete: :cascade
  add_foreign_key "standings", "tournaments", on_delete: :cascade
  add_foreign_key "teams", "tournaments", on_delete: :cascade
end
