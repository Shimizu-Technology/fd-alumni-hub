class CreateCampaignFinanceTables < ActiveRecord::Migration[8.1]
  def change
    create_table :budget_lines do |t|
      t.references :host_campaign, null: false, foreign_key: { on_delete: :restrict }
      t.string :kind, null: false
      t.string :category, null: false
      t.bigint :budget_cents, null: false, default: 0
      t.integer :position, null: false, default: 0
      t.text :notes
      t.datetime :archived_at

      t.timestamps
    end

    add_index :budget_lines, "host_campaign_id, kind, LOWER(category)",
      unique: true,
      where: "archived_at IS NULL",
      name: "index_budget_lines_on_active_category_unique"
    add_check_constraint :budget_lines,
      "kind IN ('income', 'expense')",
      name: "chk_budget_lines_kind"
    add_check_constraint :budget_lines,
      "budget_cents >= 0",
      name: "chk_budget_lines_budget_cents_non_negative"

    create_table :pledges do |t|
      t.references :host_campaign, null: false, foreign_key: { on_delete: :restrict }
      t.references :sponsor, null: true, foreign_key: { on_delete: :restrict }
      t.string :donor_name, null: false
      t.string :contact_info
      t.string :tier
      t.boolean :is_in_kind, null: false, default: false
      t.bigint :promised_cents, null: false
      t.date :due_on
      t.string :status, null: false, default: "promised"
      t.text :notes
      t.references :recorded_by, null: false, foreign_key: { to_table: :users, on_delete: :restrict }

      t.timestamps
    end

    add_index :pledges, [ :host_campaign_id, :status, :due_on ], name: "index_pledges_on_campaign_status_due"
    add_check_constraint :pledges,
      "promised_cents > 0",
      name: "chk_pledges_promised_cents_positive"
    add_check_constraint :pledges,
      "status IN ('promised', 'partial', 'fulfilled', 'cancelled')",
      name: "chk_pledges_status"

    create_table :ledger_entries do |t|
      t.references :host_campaign, null: false, foreign_key: { on_delete: :restrict }
      t.string :entry_type, null: false
      t.bigint :amount_cents, null: false
      t.date :entry_date, null: false
      t.references :budget_line, null: true, foreign_key: { on_delete: :restrict }
      t.references :campaign_event, null: true, foreign_key: { on_delete: :restrict }
      t.references :sponsor, null: true, foreign_key: { on_delete: :restrict }
      t.references :pledge, null: true, foreign_key: { on_delete: :restrict }
      t.string :source, null: false
      t.string :payment_method, null: false
      t.string :counterparty, null: false
      t.text :description
      t.string :reference_number
      t.string :paid_by
      t.references :paid_by_user, null: true, foreign_key: { to_table: :users, on_delete: :restrict }
      t.string :reimbursement_status, null: false, default: "not_applicable"
      t.references :reimbursement_approved_by, null: true, foreign_key: { to_table: :users, on_delete: :restrict }
      t.date :reimbursed_at
      t.string :reimbursement_reference
      t.string :receipt_key
      t.string :receipt_filename
      t.string :receipt_content_type
      t.integer :receipt_byte_size
      t.references :recorded_by, null: false, foreign_key: { to_table: :users, on_delete: :restrict }
      t.datetime :voided_at
      t.references :voided_by, null: true, foreign_key: { to_table: :users, on_delete: :restrict }
      t.string :void_reason

      t.timestamps
    end

    add_index :ledger_entries, [ :host_campaign_id, :voided_at, :entry_date ],
      name: "index_ledger_entries_on_campaign_voided_date"
    add_index :ledger_entries, [ :host_campaign_id, :entry_type, :voided_at ],
      name: "index_ledger_entries_on_campaign_type_voided"
    add_index :ledger_entries, [ :pledge_id, :voided_at ],
      name: "index_ledger_entries_on_pledge_voided"
    add_index :ledger_entries, [ :host_campaign_id, :reimbursement_status, :voided_at ],
      name: "index_ledger_entries_on_campaign_reimbursement_voided"
    add_index :ledger_entries, :receipt_key,
      unique: true,
      where: "receipt_key IS NOT NULL",
      name: "index_ledger_entries_on_receipt_key_unique"

    add_check_constraint :ledger_entries,
      "entry_type IN ('income', 'expense')",
      name: "chk_ledger_entries_entry_type"
    add_check_constraint :ledger_entries,
      "amount_cents > 0",
      name: "chk_ledger_entries_amount_cents_positive"
    add_check_constraint :ledger_entries,
      "(entry_type = 'income' AND source IN ('fundraiser_gross', 'fundraiser_net', 'sponsorship', 'donation', 'fdaa_allocation', 'ticket_share', 'merch', 'golf_net', 'other_income')) OR " \
      "(entry_type = 'expense' AND source IN ('event_expense', 'merch_cost', 'venue_ops', 'refund', 'other_expense'))",
      name: "chk_ledger_entries_source_matches_type"
    add_check_constraint :ledger_entries,
      "payment_method IN ('cash', 'paypal', 'check', 'bank_transfer', 'fdaa', 'hafapass_payout', 'golf_payout', 'card', 'other')",
      name: "chk_ledger_entries_payment_method"
    add_check_constraint :ledger_entries,
      "reimbursement_status IN ('not_applicable', 'requested', 'approved', 'reimbursed')",
      name: "chk_ledger_entries_reimbursement_status"
    add_check_constraint :ledger_entries,
      "entry_type <> 'income' OR (reimbursement_status = 'not_applicable' AND paid_by_user_id IS NULL)",
      name: "chk_ledger_entries_income_no_reimbursement"
    add_check_constraint :ledger_entries,
      "(voided_at IS NULL) = (voided_by_id IS NULL) AND (voided_at IS NULL) = (void_reason IS NULL)",
      name: "chk_ledger_entries_void_consistency"
    add_check_constraint :ledger_entries,
      "(receipt_key IS NULL) = (receipt_filename IS NULL) AND (receipt_key IS NULL) = (receipt_content_type IS NULL) AND (receipt_key IS NULL) = (receipt_byte_size IS NULL)",
      name: "chk_ledger_entries_receipt_all_or_nothing"
    add_check_constraint :ledger_entries,
      "receipt_byte_size IS NULL OR receipt_byte_size > 0",
      name: "chk_ledger_entries_receipt_byte_size_positive"
    add_check_constraint :ledger_entries,
      "reimbursed_at IS NULL OR reimbursement_status = 'reimbursed'",
      name: "chk_ledger_entries_reimbursed_at_status"
    add_check_constraint :ledger_entries,
      "reimbursement_approved_by_id IS NULL OR paid_by_user_id IS NULL OR reimbursement_approved_by_id <> paid_by_user_id",
      name: "chk_ledger_entries_approver_not_payer"
  end
end
