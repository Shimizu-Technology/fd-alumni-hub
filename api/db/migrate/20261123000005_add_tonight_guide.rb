class AddTonightGuide < ActiveRecord::Migration[8.1]
  def up
    add_column :game_day_notes, :menu_items, :jsonb, default: [], null: false
    add_column :game_day_notes, :special_events, :jsonb, default: [], null: false
    add_column :game_day_notes, :host_spotlight, :jsonb, default: {}, null: false
    add_column :game_day_notes, :status, :string, default: "published", null: false
    add_column :game_day_notes, :published_at, :datetime
    add_column :game_day_notes, :lock_version, :integer, default: 0, null: false
    add_column :tournaments, :info_guide_json, :jsonb, default: {}, null: false
    create_table :tournament_updates do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.string :title, null: false
      t.text :body, null: false
      t.date :target_date
      t.string :status, default: "draft", null: false
      t.datetime :published_at
      t.datetime :expires_at
      t.boolean :pinned, default: false, null: false
      t.references :author, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
      t.index %i[tournament_id status published_at]
      t.index %i[tournament_id target_date]
    end
    Audit::DatabaseTriggers.install!(connection)
  end

  def down
    drop_table :tournament_updates
    remove_column :tournaments, :info_guide_json
    remove_columns :game_day_notes, :menu_items, :special_events, :host_spotlight, :status, :published_at, :lock_version
    Audit::DatabaseTriggers.install!(connection)
  end
end
