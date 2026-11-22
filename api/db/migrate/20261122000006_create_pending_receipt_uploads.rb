class CreatePendingReceiptUploads < ActiveRecord::Migration[8.1]
  def change
    create_table :pending_receipt_uploads do |t|
      t.references :host_campaign, null: false, foreign_key: { on_delete: :restrict }
      t.references :uploaded_by, null: false, foreign_key: { to_table: :users, on_delete: :restrict }
      t.string :upload_token, null: false
      t.string :s3_key, null: false
      t.string :original_filename, null: false
      t.string :expected_content_type, null: false
      t.datetime :expires_at, null: false
      t.datetime :attached_at

      t.timestamps
    end

    add_index :pending_receipt_uploads, :upload_token, unique: true
    add_index :pending_receipt_uploads, :s3_key, unique: true
    add_index :pending_receipt_uploads, [ :host_campaign_id, :attached_at, :expires_at ],
      name: "index_pending_receipt_uploads_on_campaign_state"
  end
end
