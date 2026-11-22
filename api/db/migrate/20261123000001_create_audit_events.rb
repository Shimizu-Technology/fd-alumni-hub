class CreateAuditEvents < ActiveRecord::Migration[8.1]
  def up
    create_table :audit_events do |t|
      t.datetime :occurred_at, null: false, default: -> { "CURRENT_TIMESTAMP" }
      t.string :operation_id, null: false
      t.string :actor_type, null: false, default: "system"
      t.bigint :actor_id
      t.string :actor_name
      t.string :actor_email
      t.string :actor_role
      t.string :area, null: false
      t.string :action, null: false
      t.string :record_type, null: false
      t.string :record_id, null: false
      t.string :record_label
      t.bigint :tournament_id
      t.bigint :host_campaign_id
      t.string :summary, null: false
      t.jsonb :before_json, null: false, default: {}
      t.jsonb :after_json, null: false, default: {}
      t.jsonb :metadata_json, null: false, default: {}
      t.string :reason
      t.string :request_id
      t.string :http_method
      t.string :route_path
      t.string :ip_address
      t.bigint :legacy_finance_audit_event_id

      t.check_constraint "actor_type IN ('user', 'system', 'anonymous')", name: "chk_audit_events_actor_type"
      t.index [ :occurred_at, :id ]
      t.index [ :area, :occurred_at ]
      t.index [ :host_campaign_id, :occurred_at ]
      t.index [ :tournament_id, :occurred_at ]
      t.index [ :actor_id, :occurred_at ]
      t.index [ :record_type, :record_id ]
      t.index :operation_id
      t.index :legacy_finance_audit_event_id, unique: true, where: "legacy_finance_audit_event_id IS NOT NULL"
    end

    Audit::DatabaseTriggers.install!(connection)
  end

  def down
    Audit::DatabaseTriggers.uninstall!(connection)
    drop_table :audit_events
  end
end
