class CreateTournamentAlerts < ActiveRecord::Migration[8.1]
  def change
    create_table :tournament_alerts do |t|
      t.references :tournament, null: true, foreign_key: { on_delete: :cascade }
      t.string :severity, null: false, default: "warning"
      t.string :title, null: false
      t.text :message, null: false
      t.boolean :active, null: false, default: true
      t.datetime :starts_at
      t.datetime :expires_at
      t.references :created_by, null: true, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :updated_by, null: true, foreign_key: { to_table: :users, on_delete: :nullify }

      t.timestamps
    end

    add_index :tournament_alerts, [ :active, :starts_at, :expires_at ], name: "index_tournament_alerts_on_active_window"
    add_index :tournament_alerts, [ :tournament_id, :active ], name: "index_tournament_alerts_on_tournament_and_active"
    add_check_constraint :tournament_alerts, "severity IN ('info', 'warning', 'urgent')", name: "chk_tournament_alerts_severity"
  end
end
