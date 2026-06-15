class AddGameDayRostersAndPredictions < ActiveRecord::Migration[8.1]
  def change
    create_table :game_day_notes do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }
      t.date :date, null: false
      t.string :host_class
      t.text :food_menu
      t.text :announcement
      t.text :sponsor_shoutout
      t.boolean :active, null: false, default: true

      t.timestamps
    end
    add_index :game_day_notes, [ :tournament_id, :date ], unique: true
    add_index :game_day_notes, [ :date, :active ]

    create_table :roster_entries do |t|
      t.references :team, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.string :jersey_number
      t.string :position
      t.string :nickname
      t.integer :sort_order, null: false, default: 0
      t.boolean :active, null: false, default: true

      t.timestamps
    end
    add_index :roster_entries, [ :team_id, :active, :sort_order ]
    add_index :roster_entries, [ :team_id, :name ]

    create_table :prediction_polls do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }
      t.references :game, foreign_key: { on_delete: :cascade }
      t.string :poll_type, null: false
      t.string :question, null: false
      t.string :status, null: false, default: "open"
      t.boolean :show_results, null: false, default: true
      t.datetime :closes_at

      t.timestamps
    end
    add_index :prediction_polls, [ :tournament_id, :poll_type ]
    add_index :prediction_polls, [ :game_id, :poll_type ], unique: true, where: "game_id IS NOT NULL"
    add_index :prediction_polls, [ :status, :closes_at ]

    create_table :prediction_votes do |t|
      t.references :prediction_poll, null: false, foreign_key: { on_delete: :cascade }
      t.references :team, null: false, foreign_key: { on_delete: :cascade }
      t.string :voter_token_hash, null: false

      t.timestamps
    end
    add_index :prediction_votes, [ :prediction_poll_id, :voter_token_hash ], unique: true, name: "index_prediction_votes_on_poll_and_token_hash"
    add_index :prediction_votes, [ :prediction_poll_id, :team_id ]
  end
end
