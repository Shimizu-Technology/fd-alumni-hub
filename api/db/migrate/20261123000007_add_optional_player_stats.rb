class AddOptionalPlayerStats < ActiveRecord::Migration[8.1]
  def up
    add_column :tournaments, :enable_player_stats, :boolean, null: false, default: false
    add_column :games, :box_score_status, :string, null: false, default: "none"
    add_column :games, :box_score_coverage, :string
    add_column :games, :box_score_published_at, :datetime
    add_reference :games, :box_score_updated_by, foreign_key: { to_table: :users, on_delete: :nullify }
    add_check_constraint :games, "box_score_status IN ('none', 'draft', 'published', 'needs_review')", name: "games_box_score_status"
    add_check_constraint :games, "box_score_coverage IN ('selected_scorers', 'full_box_score')", name: "games_box_score_coverage"

    create_table :player_game_stats do |t|
      t.references :game, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :roster_entry, null: false, foreign_key: { on_delete: :restrict }
      t.references :team, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.string :player_name_snapshot, null: false
      t.string :jersey_number_snapshot
      t.integer :points
      t.integer :rebounds
      t.integer :assists
      t.integer :steals
      t.integer :blocks
      t.integer :three_pointers_made
      t.integer :fouls
      t.integer :minutes
      t.text :notes
      t.timestamps

      t.index %i[game_id roster_entry_id], unique: true
      t.index %i[team_id game_id]
    end

    Audit::DatabaseTriggers.install!(connection)
  end

  def down
    drop_table :player_game_stats
    remove_check_constraint :games, name: "games_box_score_coverage"
    remove_check_constraint :games, name: "games_box_score_status"
    remove_reference :games, :box_score_updated_by, foreign_key: { to_table: :users }
    remove_columns :games, :box_score_status, :box_score_coverage, :box_score_published_at
    remove_column :tournaments, :enable_player_stats
    Audit::DatabaseTriggers.install!(connection)
  end
end
