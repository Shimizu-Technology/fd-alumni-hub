class CreateSitePublications < ActiveRecord::Migration[8.1]
  def up
    add_column :tournaments, :schedule_published_at, :datetime
    add_column :tournaments, :schedule_revision, :integer, default: 0, null: false
    execute <<~SQL
      UPDATE tournaments
      SET schedule_published_at = COALESCE(updated_at, created_at), schedule_revision = 1
      WHERE status IN ('completed', 'live')
         OR EXISTS (SELECT 1 FROM games WHERE games.tournament_id = tournaments.id)
    SQL

    create_table :site_publications do |t|
      t.integer :version_number, null: false, index: { unique: true }
      t.string :mode, null: false
      t.references :tournament, foreign_key: true
      t.references :host_campaign, foreign_key: true
      t.jsonb :section_overrides, default: {}, null: false
      t.string :recap_headline
      t.text :recap_summary
      t.boolean :handoff_banner_enabled, default: false, null: false
      t.references :published_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :published_at, null: false
      t.references :restored_from, foreign_key: { to_table: :site_publications }
      t.boolean :current, default: false, null: false, index: { unique: true, where: "current = true" }
      t.timestamps
    end

    Audit::DatabaseTriggers.install!(connection)
  end

  def down
    drop_table :site_publications
    remove_column :tournaments, :schedule_revision
    remove_column :tournaments, :schedule_published_at
    Audit::DatabaseTriggers.install!(connection)
  end
end
