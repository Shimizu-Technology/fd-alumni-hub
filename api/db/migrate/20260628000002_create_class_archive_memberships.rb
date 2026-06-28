class CreateClassArchiveMemberships < ActiveRecord::Migration[7.2]
  def change
    create_table :class_cohorts do |t|
      t.string :key, null: false
      t.integer :graduation_year, null: false
      t.string :display_name, null: false
      t.string :short_label, null: false

      t.timestamps
    end

    add_index :class_cohorts, :key, unique: true
    add_index :class_cohorts, :graduation_year, unique: true

    create_table :team_class_memberships do |t|
      t.references :team, null: false, foreign_key: { on_delete: :cascade }
      t.references :class_cohort, null: false, foreign_key: { on_delete: :cascade }
      t.string :source, null: false, default: "auto"
      t.text :notes
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :team_class_memberships, [ :team_id, :class_cohort_id ], unique: true, name: "idx_team_class_memberships_unique"
    add_index :team_class_memberships, [ :class_cohort_id, :team_id ], name: "idx_team_class_memberships_cohort_team"

    create_table :tournament_champion_credits do |t|
      t.references :tournament_champion, null: false, foreign_key: { on_delete: :cascade }
      t.references :class_cohort, null: false, foreign_key: { on_delete: :cascade }
      t.string :credit_type, null: false, default: "champion"
      t.string :source, null: false, default: "auto"
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :tournament_champion_credits, [ :tournament_champion_id, :class_cohort_id ], unique: true, name: "idx_champion_credits_unique"
    add_index :tournament_champion_credits, [ :class_cohort_id, :tournament_champion_id ], name: "idx_champion_credits_cohort_champion"
  end
end
