require "test_helper"

class PublicHostYearTest < ActionDispatch::IntegrationTest
  setup do
    @cohort_2017 = ClassCohort.create!(key: "17", graduation_year: 2017, display_name: "Class of 2017", short_label: "'17")
    @cohort_2018 = ClassCohort.create!(key: "18", graduation_year: 2018, display_name: "Class of 2018", short_label: "'18")
    @tournament_2027 = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2027,
      start_date: Date.new(2027, 6, 25),
      end_date: Date.new(2027, 7, 16),
      status: "upcoming"
    )
    @tournament_2028 = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2028,
      start_date: Date.new(2028, 6, 24),
      end_date: Date.new(2028, 7, 15),
      status: "upcoming"
    )
    @author = User.create!(
      email: "chair-private@example.com",
      clerk_id: "clerk_chair_public_test",
      first_name: "Kami",
      last_name: "Sablan",
      role: "viewer"
    )
    @campaign = HostCampaign.create!(
      tournament: @tournament_2027,
      class_cohort: @cohort_2017,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      tagline: "Road to 2027",
      status: "active",
      featured: true,
      goal_cents: 3_000_000,
      fdaa_upfront_cents: 1_500_000,
      fdaa_ticket_share_bps: 1600,
      public_meter_enabled: false,
      golf_url: "https://fd-golf.shimizu-technology.com"
    )
    @draft_campaign = HostCampaign.create!(
      tournament: @tournament_2028,
      class_cohort: @cohort_2018,
      slug: "2028-class-of-2018",
      title: "Class of 2018 Host Year",
      status: "draft",
      featured: false,
      goal_cents: 3_500_000
    )

    @public_event = @campaign.campaign_events.create!(
      kind: "fundraiser",
      title: "Antigu Host Night",
      starts_at: 2.weeks.from_now,
      venue: "Antigu Brewery",
      status: "open",
      public_visible: true,
      goal_cents: 500_000
    )
    @private_meeting = @campaign.campaign_events.create!(
      kind: "meeting",
      title: "Private Board Meeting",
      starts_at: 3.days.from_now,
      public_visible: false
    )
    @archived_event = @campaign.campaign_events.create!(
      kind: "fundraiser",
      title: "Cancelled Archived Idea",
      starts_at: 4.weeks.from_now,
      public_visible: true,
      archived_at: 1.day.ago
    )

    @published_post = @campaign.campaign_posts.create!(
      author: @author,
      title: "Thank you for coming out!",
      body: "Huge turnout from the brotherhood.",
      published_at: 1.hour.ago,
      pinned: true
    )
    @draft_post = @campaign.campaign_posts.create!(
      author: @author,
      title: "Internal Draft Recap",
      body: "Do not publish yet",
      published_at: nil
    )
    @scheduled_post = @campaign.campaign_posts.create!(
      author: @author,
      title: "Future Announcement",
      body: "Scheduled for tomorrow",
      published_at: 1.day.from_now
    )
  end

  test "returns featured campaign with strict financial and content privacy" do
    get "/api/v1/public/host-year"
    assert_response :success

    body = JSON.parse(response.body)
    campaign = body.fetch("campaign")
    assert_equal "2027-class-of-2017", campaign["slug"]
    assert_equal({ "enabled" => false }, campaign["meter"])
    assert_not campaign.key?("fdaaUpfrontCents")
    assert_not campaign.key?("fdaaTicketShareBps")
    assert_not campaign.key?("goalCents")

    events = body.fetch("events")
    assert_equal [ @public_event.id.to_s ], events.map { |e| e["id"] }
    assert_not events.first.key?("goalCents")

    posts = body.fetch("posts")
    assert_equal [ @published_post.id.to_s ], posts.map { |p| p["id"] }
    assert_equal "Kami Sablan", posts.first["authorName"]
    assert_not posts.first.to_s.include?("chair-private@example.com")
  end

  test "excludes draft campaigns even when requested explicitly by slug or year" do
    get "/api/v1/public/host-year", params: { slug: @draft_campaign.slug }
    assert_response :not_found

    get "/api/v1/public/host-year", params: { year: 2028 }
    assert_response :not_found
  end

  test "resolves campaign by slug and year and exposes meter only when enabled" do
    @campaign.update!(public_meter_enabled: true)

    get "/api/v1/public/host-year", params: { year: 2027 }
    assert_response :success
    meter = JSON.parse(response.body).dig("campaign", "meter")
    assert_equal true, meter["enabled"]
    assert_equal 3_000_000, meter["goalCents"]
    assert_equal 0, meter["raisedCents"]
    assert_equal 0.0, meter["percent"]
    assert_equal false, meter["goalReached"]

    get "/api/v1/public/host-year", params: { slug: "2027-class-of-2017" }
    assert_response :success
    assert_equal "2027-class-of-2017", JSON.parse(response.body).dig("campaign", "slug")
  end

  test "public home includes activeHostCampaign summary with same privacy rules" do
    get "/api/v1/public/home"
    assert_response :success

    body = JSON.parse(response.body)
    summary = body.fetch("activeHostCampaign")
    assert_equal "2027-class-of-2017", summary["slug"]
    assert_equal({ "enabled" => false }, summary["meter"])
    assert_equal @public_event.id.to_s, summary.dig("nextEvent", "id")
  end
end
