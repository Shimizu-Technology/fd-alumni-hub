class AddGymResultsAndCorrections < ActiveRecord::Migration[8.1]
  def up
    add_column :games, :result_outcome, :string
    add_reference :games, :official_winner_team, foreign_key: { to_table: :teams, on_delete: :nullify }
    add_column :games, :bracket_needs_review, :boolean, null: false, default: false
    add_column :games, :bracket_exception_note, :string

    create_table :score_mutations do |t|
      t.references :actor, null: false, foreign_key: { to_table: :users }
      t.references :game, null: false, foreign_key: { on_delete: :cascade }
      t.string :client_mutation_id, null: false
      t.string :payload_digest, null: false
      t.jsonb :result_snapshot, null: false, default: {}
      t.timestamps

      t.index %i[actor_id game_id client_mutation_id], unique: true, name: "index_score_mutations_on_actor_game_and_client_id"
    end

    create_table :score_correction_requests do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }
      t.references :game, null: false, foreign_key: { on_delete: :cascade }
      t.references :requested_by, null: false, foreign_key: { to_table: :users }
      t.references :resolved_by, foreign_key: { to_table: :users }
      t.string :status, null: false, default: "pending"
      t.integer :proposed_home_score
      t.integer :proposed_away_score
      t.string :proposed_status, null: false, default: "final"
      t.string :proposed_result_outcome
      t.references :proposed_official_winner_team, foreign_key: { to_table: :teams, on_delete: :nullify }
      t.string :proposed_status_note
      t.integer :base_lock_version
      t.text :reason, null: false
      t.text :resolution_note
      t.datetime :resolved_at
      t.timestamps

      t.index %i[tournament_id status]
      t.index %i[game_id status]
    end

    Audit::DatabaseTriggers.install!(connection)
  end

  def down
    drop_table :score_correction_requests
    drop_table :score_mutations
    remove_reference :games, :official_winner_team, foreign_key: { to_table: :teams }
    remove_columns :games, :result_outcome, :bracket_needs_review, :bracket_exception_note
    Audit::DatabaseTriggers.install!(connection)
  end
end
