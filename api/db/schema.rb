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

ActiveRecord::Schema[8.1].define(version: 2026_11_22_000003) do
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
    t.string "image_url"
    t.string "legacy_id"
    t.datetime "published_at"
    t.string "source", null: false
    t.string "title", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.string "url", null: false
    t.bigint "game_id"
    t.index ["game_id"], name: "index_article_links_on_game_id"
    t.index ["legacy_id"], name: "index_article_links_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["tournament_id", "published_at"], name: "index_article_links_on_tournament_id_and_published_at"
    t.index ["tournament_id", "url"], name: "index_article_links_on_tournament_id_and_url", unique: true
    t.index ["tournament_id"], name: "index_article_links_on_tournament_id"
  end

  create_table "campaign_events", force: :cascade do |t|
    t.bigint "host_campaign_id", null: false
    t.string "kind", default: "fundraiser", null: false
    t.string "title", null: false
    t.datetime "starts_at"
    t.datetime "ends_at"
    t.string "date_label"
    t.string "venue"
    t.text "description"
    t.string "image_url"
    t.string "hafapass_event_id"
    t.string "hafapass_event_slug"
    t.string "hafapass_distribution_code"
    t.string "external_url"
    t.string "cta_label"
    t.string "status", default: "planned", null: false
    t.boolean "public_visible", default: true, null: false
    t.bigint "goal_cents"
    t.integer "position", default: 0, null: false
    t.datetime "archived_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["host_campaign_id", "archived_at", "public_visible", "starts_at", "position"], name: "index_campaign_events_on_public_listing"
    t.index ["host_campaign_id"], name: "index_campaign_events_on_host_campaign_id"
    t.check_constraint "goal_cents IS NULL OR goal_cents >= 0", name: "chk_campaign_events_goal_cents_non_negative"
    t.check_constraint "kind::text = ANY (ARRAY['fundraiser'::character varying, 'host_night'::character varying, 'golf'::character varying, 'merch_drop'::character varying, 'meeting'::character varying, 'other'::character varying]::text[])", name: "chk_campaign_events_kind"
    t.check_constraint "status::text = ANY (ARRAY['planned'::character varying, 'open'::character varying, 'sold_out'::character varying, 'completed'::character varying, 'cancelled'::character varying]::text[])", name: "chk_campaign_events_status"
  end

  create_table "campaign_invitations", force: :cascade do |t|
    t.bigint "host_campaign_id", null: false
    t.string "email", null: false
    t.string "role", null: false
    t.bigint "invited_by_id", null: false
    t.datetime "accepted_at"
    t.bigint "accepted_by_user_id"
    t.datetime "revoked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "host_campaign_id, lower((email)::text), role", name: "index_campaign_invitations_on_pending_unique", unique: true, where: "((accepted_at IS NULL) AND (revoked_at IS NULL))"
    t.index "lower((email)::text)", name: "index_campaign_invitations_on_pending_email", where: "((accepted_at IS NULL) AND (revoked_at IS NULL))"
    t.index ["accepted_by_user_id"], name: "index_campaign_invitations_on_accepted_by_user_id"
    t.index ["host_campaign_id"], name: "index_campaign_invitations_on_host_campaign_id"
    t.index ["invited_by_id"], name: "index_campaign_invitations_on_invited_by_id"
    t.check_constraint "NOT (accepted_at IS NOT NULL AND revoked_at IS NOT NULL)", name: "chk_campaign_invitations_mutually_exclusive_terminal_state"
    t.check_constraint "role::text = ANY (ARRAY['chair'::character varying, 'treasurer'::character varying, 'board'::character varying]::text[])", name: "chk_campaign_invitations_role"
  end

  create_table "campaign_memberships", force: :cascade do |t|
    t.bigint "host_campaign_id", null: false
    t.bigint "user_id", null: false
    t.string "role", null: false
    t.boolean "active", default: true, null: false
    t.bigint "invited_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["host_campaign_id", "user_id", "role"], name: "index_campaign_memberships_on_campaign_user_role", unique: true
    t.index ["host_campaign_id"], name: "index_campaign_memberships_on_host_campaign_id"
    t.index ["invited_by_id"], name: "index_campaign_memberships_on_invited_by_id"
    t.index ["user_id", "active"], name: "index_campaign_memberships_on_user_active"
    t.index ["user_id"], name: "index_campaign_memberships_on_user_id"
    t.check_constraint "role::text = ANY (ARRAY['chair'::character varying, 'treasurer'::character varying, 'board'::character varying]::text[])", name: "chk_campaign_memberships_role"
  end

  create_table "campaign_posts", force: :cascade do |t|
    t.bigint "host_campaign_id", null: false
    t.bigint "author_id"
    t.string "title", null: false
    t.text "body", null: false
    t.string "image_url"
    t.datetime "published_at"
    t.boolean "pinned", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["author_id"], name: "index_campaign_posts_on_author_id"
    t.index ["host_campaign_id", "pinned", "published_at"], name: "index_campaign_posts_on_campaign_pinned_published"
    t.index ["host_campaign_id"], name: "index_campaign_posts_on_host_campaign_id"
  end

  create_table "class_cohorts", force: :cascade do |t|
    t.string "key", null: false
    t.integer "graduation_year", null: false
    t.string "display_name", null: false
    t.string "short_label", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["graduation_year"], name: "index_class_cohorts_on_graduation_year", unique: true
    t.index ["key"], name: "index_class_cohorts_on_key", unique: true
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
    t.string "name", null: false
    t.string "slug", null: false
    t.integer "starts_year"
    t.integer "position", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active", "starts_year", "position"], name: "index_divisions_on_active_and_starts_year_and_position"
    t.index ["slug"], name: "index_divisions_on_slug", unique: true
  end

  create_table "finance_audit_events", force: :cascade do |t|
    t.bigint "host_campaign_id", null: false
    t.bigint "actor_id", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.string "action", null: false
    t.jsonb "changes_json", default: {}, null: false
    t.string "reason"
    t.string "ip_address"
    t.datetime "created_at", null: false
    t.index ["actor_id"], name: "index_finance_audit_events_on_actor_id"
    t.index ["host_campaign_id", "created_at"], name: "index_finance_audit_events_on_campaign_and_created_at", order: { created_at: :desc }
    t.index ["host_campaign_id"], name: "index_finance_audit_events_on_host_campaign_id"
    t.index ["record_type", "record_id"], name: "index_finance_audit_events_on_record"
  end

  create_table "game_day_notes", force: :cascade do |t|
    t.bigint "tournament_id", null: false
    t.date "date", null: false
    t.string "host_class"
    t.text "food_menu"
    t.text "announcement"
    t.text "sponsor_shoutout"
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
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
    t.bigint "division_id"
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

  create_table "host_campaigns", force: :cascade do |t|
    t.bigint "tournament_id", null: false
    t.bigint "class_cohort_id", null: false
    t.string "slug", null: false
    t.string "title", null: false
    t.string "tagline"
    t.text "description"
    t.string "status", default: "draft", null: false
    t.boolean "featured", default: false, null: false
    t.bigint "goal_cents", null: false
    t.datetime "countdown_target_at"
    t.string "countdown_label"
    t.string "hero_image_url"
    t.string "donation_url"
    t.text "donation_instructions"
    t.string "golf_url"
    t.string "hafapass_organizer_slug"
    t.string "hafapass_tournament_organizer_slug"
    t.string "hafapass_distribution_code"
    t.bigint "fdaa_upfront_cents", default: 0, null: false
    t.integer "fdaa_ticket_share_bps", default: 0, null: false
    t.boolean "public_meter_enabled", default: false, null: false
    t.boolean "include_fdaa_in_public_meter", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["class_cohort_id"], name: "index_host_campaigns_on_class_cohort_id"
    t.index ["featured"], name: "index_host_campaigns_on_single_featured", unique: true, where: "(featured = true)"
    t.index ["slug"], name: "index_host_campaigns_on_slug", unique: true
    t.index ["status", "created_at"], name: "index_host_campaigns_on_status_and_created_at"
    t.index ["tournament_id"], name: "index_host_campaigns_on_tournament_id", unique: true
    t.check_constraint "NOT featured OR (status::text = ANY (ARRAY['active'::character varying, 'closing'::character varying]::text[]))", name: "chk_host_campaigns_featured_status"
    t.check_constraint "fdaa_ticket_share_bps >= 0 AND fdaa_ticket_share_bps <= 10000", name: "chk_host_campaigns_fdaa_ticket_share_bps_range"
    t.check_constraint "fdaa_upfront_cents >= 0", name: "chk_host_campaigns_fdaa_upfront_non_negative"
    t.check_constraint "goal_cents > 0", name: "chk_host_campaigns_goal_cents_positive"
    t.check_constraint "status::text = ANY (ARRAY['draft'::character varying, 'active'::character varying, 'closing'::character varying, 'archived'::character varying]::text[])", name: "chk_host_campaigns_status"
  end

  create_table "media_assets", force: :cascade do |t|
    t.string "article_url"
    t.text "caption"
    t.datetime "created_at", null: false
    t.string "image_url", null: false
    t.string "legacy_id"
    t.string "source", null: false
    t.string "tags"
    t.datetime "taken_at"
    t.string "title", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "game_id"
    t.index ["game_id"], name: "index_media_assets_on_game_id"
    t.index ["legacy_id"], name: "index_media_assets_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["tournament_id", "image_url"], name: "index_media_assets_on_tournament_id_and_image_url"
    t.index ["tournament_id", "source", "taken_at"], name: "index_media_assets_on_tournament_id_and_source_and_taken_at"
    t.index ["tournament_id"], name: "index_media_assets_on_tournament_id"
  end

  create_table "prediction_polls", force: :cascade do |t|
    t.bigint "tournament_id", null: false
    t.bigint "game_id"
    t.string "poll_type", null: false
    t.string "question", null: false
    t.string "status", default: "open", null: false
    t.boolean "show_results", default: true, null: false
    t.datetime "closes_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["game_id", "poll_type"], name: "index_prediction_polls_on_game_id_and_poll_type", unique: true, where: "(game_id IS NOT NULL)"
    t.index ["game_id"], name: "index_prediction_polls_on_game_id"
    t.index ["status", "closes_at"], name: "index_prediction_polls_on_status_and_closes_at"
    t.index ["tournament_id", "poll_type"], name: "index_prediction_polls_on_unique_tournament_poll", unique: true, where: "((poll_type)::text = 'tournament'::text)"
    t.index ["tournament_id"], name: "index_prediction_polls_on_tournament_id"
  end

  create_table "prediction_votes", force: :cascade do |t|
    t.bigint "prediction_poll_id", null: false
    t.bigint "team_id", null: false
    t.string "voter_token_hash", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["prediction_poll_id", "team_id"], name: "index_prediction_votes_on_prediction_poll_id_and_team_id"
    t.index ["prediction_poll_id", "voter_token_hash"], name: "index_prediction_votes_on_poll_and_token_hash", unique: true
    t.index ["prediction_poll_id"], name: "index_prediction_votes_on_prediction_poll_id"
    t.index ["team_id"], name: "index_prediction_votes_on_team_id"
  end

  create_table "roster_entries", force: :cascade do |t|
    t.bigint "team_id", null: false
    t.string "name", null: false
    t.string "jersey_number"
    t.string "position"
    t.string "nickname"
    t.integer "sort_order", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
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

  create_table "team_class_memberships", force: :cascade do |t|
    t.bigint "team_id", null: false
    t.bigint "class_cohort_id", null: false
    t.string "source", default: "auto", null: false
    t.text "notes"
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["class_cohort_id", "team_id"], name: "idx_team_class_memberships_cohort_team"
    t.index ["class_cohort_id"], name: "index_team_class_memberships_on_class_cohort_id"
    t.index ["team_id", "class_cohort_id"], name: "idx_team_class_memberships_unique", unique: true
    t.index ["team_id"], name: "index_team_class_memberships_on_team_id"
  end

  create_table "teams", force: :cascade do |t|
    t.string "class_year_label", null: false
    t.datetime "created_at", null: false
    t.string "display_name", null: false
    t.string "division"
    t.string "legacy_id"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "division_id"
    t.index ["division_id"], name: "index_teams_on_division_id"
    t.index ["legacy_id"], name: "index_teams_on_legacy_id", unique: true, where: "(legacy_id IS NOT NULL)"
    t.index ["tournament_id", "display_name"], name: "index_teams_on_tournament_and_display_name", unique: true
    t.index ["tournament_id", "division"], name: "index_teams_on_tournament_id_and_division"
    t.index ["tournament_id"], name: "index_teams_on_tournament_id"
  end

  create_table "tournament_champion_credits", force: :cascade do |t|
    t.bigint "tournament_champion_id", null: false
    t.bigint "class_cohort_id", null: false
    t.string "credit_type", default: "champion", null: false
    t.string "source", default: "auto", null: false
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["class_cohort_id", "tournament_champion_id"], name: "idx_champion_credits_cohort_champion"
    t.index ["class_cohort_id"], name: "index_tournament_champion_credits_on_class_cohort_id"
    t.index ["tournament_champion_id", "class_cohort_id"], name: "idx_champion_credits_unique", unique: true
    t.index ["tournament_champion_id"], name: "index_tournament_champion_credits_on_tournament_champion_id"
  end

  create_table "tournament_champions", force: :cascade do |t|
    t.bigint "tournament_id"
    t.integer "year", null: false
    t.string "edition_label", default: "", null: false
    t.string "slug", null: false
    t.string "champion_label", default: "", null: false
    t.string "champion_key", default: "", null: false
    t.string "runner_up_label"
    t.string "runner_up_key"
    t.string "score"
    t.string "bracket", default: "overall", null: false
    t.boolean "primary", default: true, null: false
    t.string "status", default: "completed", null: false
    t.string "source", default: "", null: false
    t.text "notes"
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bracket", "year"], name: "index_tournament_champions_on_bracket_and_year"
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
  add_foreign_key "campaign_events", "host_campaigns", on_delete: :restrict
  add_foreign_key "campaign_invitations", "host_campaigns", on_delete: :restrict
  add_foreign_key "campaign_invitations", "users", column: "accepted_by_user_id", on_delete: :restrict
  add_foreign_key "campaign_invitations", "users", column: "invited_by_id", on_delete: :restrict
  add_foreign_key "campaign_memberships", "host_campaigns", on_delete: :restrict
  add_foreign_key "campaign_memberships", "users", column: "invited_by_id", on_delete: :restrict
  add_foreign_key "campaign_memberships", "users", on_delete: :restrict
  add_foreign_key "campaign_posts", "host_campaigns", on_delete: :restrict
  add_foreign_key "campaign_posts", "users", column: "author_id", on_delete: :restrict
  add_foreign_key "content_ingest_items", "tournaments", on_delete: :cascade
  add_foreign_key "finance_audit_events", "host_campaigns", on_delete: :restrict
  add_foreign_key "finance_audit_events", "users", column: "actor_id", on_delete: :restrict
  add_foreign_key "game_day_notes", "tournaments", on_delete: :cascade
  add_foreign_key "games", "divisions", on_delete: :nullify
  add_foreign_key "games", "teams", column: "away_team_id"
  add_foreign_key "games", "teams", column: "home_team_id"
  add_foreign_key "games", "tournaments", on_delete: :cascade
  add_foreign_key "host_campaigns", "class_cohorts", on_delete: :restrict
  add_foreign_key "host_campaigns", "tournaments", on_delete: :restrict
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
  add_foreign_key "team_class_memberships", "class_cohorts", on_delete: :cascade
  add_foreign_key "team_class_memberships", "teams", on_delete: :cascade
  add_foreign_key "teams", "divisions", on_delete: :nullify
  add_foreign_key "teams", "tournaments", on_delete: :cascade
  add_foreign_key "tournament_champion_credits", "class_cohorts", on_delete: :cascade
  add_foreign_key "tournament_champion_credits", "tournament_champions", on_delete: :cascade
  add_foreign_key "tournament_champions", "tournaments", on_delete: :nullify
end
