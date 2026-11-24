class AddRecapsToCampaignEvents < ActiveRecord::Migration[8.1]
  def change
    add_column :campaign_events, :recap_notes, :text
    add_column :campaign_events, :recap_highlights, :text
    add_column :campaign_events, :raised_display, :string
    add_column :campaign_events, :recap_photos, :jsonb, default: [], null: false
  end
end
