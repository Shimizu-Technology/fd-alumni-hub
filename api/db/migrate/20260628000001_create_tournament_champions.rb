class CreateTournamentChampions < ActiveRecord::Migration[7.2]
  def change
    create_table :tournament_champions do |t|
      t.references :tournament, null: true, foreign_key: true
      t.integer :year, null: false
      t.string :edition_label, null: false, default: ""
      t.string :slug, null: false
      t.string :champion_label, null: false, default: ""
      t.string :champion_key, null: false, default: ""
      t.string :runner_up_label
      t.string :runner_up_key
      t.string :score
      t.string :status, null: false, default: "completed"
      t.string :source, null: false, default: ""
      t.text :notes
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :tournament_champions, :slug, unique: true
    add_index :tournament_champions, [ :year, :position ]
    add_index :tournament_champions, :champion_key
  end
end
