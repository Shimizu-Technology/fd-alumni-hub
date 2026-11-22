require "test_helper"

class HafapassEventsClientTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @cohort_2017 = ClassCohort.create!(key: "17", graduation_year: 2017, display_name: "Class of 2017", short_label: "'17")
    @tournament_2027 = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2027,
      start_date: Date.new(2027, 6, 25),
      end_date: Date.new(2027, 7, 16),
      status: "upcoming"
    )
    @campaign = HostCampaign.create!(
      tournament: @tournament_2027,
      class_cohort: @cohort_2017,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      status: "active",
      featured: true,
      goal_cents: 3_000_000,
      hafapass_organizer_slug: "co2017",
      hafapass_distribution_code: "hub-all-2027"
    )
    @matched_event = @campaign.campaign_events.create!(
      kind: "fundraiser",
      title: "Two Pints, One Purpose",
      starts_at: 2.weeks.from_now,
      status: "open",
      hafapass_event_id: "hp_101",
      hafapass_event_slug: "old-slug-before-rename",
      hafapass_distribution_code: "co2017-antigu"
    )
    @cancelled_hub_event = @campaign.campaign_events.create!(
      kind: "fundraiser",
      title: "Cancelled Night",
      starts_at: 3.weeks.from_now,
      status: "cancelled",
      hafapass_event_id: "hp_102"
    )
  end

  test "fetch_remote sends zero auth headers, normalizes all ticket states, and strips unknown organizer fields" do
    captured_requests = []
    stub_response = Struct.new(:code, :parsed_response) do
      def success?
        code == 200
      end
    end

    payload = {
      "events" => [
        {
          "id" => "hp_101",
          "slug" => "two-pints-2027",
          "title" => "Two Pints",
          "short_description" => "Fundraiser at Antigu",
          "starts_at" => 2.weeks.from_now.iso8601,
          "status" => "published",
          "purchasable" => true,
          "internal_stripe_account" => "acct_secret_do_not_leak",
          "ticket_types" => [
            { "name" => "General", "all_in_price_cents" => 2000, "quantity_remaining" => 40, "on_sale" => true }
          ]
        },
        {
          "id" => "hp_102",
          "slug" => "sold-out-night",
          "title" => "Sold Out Night",
          "status" => "published",
          "purchasable" => false,
          "ticket_types" => [
            { "name" => "GA", "all_in_price_cents" => 2500, "quantity_remaining" => 0, "on_sale" => false }
          ]
        },
        {
          "id" => "hp_103",
          "slug" => "future-drop",
          "title" => "Future Drop",
          "starts_at" => 3.months.from_now.iso8601,
          "status" => "published",
          "purchasable" => false,
          "ticket_types" => [
            { "name" => "Early Bird", "all_in_price_cents" => 1500, "quantity_remaining" => 100, "on_sale" => false }
          ]
        },
        {
          "id" => "hp_104",
          "slug" => "cancelled-hp",
          "title" => "Cancelled on HP",
          "status" => "cancelled",
          "purchasable" => false,
          "ticket_types" => []
        }
      ],
      "meta" => { "total_pages" => 1 }
    }

    with_stubbed_httparty(lambda { |url, opts|
      captured_requests << { url: url, opts: opts }
      stub_response.new(200, payload)
    }) do
      snapshot = Hafapass::EventsClient.refresh_snapshot!("co2017")
      assert snapshot.fresh?(300)
      assert_equal 4, snapshot.payload_json.length
      assert_equal 1, captured_requests.length
      assert_includes captured_requests.first[:url], "organizer=co2017"
      assert_includes captured_requests.first[:url], "include_sold_out=true"
      assert_nil captured_requests.first[:opts].dig(:headers, "Authorization")
      assert_not snapshot.payload_json.to_s.include?("acct_secret_do_not_leak")

      states = snapshot.payload_json.to_h { |e| [ e["id"], e["ticketState"] ] }
      assert_equal "on_sale", states["hp_101"]
      assert_equal "sold_out", states["hp_102"]
      assert_equal "upcoming", states["hp_103"]
      assert_equal "cancelled", states["hp_104"]
    end
  end

  test "matches by ID over renamed slug, dedupes matched events, enforces manual cancelled precedence, and isolates per-event /go/:code" do
    HafapassEventSnapshot.create!(
      organizer_slug: "co2017",
      fetched_at: 1.minute.ago,
      payload_json: [
        {
          "id" => "hp_101",
          "slug" => "renamed-slug-2027",
          "title" => "Two Pints",
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 2000,
          "ticketTypes" => [ { "name" => "GA", "allInPriceCents" => 2000, "quantityRemaining" => 40, "onSale" => true } ]
        },
        {
          "id" => "hp_102",
          "slug" => "cancelled-night",
          "title" => "Cancelled Night",
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 2500,
          "ticketTypes" => []
        },
        {
          "id" => "hp_999",
          "slug" => "unmatched-extra-event",
          "title" => "Unmatched HafaPass Event",
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 1500,
          "ticketTypes" => []
        }
      ]
    )

    get "/api/v1/public/host-year"
    assert_response :success
    body = JSON.parse(response.body)

    assert_equal true, body.dig("hafapass", "available")
    assert_equal false, body.dig("hafapass", "stale")
    assert_equal "https://hafapass.shimizu-technology.com/go/hub-all-2027", body.dig("hafapass", "allTicketsUrl")

    # Matched event enriched by ID even though slug changed, uses per-event /go/:code
    hub_events = body.fetch("events")
    matched = hub_events.find { |e| e["id"] == @matched_event.id.to_s }
    assert_equal "on_sale", matched.dig("hafapass", "ticketState")
    assert_equal 2000, matched.dig("hafapass", "minAllInPriceCents")
    assert_equal "https://hafapass.shimizu-technology.com/go/co2017-antigu", matched.dig("hafapass", "buyUrl")

    # Manual cancelled wins over HafaPass on_sale
    cancelled = hub_events.find { |e| e["id"] == @cancelled_hub_event.id.to_s }
    assert_equal "cancelled", cancelled.dig("hafapass", "ticketState")

    # Matched events deduped out of unmatched list; unmatched event uses /events/:slug (NOT campaign code!)
    unmatched = body.dig("hafapass", "events")
    assert_equal [ "hp_999" ], unmatched.map { |e| e["id"] }
    assert_equal "https://hafapass.shimizu-technology.com/events/unmatched-extra-event", unmatched.first["buyUrl"]
  end

  test "serves stale snapshot without blocking, redacts ticket counts, and enqueues only one refresh job under lease lock" do
    HafapassEventSnapshot.create!(
      organizer_slug: "co2017",
      fetched_at: 20.minutes.ago,
      payload_json: [
        {
          "id" => "hp_101",
          "slug" => "two-pints-2027",
          "title" => "Two Pints",
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 2000,
          "ticketTypes" => [ { "name" => "GA", "allInPriceCents" => 2000, "quantityRemaining" => 5, "onSale" => true } ]
        }
      ]
    )

    assert_enqueued_jobs 1, only: Hafapass::RefreshEventsJob do
      get "/api/v1/public/host-year"
      assert_response :success
      # Second immediate request does not pile up another job because lease is held
      get "/api/v1/public/host-year"
      assert_response :success
    end

    body = JSON.parse(response.body)
    assert_equal true, body.dig("hafapass", "available")
    assert_equal true, body.dig("hafapass", "stale")
    matched = body.fetch("events").find { |e| e["id"] == @matched_event.id.to_s }
    assert_nil matched.dig("hafapass", "minAllInPriceCents")
    assert_equal [], matched.dig("hafapass", "ticketTypes")
    assert_equal "Check availability on HåfaPass", matched.dig("hafapass", "availabilityLabel")
  end

  test "malformed upstream JSON or timeout preserves previous snapshot and never 500s" do
    existing = HafapassEventSnapshot.create!(
      organizer_slug: "co2017",
      fetched_at: 10.minutes.ago,
      payload_json: [ { "id" => "hp_101", "slug" => "kept", "title" => "Kept Event", "ticketState" => "on_sale" } ]
    )

    bad_response = Struct.new(:code, :parsed_response) do
      def success?
        true
      end
    end

    with_stubbed_httparty(->(_url, _opts) { bad_response.new(200, "not-a-hash-or-array") }) do
      Hafapass::EventsClient.refresh_snapshot!("co2017")
    end

    existing.reload
    assert_equal [ "hp_101" ], existing.payload_json.map { |e| e["id"] }
    assert_includes existing.last_error, "Unexpected HafaPass events response shape"
  end

  private

  def with_stubbed_httparty(callable)
    singleton = HTTParty.singleton_class
    original = singleton.instance_method(:get)
    singleton.define_method(:get) { |url, **opts| callable.call(url, opts) }
    yield
  ensure
    singleton.define_method(:get, original) if original
  end
end
