require "test_helper"

class PublicSponsorsAndTicketsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = User.create!(email: "b13-admin@example.com", clerk_id: "clerk_b13_admin", role: "admin")
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament 2027",
      year: 2027,
      start_date: Date.new(2027, 6, 25),
      end_date: Date.new(2027, 7, 16),
      status: "upcoming"
    )
    @cohort = ClassCohort.find_or_create_by!(graduation_year: 2017) do |c|
      c.key = "17"
      c.display_name = "Class of 2017"
      c.short_label = "'17"
    end
    @campaign = HostCampaign.create!(
      tournament: @tournament,
      class_cohort: @cohort,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      status: "active",
      featured: true,
      goal_cents: 3_000_000,
      hafapass_organizer_slug: "fd-class-of-2017",
      hafapass_tournament_organizer_slug: "fdaa-guam",
      hafapass_distribution_code: "fd2027"
    )
  end

  test "public sponsors and today endpoints order sponsors strictly by canonical tier then position" do
    @tournament.sponsors.create!(name: "Community Co", tier: "community", position: 1, active: true)
    @tournament.sponsors.create!(name: "Silver Co", tier: "silver", position: 1, active: true)
    @tournament.sponsors.create!(name: "Gold Co", tier: "gold", position: 1, active: true)
    @tournament.sponsors.create!(name: "Platinum Co", tier: "platinum", position: 1, active: true)
    @tournament.sponsors.create!(name: "Diamond Co", tier: "diamond", position: 5, active: true, description: "Lead title partner", target_url: "https://diamond.example.com")
    @tournament.sponsors.create!(name: "Hidden Diamond", tier: "diamond", position: 0, active: false)

    get "/api/v1/public/sponsors", params: { year: 2027 }
    assert_response :success
    sponsors = JSON.parse(response.body).fetch("sponsors")

    assert_equal [ "Diamond Co", "Platinum Co", "Gold Co", "Silver Co", "Community Co" ], sponsors.map { |s| s["name"] }
    assert_equal "Diamond Sponsors", sponsors.first["tierLabel"]
    assert_equal "Lead title partner", sponsors.first["description"]
    assert_equal "https://diamond.example.com", sponsors.first["targetUrl"]

    get "/api/v1/public/today", params: { year: 2027 }
    assert_response :success
    today_sponsors = JSON.parse(response.body).fetch("sponsors")
    assert_equal [ "Diamond Co", "Platinum Co", "Gold Co", "Silver Co" ], today_sponsors.map { |s| s["name"] }
  end

  test "admin sponsor endpoints validate canonical tier and HTTPS URLs and persist description" do
    headers = { "Authorization" => "Bearer test_token_#{@admin.id}" }

    post "/api/v1/admin/sponsors",
      params: {
        sponsor: {
          tournamentId: @tournament.id,
          name: "Bad Tier Sponsor",
          tier: "ultra",
          targetUrl: "https://valid.example.com"
        }
      },
      headers: headers,
      as: :json
    assert_response :unprocessable_entity

    post "/api/v1/admin/sponsors",
      params: {
        sponsor: {
          tournamentId: @tournament.id,
          name: "Bad URL Sponsor",
          tier: "gold",
          targetUrl: "javascript:alert(1)"
        }
      },
      headers: headers,
      as: :json
    assert_response :unprocessable_entity

    post "/api/v1/admin/sponsors",
      params: {
        sponsor: {
          tournamentId: @tournament.id,
          name: "Valid Gold Partner",
          tier: "gold",
          description: "Supporting alumni basketball since 1995.",
          targetUrl: "https://gold.example.com"
        }
      },
      headers: headers,
      as: :json
    assert_response :created
    created = JSON.parse(response.body).fetch("sponsor")
    assert_equal "gold", created["tier"]
    assert_equal "Gold Sponsors", created["tierLabel"]
    assert_equal "Supporting alumni basketball since 1995.", created["description"]
  end

  test "public tickets filters FDAA events to tournament window, categorizes passes and game nights, and includes fundraisers" do
    HafapassEventSnapshot.create!(
      organizer_slug: "fdaa-guam",
      fetched_at: Time.current,
      payload_json: [
        {
          "id" => "hp_pass_2027",
          "slug" => "fd-2027-all-tournament-pass",
          "title" => "FD 2027 All-Tournament Pass",
          "startsAt" => "2027-06-25T08:00:00Z",
          "venueName" => "FD Phoenix Center",
          "organizerSlug" => "fdaa-guam",
          "isPass" => true,
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 4500,
          "ticketTypes" => [ { "name" => "All Access", "allInPriceCents" => 4500, "quantityRemaining" => 80, "onSale" => true } ]
        },
        {
          "id" => "hp_night_1",
          "slug" => "fd-2027-opening-night",
          "title" => "Opening Night — June 25",
          "startsAt" => "2027-06-25T08:00:00Z",
          "venueName" => "FD Phoenix Center",
          "organizerSlug" => "fdaa-guam",
          "isPass" => false,
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 1000,
          "ticketTypes" => []
        },
        {
          "id" => "hp_team_reg",
          "slug" => "fd-2027-team-registration",
          "title" => "2027 Team Registration",
          "startsAt" => "2027-05-01T08:00:00Z",
          "venueName" => "Online",
          "organizerSlug" => "fdaa-guam",
          "isPass" => false,
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 50000,
          "ticketTypes" => []
        },
        {
          "id" => "hp_old_2025",
          "slug" => "fd-2025-championship-night",
          "title" => "2025 Championship Night",
          "startsAt" => "2025-07-18T08:00:00Z",
          "venueName" => "FD Phoenix Center",
          "organizerSlug" => "fdaa-guam",
          "isPass" => false,
          "ticketState" => "sales_ended",
          "minAllInPriceCents" => 1000,
          "ticketTypes" => []
        },
        {
          "id" => "hp_old_no_date",
          "slug" => "fd2025-season-pass",
          "title" => "FD2025 Season Pass",
          "startsAt" => nil,
          "organizerSlug" => "fdaa-guam",
          "isPass" => true,
          "ticketState" => "sales_ended",
          "minAllInPriceCents" => 4000,
          "ticketTypes" => []
        }
      ]
    )

    HafapassEventSnapshot.create!(
      organizer_slug: "fd-class-of-2017",
      fetched_at: Time.current,
      payload_json: [
        {
          "id" => "hp_golf_2017",
          "slug" => "co2017-golf-fundraiser",
          "title" => "Class of 2017 Golf Fundraiser",
          "startsAt" => "2027-04-10T00:00:00Z",
          "venueName" => "Starts Guam Golf Resort",
          "organizerSlug" => "fd-class-of-2017",
          "isPass" => false,
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 15000,
          "ticketTypes" => []
        }
      ]
    )

    @campaign.campaign_events.create!(
      kind: "golf",
      title: "CO2017 Golf Tournament",
      status: "open",
      public_visible: true,
      hafapass_event_id: "hp_golf_2017",
      position: 1
    )

    get "/api/v1/public/tickets"
    assert_response :success
    body = JSON.parse(response.body)

    assert_equal "2027-class-of-2017", body.dig("campaign", "slug")
    assert_equal true, body.dig("hafapass", "available")
    assert_equal false, body.dig("hafapass", "stale")
    assert_equal [ "hp_pass_2027" ], body.fetch("passes").map { |e| e["id"] }
    assert_equal [ "hp_night_1" ], body.fetch("gameNights").map { |e| e["id"] }
    assert_equal [ "hp_team_reg" ], body.fetch("otherEvents").map { |e| e["id"] }
    assert_equal [ "CO2017 Golf Tournament" ], body.fetch("fundraiserEvents").map { |e| e["title"] }
    assert_equal 15000, body.fetch("fundraiserEvents").first["minAllInPriceCents"]
    assert_includes body.dig("doorInfo", "venue"), "The Jungle"
  end

  test "public tickets never exposes draft campaigns and clears stale prices" do
    t_draft = Tournament.create!(
      name: "FD Alumni 2028",
      year: 2028,
      start_date: Date.new(2028, 6, 23),
      end_date: Date.new(2028, 7, 14),
      status: "upcoming"
    )
    cohort_18 = ClassCohort.find_or_create_by!(graduation_year: 2018) do |c|
      c.key = "18"
      c.display_name = "Class of 2018"
      c.short_label = "'18"
    end
    HostCampaign.create!(
      tournament: t_draft,
      class_cohort: cohort_18,
      slug: "2028-class-of-2018",
      title: "Secret Draft 2028",
      status: "draft",
      featured: false,
      goal_cents: 3_000_000
    )

    get "/api/v1/public/tickets", params: { campaignSlug: "2028-class-of-2018" }
    assert_response :not_found

    HafapassEventSnapshot.create!(
      organizer_slug: "fdaa-guam",
      fetched_at: 2.hours.ago,
      payload_json: [
        {
          "id" => "hp_stale_pass",
          "slug" => "fd-2027-stale-pass",
          "title" => "FD 2027 Pass",
          "startsAt" => "2027-06-25T08:00:00Z",
          "organizerSlug" => "fdaa-guam",
          "isPass" => true,
          "ticketState" => "on_sale",
          "minAllInPriceCents" => 4500,
          "ticketTypes" => [ { "name" => "GA", "allInPriceCents" => 4500, "quantityRemaining" => 5, "onSale" => true } ]
        }
      ]
    )

    get "/api/v1/public/tickets"
    assert_response :success
    body = JSON.parse(response.body)

    assert_equal true, body.dig("hafapass", "stale")
    pass = body.fetch("passes").first
    assert_equal true, pass["stale"]
    assert_nil pass["ticketState"]
    assert_nil pass["minAllInPriceCents"]
    assert_equal [], pass["ticketTypes"]
  end

  test "public tickets does not leak out-of-window events into fundraiserEvents when host and tournament organizer slugs match" do
    @campaign.update!(hafapass_organizer_slug: "fdaa-guam", hafapass_tournament_organizer_slug: "fdaa-guam")
    HafapassEventSnapshot.create!(
      organizer_slug: "fdaa-guam",
      fetched_at: Time.current,
      payload_json: [
        {
          "id" => "hp_old_shared",
          "slug" => "fd2025-old-night",
          "title" => "FD2025 Old Night",
          "startsAt" => "2025-07-01T08:00:00Z",
          "organizerSlug" => "fdaa-guam",
          "isPass" => false,
          "ticketState" => "sales_ended",
          "minAllInPriceCents" => 1000,
          "ticketTypes" => []
        }
      ]
    )

    get "/api/v1/public/tickets"
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [], body.fetch("gameNights")
    assert_equal [], body.fetch("fundraiserEvents")
  end
end
