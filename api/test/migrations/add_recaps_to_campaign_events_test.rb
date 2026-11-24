require "test_helper"
require Rails.root.join("db/migrate/20261124000001_add_recaps_to_campaign_events")

class AddRecapsToCampaignEventsTest < ActiveSupport::TestCase
  test "migration reverses field additions and retains campaign event audit capture" do
    tournament = Tournament.create!(name: "Migration cup", year: 2037, start_date: "2037-07-01", end_date: "2037-07-15")
    cohort = ClassCohort.create!(key: "17", graduation_year: 2017, display_name: "Class of 2017", short_label: "2017")
    campaign = HostCampaign.create!(tournament: tournament, class_cohort: cohort, slug: "migration-cup", title: "Migration cup", goal_cents: 3_000_000)
    event = campaign.campaign_events.create!(kind: "fundraiser", title: "Existing event")
    connection = CampaignEvent.connection

    connection.transaction(requires_new: true) do
      ActiveRecord::Migration.suppress_messages do
        migration = AddRecapsToCampaignEvents.new
        migration.migrate(:down)
        %i[recap_notes recap_highlights raised_display recap_photos].each do |column|
          refute connection.column_exists?(:campaign_events, column)
        end
        migration.migrate(:up)
      end

      connection.clear_cache!
      assert_equal [], event.reload.recap_photos
      event.update!(recap_notes: "Archived story", recap_photos: [ { url: "https://example.com/old.jpg" } ])
      audit = AuditEvent.where(record_type: "CampaignEvent", record_id: event.id.to_s, action: "update").order(:id).last
      assert_equal "Archived story", audit.after_json["recap_notes"]
      assert_equal event.recap_photos, audit.after_json["recap_photos"]
      raise ActiveRecord::Rollback
    end
  ensure
    connection&.clear_cache!
  end
end
