class CreateCampaignMembershipsAndInvitations < ActiveRecord::Migration[8.1]
  def change
    create_table :campaign_memberships do |t|
      t.references :host_campaign, null: false, foreign_key: { on_delete: :restrict }
      t.references :user, null: false, foreign_key: { on_delete: :restrict }
      t.string :role, null: false
      t.boolean :active, null: false, default: true
      t.references :invited_by, null: true, foreign_key: { to_table: :users, on_delete: :restrict }

      t.timestamps
    end

    add_index :campaign_memberships, [ :host_campaign_id, :user_id, :role ],
      unique: true,
      name: "index_campaign_memberships_on_campaign_user_role"
    add_index :campaign_memberships, [ :user_id, :active ],
      name: "index_campaign_memberships_on_user_active"
    add_check_constraint :campaign_memberships,
      "role IN ('chair', 'treasurer', 'board')",
      name: "chk_campaign_memberships_role"

    create_table :campaign_invitations do |t|
      t.references :host_campaign, null: false, foreign_key: { on_delete: :restrict }
      t.string :email, null: false
      t.string :role, null: false
      t.references :invited_by, null: false, foreign_key: { to_table: :users, on_delete: :restrict }
      t.datetime :accepted_at
      t.references :accepted_by_user, null: true, foreign_key: { to_table: :users, on_delete: :restrict }
      t.datetime :revoked_at

      t.timestamps
    end

    add_index :campaign_invitations,
      "host_campaign_id, LOWER(email), role",
      unique: true,
      where: "accepted_at IS NULL AND revoked_at IS NULL",
      name: "index_campaign_invitations_on_pending_unique"
    add_index :campaign_invitations,
      "LOWER(email)",
      where: "accepted_at IS NULL AND revoked_at IS NULL",
      name: "index_campaign_invitations_on_pending_email"
    add_check_constraint :campaign_invitations,
      "role IN ('chair', 'treasurer', 'board')",
      name: "chk_campaign_invitations_role"
  end
end
