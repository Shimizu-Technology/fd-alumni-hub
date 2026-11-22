class AddModularAccess < ActiveRecord::Migration[8.1]
  def up
    add_column :users, :super_admin, :boolean, default: false, null: false
    add_index :users, :super_admin

    create_table :permission_grants do |t|
      t.references :user, foreign_key: true
      t.string :email, null: false, index: true
      t.string :scope_type, null: false
      t.bigint :scope_id
      t.string :capability, null: false
      t.jsonb :actions, default: [], null: false
      t.string :preset_key
      t.references :granted_by, foreign_key: { to_table: :users }
      t.datetime :accepted_at
      t.datetime :revoked_at
      t.timestamps

      t.index [ :user_id, :revoked_at ]
      t.index [ :email, :revoked_at ]
      t.index [ :scope_type, :scope_id, :capability ]
      t.check_constraint "email = lower(email)", name: "permission_grants_lowercase_email"
      t.check_constraint "(scope_type = 'site' AND scope_id IS NULL) OR (scope_type IN ('tournament', 'campaign') AND scope_id IS NOT NULL)", name: "permission_grants_valid_scope"
    end

    Audit::DatabaseTriggers.install!(connection)
    execute "UPDATE users SET super_admin = TRUE WHERE active AND role = 'admin'"
  end

  def down
    drop_table :permission_grants
    remove_column :users, :super_admin
    Audit::DatabaseTriggers.install!(connection)
  end
end
