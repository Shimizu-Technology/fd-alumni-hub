class CreateHostCampaignsAndContent < ActiveRecord::Migration[8.1]
  def up
    create_table :host_campaigns do |t|
      t.references :tournament, null: false, foreign_key: { on_delete: :restrict }, index: { unique: true }
      t.references :class_cohort, null: false, foreign_key: { on_delete: :restrict }, index: true
      t.string :slug, null: false
      t.string :title, null: false
      t.string :tagline
      t.text :description
      t.string :status, null: false, default: "draft"
      t.boolean :featured, null: false, default: false
      t.bigint :goal_cents, null: false
      t.datetime :countdown_target_at
      t.string :countdown_label
      t.string :hero_image_url
      t.string :donation_url
      t.text :donation_instructions
      t.string :golf_url
      t.string :hafapass_organizer_slug
      t.string :hafapass_tournament_organizer_slug
      t.string :hafapass_distribution_code
      t.bigint :fdaa_upfront_cents, null: false, default: 0
      t.integer :fdaa_ticket_share_bps, null: false, default: 0
      t.boolean :public_meter_enabled, null: false, default: false
      t.boolean :include_fdaa_in_public_meter, null: false, default: false

      t.timestamps
    end

    add_index :host_campaigns, :slug, unique: true
    add_index :host_campaigns, [ :status, :created_at ]
    add_index :host_campaigns, :featured, unique: true, where: "featured = true", name: "index_host_campaigns_on_single_featured"

    add_check_constraint :host_campaigns,
      "status IN ('draft', 'active', 'closing', 'archived')",
      name: "chk_host_campaigns_status"
    add_check_constraint :host_campaigns,
      "goal_cents > 0",
      name: "chk_host_campaigns_goal_cents_positive"
    add_check_constraint :host_campaigns,
      "fdaa_upfront_cents >= 0",
      name: "chk_host_campaigns_fdaa_upfront_non_negative"
    add_check_constraint :host_campaigns,
      "fdaa_ticket_share_bps >= 0 AND fdaa_ticket_share_bps <= 10000",
      name: "chk_host_campaigns_fdaa_ticket_share_bps_range"
    add_check_constraint :host_campaigns,
      "NOT featured OR status IN ('active', 'closing')",
      name: "chk_host_campaigns_featured_status"

    create_table :campaign_events do |t|
      t.references :host_campaign, null: false, foreign_key: { on_delete: :restrict }
      t.string :kind, null: false, default: "fundraiser"
      t.string :title, null: false
      t.datetime :starts_at
      t.datetime :ends_at
      t.string :date_label
      t.string :venue
      t.text :description
      t.string :image_url
      t.string :hafapass_event_id
      t.string :hafapass_event_slug
      t.string :hafapass_distribution_code
      t.string :external_url
      t.string :cta_label
      t.string :status, null: false, default: "planned"
      t.boolean :public_visible, null: false, default: true
      t.bigint :goal_cents
      t.integer :position, null: false, default: 0
      t.datetime :archived_at

      t.timestamps
    end

    add_index :campaign_events, [ :host_campaign_id, :archived_at, :public_visible, :starts_at, :position ],
      name: "index_campaign_events_on_public_listing"

    add_check_constraint :campaign_events,
      "kind IN ('fundraiser', 'host_night', 'golf', 'merch_drop', 'meeting', 'other')",
      name: "chk_campaign_events_kind"
    add_check_constraint :campaign_events,
      "status IN ('planned', 'open', 'sold_out', 'completed', 'cancelled')",
      name: "chk_campaign_events_status"
    add_check_constraint :campaign_events,
      "goal_cents IS NULL OR goal_cents >= 0",
      name: "chk_campaign_events_goal_cents_non_negative"

    create_table :campaign_posts do |t|
      t.references :host_campaign, null: false, foreign_key: { on_delete: :restrict }
      t.references :author, null: true, foreign_key: { to_table: :users, on_delete: :restrict }
      t.string :title, null: false
      t.text :body, null: false
      t.string :image_url
      t.datetime :published_at
      t.boolean :pinned, null: false, default: false

      t.timestamps
    end

    add_index :campaign_posts, [ :host_campaign_id, :pinned, :published_at ],
      name: "index_campaign_posts_on_campaign_pinned_published"

    create_table :finance_audit_events do |t|
      t.references :host_campaign, null: false, foreign_key: { on_delete: :restrict }
      t.references :actor, null: false, foreign_key: { to_table: :users, on_delete: :restrict }
      t.string :record_type, null: false
      t.bigint :record_id, null: false
      t.string :action, null: false
      t.jsonb :changes_json, null: false, default: {}
      t.string :reason
      t.string :ip_address
      t.datetime :created_at, null: false
    end

    add_index :finance_audit_events, [ :host_campaign_id, :created_at ],
      order: { created_at: :desc },
      name: "index_finance_audit_events_on_campaign_and_created_at"
    add_index :finance_audit_events, [ :record_type, :record_id ],
      name: "index_finance_audit_events_on_record"
  end

  def down
    drop_table :finance_audit_events
    drop_table :campaign_posts
    drop_table :campaign_events
    drop_table :host_campaigns
  end
end
