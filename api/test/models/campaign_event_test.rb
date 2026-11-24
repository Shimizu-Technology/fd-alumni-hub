require "test_helper"

class CampaignEventTest < ActiveSupport::TestCase
  setup do
    tournament = Tournament.create!(name: "Alumni Cup", year: 2090, start_date: "2090-07-01", end_date: "2090-07-20")
    cohort = ClassCohort.create!(key: "17", graduation_year: 2017, display_name: "Class of 2017", short_label: "2017")
    @campaign = HostCampaign.create!(tournament: tournament, class_cohort: cohort, slug: "alumni-cup", title: "Alumni Cup", status: "active", goal_cents: 3_000_000)
    @event = @campaign.campaign_events.build(kind: "fundraiser", title: "Fundraiser", status: "open")
  end

  test "completion uses the event boundary and preserves manual overrides and stored status" do
    freeze_time do
      now = Time.current
      @event.assign_attributes(starts_at: 2.hours.ago, ends_at: now)
      assert_equal "open", @event.effective_status(now)
      assert_not @event.past?(now)

      @event.ends_at = 1.second.ago
      @event.save!
      assert @event.past?(now)
      assert_equal "completed", @event.public_json[:status]
      assert_equal [ "completed", "open", true ], @event.admin_json.values_at(:status, :storedStatus, :autoCompleted)
      assert_equal "open", @event.reload.status

      @event.assign_attributes(status: "cancelled", ends_at: nil)
      assert_equal "cancelled", @event.effective_status
      assert_not @event.admin_json[:autoCompleted]

      @event.assign_attributes(status: "completed", starts_at: 1.day.from_now)
      assert_equal "completed", @event.effective_status
      assert_not @event.admin_json[:autoCompleted]
    end
  end

  test "upcoming scope and campaign summary skip completed and cancelled events including end-only entries" do
    freeze_time do
      @event.update!(ends_at: 1.hour.ago, public_visible: true)
      cancelled = @campaign.campaign_events.create!(kind: "fundraiser", title: "Cancelled", status: "cancelled", public_visible: true)
      tba = @campaign.campaign_events.create!(kind: "fundraiser", title: "TBA", public_visible: true)
      boundary = @campaign.campaign_events.create!(kind: "fundraiser", title: "Finishing now", starts_at: 1.hour.ago, ends_at: Time.current, public_visible: true)
      assert_equal [ boundary, tba ], @campaign.campaign_events.upcoming_or_tba.ordered
      assert_equal boundary.id.to_s, @campaign.home_summary_json.dig(:nextEvent, :id)
      assert_equal "cancelled", cancelled.effective_status
    end
  end

  test "recap fields normalize text and validate lengths and image shapes" do
    @event.assign_attributes(
      recap_notes: "  Thank you!\n\nGreat turnout.  ",
      recap_highlights: "  Alumni on the court  ",
      raised_display: " $4,200  raised ",
      recap_photos: [
        { url: " https://photo.example.com/alumni.jpg ", caption: " The   team! " },
        { url: "https://photo.example.com/court.jpg", caption: " " },
        { url: "http://localhost:3000/photo.jpg" }
      ]
    )
    @event.save!
    assert_equal [ "Thank you!\n\nGreat turnout.", "Alumni on the court", "$4,200 raised" ],
      @event.reload.public_json.values_at(:recapNotes, :recapHighlights, :raisedDisplay)
    assert_equal [
      { "url" => "https://photo.example.com/alumni.jpg", "caption" => "The team!" },
      { "url" => "https://photo.example.com/court.jpg" },
      { "url" => "http://localhost:3000/photo.jpg" }
    ], @event.recap_photos

    @event.assign_attributes(recap_notes: "a" * 5001, recap_highlights: "a" * 1001, raised_display: "a" * 81)
    assert_not @event.valid?
    %i[recap_notes recap_highlights raised_display].each { |attribute| assert @event.errors[attribute].any? }

    valid_url = "https://photo.example.com/court.jpg"
    invalid_values = [
      nil, { url: valid_url }, [ nil ], Array.new(25, { url: valid_url }),
      [ { url: "javascript:alert(1)" } ], [ { url: "http://photo.example.com/court.jpg" } ],
      [ { url: "https://user@photo.example.com/court.jpg" } ],
      [ { url: valid_url, caption: 3 } ], [ { url: valid_url, caption: "a" * 241 } ]
    ]
    invalid_values.each do |value|
      @event.recap_photos = value
      assert_not @event.valid?
      assert @event.errors[:recap_photos].any?, "Expected invalid photos for #{value.inspect}"
    end
  end
end
