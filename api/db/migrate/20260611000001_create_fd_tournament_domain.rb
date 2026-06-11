class CreateFdTournamentDomain < ActiveRecord::Migration[8.1]
  def change
    create_table :tournaments do |t|
      t.string :name, null: false
      t.integer :year, null: false
      t.datetime :start_date, null: false
      t.datetime :end_date, null: false
      t.string :status, null: false, default: "upcoming"

      t.timestamps
    end

    add_index :tournaments, [ :year, :name ], unique: true
    add_index :tournaments, [ :year, :status ]

    create_table :teams do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }
      t.string :class_year_label, null: false
      t.string :display_name, null: false
      t.string :division

      t.timestamps
    end

    add_index :teams, [ :tournament_id, :display_name ], unique: true, name: "index_teams_on_tournament_and_display_name"
    add_index :teams, [ :tournament_id, :division ]

    create_table :games do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }
      t.references :home_team, null: false, foreign_key: { to_table: :teams }
      t.references :away_team, null: false, foreign_key: { to_table: :teams }
      t.datetime :start_time, null: false
      t.string :venue
      t.string :status, null: false, default: "scheduled"
      t.integer :home_score
      t.integer :away_score
      t.string :stream_url
      t.string :ticket_url
      t.text :notes
      t.string :division
      t.string :bracket_code

      t.timestamps
    end

    add_index :games, :status
    add_index :games, [ :tournament_id, :division ]
    add_index :games, [ :tournament_id, :start_time ]

    create_table :standings do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }
      t.references :team, null: false, foreign_key: { on_delete: :cascade }
      t.integer :wins, null: false, default: 0
      t.integer :losses, null: false, default: 0
      t.integer :points_for, null: false, default: 0
      t.integer :points_against, null: false, default: 0

      t.timestamps
    end

    add_index :standings, [ :tournament_id, :team_id ], unique: true
    add_index :standings, [ :tournament_id, :wins, :losses ]

    create_table :article_links do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }
      t.string :title, null: false
      t.string :source, null: false
      t.string :url, null: false
      t.datetime :published_at
      t.string :image_url
      t.text :excerpt

      t.timestamps
    end

    add_index :article_links, [ :tournament_id, :published_at ]
    add_index :article_links, [ :tournament_id, :url ], unique: true

    create_table :media_assets do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }
      t.string :source, null: false
      t.string :title, null: false
      t.string :image_url, null: false
      t.string :article_url
      t.text :caption
      t.string :tags
      t.datetime :taken_at

      t.timestamps
    end

    add_index :media_assets, [ :tournament_id, :source, :taken_at ]
    add_index :media_assets, [ :tournament_id, :image_url ], unique: true

    create_table :sponsors do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.string :logo_url
      t.string :target_url
      t.string :tier
      t.boolean :active, null: false, default: true
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :sponsors, [ :tournament_id, :active, :position ]

    create_table :content_ingest_items do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }
      t.string :kind, null: false
      t.string :status, null: false, default: "pending"
      t.string :source, null: false
      t.string :title, null: false
      t.string :url, null: false
      t.string :image_url
      t.text :excerpt
      t.string :confidence
      t.text :notes
      t.string :imported_to_id

      t.timestamps
    end

    add_index :content_ingest_items, [ :tournament_id, :status, :kind ], name: "index_ingest_on_tournament_status_kind"
    add_index :content_ingest_items, [ :source, :status ]
    add_index :content_ingest_items, [ :tournament_id, :url ], unique: true, name: "index_ingest_on_tournament_and_url"

    create_table :admin_whitelists do |t|
      t.string :email, null: false
      t.string :role, null: false, default: "admin"
      t.boolean :active, null: false, default: true
      t.text :notes

      t.timestamps
    end

    add_index :admin_whitelists, "LOWER(email)", unique: true, name: "index_admin_whitelists_on_lower_email"

    create_table :users do |t|
      t.string :clerk_id
      t.string :email, null: false
      t.string :first_name
      t.string :last_name
      t.string :role, null: false, default: "staff"
      t.boolean :active, null: false, default: true

      t.timestamps
    end

    add_index :users, :clerk_id, unique: true, where: "clerk_id IS NOT NULL"
    add_index :users, "LOWER(email)", unique: true, name: "index_users_on_lower_email"
  end
end
