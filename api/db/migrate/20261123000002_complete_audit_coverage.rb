class CompleteAuditCoverage < ActiveRecord::Migration[8.1]
  def up
    create_table :audit_checkpoints do |t|
      t.bigint :first_audit_event_id, null: false
      t.bigint :last_audit_event_id, null: false
      t.bigint :event_count, null: false
      t.string :previous_digest
      t.string :chain_digest, null: false
      t.string :hmac_signature
      t.datetime :created_at, null: false
      t.index :last_audit_event_id, unique: true
    end

    Audit::DatabaseTriggers.install!(connection)
  end

  def down
    drop_table :audit_checkpoints
    Audit::DatabaseTriggers.install!(connection)
  end
end
