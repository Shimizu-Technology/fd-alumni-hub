class CreateHafapassEventSnapshots < ActiveRecord::Migration[8.1]
  def change
    create_table :hafapass_event_snapshots do |t|
      t.string :organizer_slug, null: false
      t.jsonb :payload_json, null: false, default: []
      t.datetime :fetched_at
      t.datetime :refreshing_until
      t.string :last_error
      t.datetime :last_error_at

      t.timestamps
    end

    add_index :hafapass_event_snapshots, :organizer_slug, unique: true
  end
end
