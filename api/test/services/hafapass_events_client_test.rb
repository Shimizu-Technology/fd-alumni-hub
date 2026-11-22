require "test_helper"
require "openssl"

class HafapassEventsClientTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  StubResponse = Struct.new(:code, :parsed_response, :body) do
    def success?
      code.to_i >= 200 && code.to_i < 300
    end
  end

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

  test "fetch_remote sends exact public headers, timeouts, follow_redirects: false, normalizes states, and drops foreign organizers" do
    captured_requests = []

    payload = {
      "events" => [
        {
          "id" => "hp_101",
          "slug" => "two-pints-2027",
          "organizer_slug" => "co2017",
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
          "organizer" => { "slug" => "co2017" },
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
          "organizerSlug" => "co2017",
          "title" => "Future Drop",
          "starts_at" => 3.months.from_now.iso8601,
          "status" => "published",
          "purchasable" => false,
          "ticket_types" => [
            { "name" => "Early Bird", "all_in_price_cents" => 1500, "quantity_remaining" => 100, "on_sale" => true }
          ]
        },
        {
          "id" => "hp_104",
          "slug" => "cancelled-hp",
          "organizer_slug" => "co2017",
          "title" => "Cancelled on HP",
          "status" => "canceled",
          "purchasable" => false,
          "ticket_types" => []
        },
        {
          "id" => "hp_105",
          "slug" => "past-event",
          "organizer_slug" => "co2017",
          "title" => "Past Gala",
          "starts_at" => 2.days.ago.iso8601,
          "status" => "published",
          "purchasable" => false,
          "ticket_types" => [
            { "name" => "GA", "all_in_price_cents" => 3000, "quantity_remaining" => 15, "on_sale" => false }
          ]
        },
        {
          "id" => "hp_106",
          "slug" => "unlimited-no-purchasable-key",
          "organizer_slug" => "co2017",
          "title" => "Unlimited Open Event",
          "starts_at" => 1.month.from_now.iso8601,
          "status" => "published",
          "ticket_types" => [
            { "name" => "Unlimited GA", "all_in_price_cents" => 1000, "quantity_remaining" => nil, "on_sale" => true }
          ]
        },
        {
          "id" => "hp_107",
          "slug" => "mismatched-stock-on-sale",
          "organizer_slug" => "co2017",
          "title" => "Mismatched Types",
          "starts_at" => 1.day.ago.iso8601,
          "status" => "published",
          "ticket_types" => [
            { "name" => "Sold Out OnSale", "all_in_price_cents" => 1000, "quantity_remaining" => 0, "on_sale" => true },
            { "name" => "Paused With Stock", "all_in_price_cents" => 2000, "quantity_remaining" => 50, "on_sale" => false }
          ]
        },
        {
          "id" => "hp_foreign",
          "slug" => "other-organizer-event",
          "organizer_slug" => "other-org",
          "title" => "Foreign Organizer Event",
          "status" => "published",
          "purchasable" => true
        },
        {
          "id" => "hp_no_org",
          "slug" => "missing-organizer-event",
          "title" => "Missing Organizer Event",
          "status" => "published",
          "purchasable" => true
        }
      ],
      "meta" => { "total_pages" => 1 }
    }

    stub_http = lambda do |url, **opts|
      captured_requests << { url: url, opts: opts }
      StubResponse.new(200, payload, "{}")
    end

    snapshot = Hafapass::EventsClient.refresh_snapshot!("co2017", http_get: stub_http)
    assert snapshot.fresh?(300)
    assert_equal 7, snapshot.payload_json.length
    assert_equal 1, captured_requests.length

    req = captured_requests.first
    assert_includes req[:url], "organizer=co2017"
    assert_includes req[:url], "include_sold_out=true"
    assert_equal({ "Accept" => "application/json" }, req[:opts][:headers])
    assert_equal 2, req[:opts][:open_timeout]
    assert_equal 3, req[:opts][:read_timeout]
    assert_equal false, req[:opts][:follow_redirects]
    assert_not snapshot.payload_json.to_s.include?("acct_secret_do_not_leak")

    states = snapshot.payload_json.to_h { |e| [ e["id"], e["ticketState"] ] }
    assert_equal "on_sale", states["hp_101"]
    assert_equal "sold_out", states["hp_102"]
    assert_equal "upcoming", states["hp_103"] # purchasable: false overrides ticket_type on_sale: true
    assert_equal "cancelled", states["hp_104"] # American spelling "canceled"
    assert_equal "sales_ended", states["hp_105"]
    assert_equal "on_sale", states["hp_106"] # nil quantity_remaining treated as unlimited when onSale: true
    assert_equal "sales_ended", states["hp_107"] # stock on non-onSale type does not mark on_sale
    assert_nil states["hp_foreign"]
    assert_nil states["hp_no_org"]
  end

  test "pagination follows total_pages, caps at 3 pages, and stops early on short pages" do
    requested_pages = []
    full_page = ->(page_num) do
      events = (1..50).map do |i|
        {
          "id" => "hp_p#{page_num}_#{i}",
          "slug" => "evt-#{page_num}-#{i}",
          "organizer_slug" => "co2017",
          "title" => "Event #{page_num}-#{i}",
          "status" => "published",
          "purchasable" => true
        }
      end
      StubResponse.new(200, { "events" => events, "meta" => { "total_pages" => 5 } }, "{}")
    end

    events = Hafapass::EventsClient.fetch_remote("co2017", http_get: lambda { |url, **_opts|
      page = URI.decode_www_form(URI.parse(url).query).to_h["page"].to_i
      requested_pages << page
      full_page.call(page)
    })
    assert_equal [ 1, 2, 3 ], requested_pages
    assert_equal 150, events.length

    short_pages = []
    short_events = Hafapass::EventsClient.fetch_remote("co2017", http_get: lambda { |url, **_opts|
      page = URI.decode_www_form(URI.parse(url).query).to_h["page"].to_i
      short_pages << page
      StubResponse.new(
        200,
        {
          "events" => [
            { "id" => "hp_short_1", "slug" => "short-1", "organizer_slug" => "co2017", "title" => "Short 1", "purchasable" => true }
          ],
          "meta" => { "total_pages" => 3 }
        },
        "{}"
      )
    })
    assert_equal [ 1 ], short_pages
    assert_equal 1, short_events.length
  end

  test "coerces malformed prices/remaining safely without crashing or turning strings into $0" do
    payload = {
      "events" => [
        {
          "id" => "hp_weird",
          "slug" => "weird-types",
          "organizer_slug" => "co2017",
          "title" => "A" * 250,
          "short_description" => "B" * 600,
          "starts_at" => "not-a-date",
          "status" => "published",
          "purchasable" => true,
          "ticket_types" => [
            { "name" => "Bad String", "all_in_price_cents" => "abc", "quantity_remaining" => { "nested" => 1 }, "on_sale" => true },
            { "name" => "Negative", "all_in_price_cents" => -500, "quantity_remaining" => -3, "on_sale" => true },
            { "name" => "Valid", "all_in_price_cents" => "2500", "quantity_remaining" => "10", "on_sale" => true }
          ]
        }
      ],
      "meta" => { "total_pages" => { "unexpected" => "hash" } }
    }

    snapshot = Hafapass::EventsClient.refresh_snapshot!("co2017", http_get: ->(_u, **_o) { StubResponse.new(200, payload, "{}") })
    assert_nil snapshot.last_error
    event = snapshot.payload_json.first
    assert_equal 180, event["title"].length
    assert_equal 500, event["shortDescription"].length
    assert_nil event["startsAt"]
    assert_equal 2500, event["minAllInPriceCents"]
    assert_nil event["ticketTypes"][0]["allInPriceCents"]
    assert_nil event["ticketTypes"][0]["quantityRemaining"]
    assert_nil event["ticketTypes"][1]["allInPriceCents"]
    assert_nil event["ticketTypes"][1]["quantityRemaining"]
  end

  test "matches by ID without wrong slug fallback, dedupes matched events, enforces manual cancelled, and isolates /go/:code" do
    @unmatched_id_event = @campaign.campaign_events.create!(
      kind: "fundraiser",
      title: "ID Set But Missing",
      starts_at: 4.weeks.from_now,
      status: "open",
      hafapass_event_id: "hp_missing",
      hafapass_event_slug: "unmatched-extra-event"
    )

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

    hub_events = body.fetch("events")
    matched = hub_events.find { |e| e["id"] == @matched_event.id.to_s }
    assert_equal "on_sale", matched.dig("hafapass", "ticketState")
    assert_equal 2000, matched.dig("hafapass", "minAllInPriceCents")
    assert_equal "https://hafapass.shimizu-technology.com/go/co2017-antigu", matched.dig("hafapass", "buyUrl")

    cancelled = hub_events.find { |e| e["id"] == @cancelled_hub_event.id.to_s }
    assert_equal "cancelled", cancelled.dig("hafapass", "ticketState")

    # Event with explicit hafapass_event_id set does NOT falsely match a reused slug
    id_missing = hub_events.find { |e| e["id"] == @unmatched_id_event.id.to_s }
    assert_nil id_missing["hafapass"]

    unmatched = body.dig("hafapass", "events")
    assert_equal [ "hp_999" ], unmatched.map { |e| e["id"] }
    assert_equal "https://hafapass.shimizu-technology.com/events/unmatched-extra-event", unmatched.first["buyUrl"]
  end

  test "first boot with no snapshot returns available false and enqueues exactly one refresh job" do
    assert_enqueued_jobs 1, only: Hafapass::RefreshEventsJob do
      get "/api/v1/public/host-year"
      assert_response :success
      get "/api/v1/public/host-year"
      assert_response :success
    end

    body = JSON.parse(response.body)
    assert_equal false, body.dig("hafapass", "available")
    assert_equal false, body.dig("hafapass", "stale")
    assert_equal [], body.dig("hafapass", "events")
  end

  test "serves stale snapshot without blocking, redacts ticket counts and non-cancelled ticketState, and respects per-snapshot staleness" do
    @campaign.update!(hafapass_tournament_organizer_slug: "fdaa")

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
        },
        {
          "id" => "hp_102",
          "slug" => "cancelled-night",
          "title" => "Cancelled Night",
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 2500,
          "ticketTypes" => []
        }
      ]
    )
    HafapassEventSnapshot.create!(
      organizer_slug: "fdaa",
      fetched_at: 1.minute.ago,
      payload_json: [
        {
          "id" => "hp_fdaa_1",
          "slug" => "all-session-pass",
          "title" => "All-Session Pass",
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 4500,
          "ticketTypes" => [ { "name" => "Pass", "allInPriceCents" => 4500, "quantityRemaining" => 20, "onSale" => true } ]
        }
      ]
    )

    assert_enqueued_jobs 1, only: Hafapass::RefreshEventsJob do
      get "/api/v1/public/host-year"
      assert_response :success
      get "/api/v1/public/host-year"
      assert_response :success
    end

    body = JSON.parse(response.body)
    assert_equal true, body.dig("hafapass", "available")
    assert_equal true, body.dig("hafapass", "stale")

    # Stale co2017 event redacts prices, ticketTypes, and non-cancelled ticketState
    matched = body.fetch("events").find { |e| e["id"] == @matched_event.id.to_s }
    assert_nil matched.dig("hafapass", "ticketState")
    assert_nil matched.dig("hafapass", "minAllInPriceCents")
    assert_equal [], matched.dig("hafapass", "ticketTypes")
    assert_equal "Check availability on HåfaPass", matched.dig("hafapass", "availabilityLabel")

    # Manual cancelled stays cancelled even when stale
    cancelled = body.fetch("events").find { |e| e["id"] == @cancelled_hub_event.id.to_s }
    assert_equal "cancelled", cancelled.dig("hafapass", "ticketState")

    # Fresh fdaa organizer keeps live price and badge despite co2017 being stale
    fdaa_event = body.dig("hafapass", "events").find { |e| e["id"] == "hp_fdaa_1" }
    assert_equal "on_sale", fdaa_event["ticketState"]
    assert_equal 4500, fdaa_event["minAllInPriceCents"]
    assert_nil fdaa_event["availabilityLabel"]
  end

  test "expired lease can be re-acquired, and HTTP 500 / Timeout / JSON / SSL / oversized body release lease and preserve snapshot" do
    existing = HafapassEventSnapshot.create!(
      organizer_slug: "co2017",
      fetched_at: 10.minutes.ago,
      refreshing_until: 5.seconds.ago,
      payload_json: [ { "id" => "hp_101", "slug" => "kept", "title" => "Kept Event", "ticketState" => "on_sale" } ]
    )

    assert existing.acquire_refresh_lease!, "Expired lease should be re-acquirable"
    assert_not existing.acquire_refresh_lease!, "Active lease should block concurrent acquirers"

    failure_cases = [
      [ "HTTP 500", ->(_u, **_o) { StubResponse.new(500, { "error" => "boom" }, "boom") } ],
      [ "Timeout::Error", ->(_u, **_o) { raise Timeout::Error, "timed out" } ],
      [ "JSON::ParserError", ->(_u, **_o) { raise JSON::ParserError, "unexpected token" } ],
      [ "OpenSSL::SSL::SSLError", ->(_u, **_o) { raise OpenSSL::SSL::SSLError, "cert verify failed" } ],
      [ "size limit", ->(_u, **_o) { StubResponse.new(200, { "events" => [] }, "x" * (Hafapass::EventsClient::MAX_RESPONSE_BYTES + 1)) } ],
      [ "Unexpected HafaPass events response shape", ->(_u, **_o) { StubResponse.new(200, "not-a-hash-or-array", "\"bad\"") } ]
    ]

    failure_cases.each do |expected_substring, stub|
      existing.update!(refreshing_until: 1.minute.from_now)
      Hafapass::EventsClient.refresh_snapshot!("co2017", http_get: stub)
      existing.reload
      assert_nil existing.refreshing_until, "Lease must be released after #{expected_substring}"
      assert_equal [ "hp_101" ], existing.payload_json.map { |e| e["id"] }
      assert_includes existing.last_error, expected_substring
      assert existing.last_error_at.present?
    end
  end

  test "public host-year endpoint never 500s if Hafapass::EventsClient raises an unexpected error" do
    singleton = Hafapass::EventsClient.singleton_class
    original = singleton.instance_method(:for_campaign)
    singleton.define_method(:for_campaign) { |*_args, **_kwargs| raise ActiveRecord::ConnectionTimeoutError, "pool exhausted" }

    begin
      get "/api/v1/public/host-year"
      assert_response :success
      body = JSON.parse(response.body)
      assert_equal "Class of 2017 Host Year", body.dig("campaign", "title")
      assert_equal false, body.dig("hafapass", "available")
      assert_equal "https://hafapass.shimizu-technology.com/go/hub-all-2027", body.dig("hafapass", "allTicketsUrl")
      assert_equal 2, body.fetch("events").length
    ensure
      singleton.define_method(:for_campaign, original)
    end
  end
end
