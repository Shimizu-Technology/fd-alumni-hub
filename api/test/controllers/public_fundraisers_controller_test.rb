require "test_helper"

class PublicFundraisersControllerTest < ActionDispatch::IntegrationTest
  setup do
    tournament = Tournament.create!(name: "Alumni Cup", year: 2090, start_date: "2090-07-01", end_date: "2090-07-20")
    cohort = ClassCohort.create!(key: "17", graduation_year: 2017, display_name: "Class of 2017", short_label: "2017")
    @campaign = HostCampaign.create!(tournament: tournament, class_cohort: cohort, slug: "alumni-cup", title: "Alumni Cup", goal_cents: 3_000_000,
      status: "active", hafapass_organizer_slug: "host-class")
    @event = @campaign.campaign_events.create!(kind: "fundraiser", title: "Alumni night", status: "open", public_visible: true,
      starts_at: 1.day.ago, recap_notes: "Thank you!", recap_highlights: "Alumni scrimmage", raised_display: "$4,200 raised",
      recap_photos: [ { url: "https://example.com/recap.jpg", caption: "First tip-off" } ], hafapass_event_id: "matched")
    HafapassEventSnapshot.create!(organizer_slug: "host-class", fetched_at: Time.current, payload_json: [
      { "id" => "matched", "slug" => "alumni-night", "organizerSlug" => "host-class", "ticketState" => "on_sale" }
    ])
  end

  test "returns public recap and matched ticket data for an automatically completed event" do
    get "/api/v1/public/fundraisers/#{@event.id}"
    assert_response :success
    body = response.parsed_body
    event = body.fetch("event")
    assert_equal [ "completed", "Thank you!", "Alumni scrimmage", "$4,200 raised" ],
      event.values_at("status", "recapNotes", "recapHighlights", "raisedDisplay")
    assert_equal @event.recap_photos, event["recapPhotos"]
    assert_equal "matched", event.dig("hafapass", "id")
    assert_match %r{/events/alumni-night\z}, event.dig("hafapass", "buyUrl")
    assert_equal @campaign.slug, body.dig("campaign", "slug")
    assert_equal true, body.dig("hafapass", "available")
    refute event.key?("storedStatus")
    refute body["campaign"].key?("goalCents")
  end

  test "conceals hidden and archived events, draft campaigns, and unknown IDs" do
    path = "/api/v1/public/fundraisers/#{@event.id}"
    @event.update!(public_visible: false)
    get path
    assert_response :not_found

    @event.update!(public_visible: true, archived_at: Time.current)
    get path
    assert_response :not_found

    @event.update!(archived_at: nil)
    @campaign.update!(status: "draft")
    get path
    assert_response :not_found

    get "/api/v1/public/fundraisers/unknown"
    assert_response :not_found

    @campaign.update!(status: "archived")
    get path
    assert_response :success
  end
end
