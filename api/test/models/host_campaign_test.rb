require "test_helper"

class HostCampaignTest < ActiveSupport::TestCase
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
    @admin = User.create!(email: "campaign-admin@example.com", clerk_id: "clerk_campaign_admin", role: "admin")
  end

  test "enforces https URLs, slug/code formats, positive goal_cents, and privacy-by-default meter" do
    campaign = HostCampaign.new(
      tournament: @tournament_2027,
      class_cohort: @cohort_2017,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      goal_cents: 3_000_000
    )
    assert campaign.valid?
    assert_equal "draft", campaign.status
    assert_equal false, campaign.public_meter_enabled
    assert_equal false, campaign.featured

    campaign.donation_url = "javascript:alert(1)"
    assert_not campaign.valid?
    assert_includes campaign.errors[:donation_url], "must be a valid https:// URL"

    campaign.donation_url = "http://insecure.example.com/donate"
    assert_not campaign.valid?

    campaign.donation_url = "https://give.fdaa.org@evil.example.com/donate"
    assert_not campaign.valid?

    campaign.donation_url = "https://give.example.com/co2017"
    campaign.golf_url = "https://fd-golf.shimizu-technology.com"
    campaign.hafapass_organizer_slug = "co2017"
    assert campaign.valid?

    campaign.slug = "---"
    assert_not campaign.valid?
    campaign.slug = "2027-class-of-2017"

    campaign.hafapass_organizer_slug = "bad slug/.."
    assert_not campaign.valid?
    campaign.hafapass_organizer_slug = "co2017"

    campaign.goal_cents = 0
    assert_not campaign.valid?
  end

  test "rejects javascript and http URLs on campaign events and posts" do
    campaign = HostCampaign.create!(
      tournament: @tournament_2027,
      class_cohort: @cohort_2017,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      goal_cents: 3_000_000
    )

    bad_event = campaign.campaign_events.build(title: "Fundraiser", external_url: "javascript:alert(1)", image_url: "http://example.com/img.png")
    assert_not bad_event.valid?
    assert_includes bad_event.errors[:external_url], "must be a valid https:// URL"
    assert_includes bad_event.errors[:image_url], "must be a valid https:// URL"

    bad_post = campaign.campaign_posts.build(title: "Recap", body: "Hello", image_url: "javascript:void(0)")
    assert_not bad_post.valid?
    assert_includes bad_post.errors[:image_url], "must be a valid https:// URL"
  end

  test "enforces optional DONATION_URL_ALLOWED_HOSTS allowlist" do
    previous = ENV["DONATION_URL_ALLOWED_HOSTS"]
    ENV["DONATION_URL_ALLOWED_HOSTS"] = "give.fdaa.org, donate.shimizu-technology.com"

    campaign = HostCampaign.new(
      tournament: @tournament_2027,
      class_cohort: @cohort_2017,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      goal_cents: 3_000_000,
      donation_url: "https://evil.example.com/pay"
    )
    assert_not campaign.valid?
    assert campaign.errors[:donation_url].any?

    campaign.donation_url = "https://give.fdaa.org/co2017"
    assert campaign.valid?
  ensure
    if previous.nil?
      ENV.delete("DONATION_URL_ALLOWED_HOSTS")
    else
      ENV["DONATION_URL_ALLOWED_HOSTS"] = previous
    end
  end

  test "enforces featured status rules and single featured campaign at DB level" do
    draft_campaign = HostCampaign.new(
      tournament: @tournament_2027,
      class_cohort: @cohort_2017,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      status: "draft",
      featured: true,
      goal_cents: 3_000_000
    )
    assert_not draft_campaign.valid?

    c2027 = HostCampaign.create!(
      tournament: @tournament_2027,
      class_cohort: @cohort_2017,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      status: "closing",
      featured: true,
      goal_cents: 3_000_000
    )
    assert c2027.finance_writable?

    second_featured = HostCampaign.new(
      tournament: @tournament_2028,
      class_cohort: @cohort_2018,
      slug: "2028-class-of-2018",
      title: "Class of 2018 Host Year",
      status: "active",
      featured: true,
      goal_cents: 3_500_000
    )
    assert_not second_featured.valid?
    assert_includes second_featured.errors[:featured], "another campaign is already featured"

    assert_raises(ActiveRecord::RecordNotUnique) do
      ActiveRecord::Base.transaction(requires_new: true) do
        second_featured.save!(validate: false)
      end
    end

    # Rollover works smoothly when only the new campaign is featured while prior stays closing
    c2027.update!(featured: false)
    c2028 = HostCampaign.create!(
      tournament: @tournament_2028,
      class_cohort: @cohort_2018,
      slug: "2028-class-of-2018",
      title: "Class of 2018 Host Year",
      status: "active",
      featured: true,
      goal_cents: 3_500_000
    )
    assert_equal c2028, HostCampaign.resolve_public
    assert c2027.finance_writable?
  end

  test "prevents cascade deletion across tournament -> campaign -> events/audit and enforces append-only audit model" do
    campaign = HostCampaign.create!(
      tournament: @tournament_2027,
      class_cohort: @cohort_2017,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      status: "active",
      featured: true,
      goal_cents: 3_000_000
    )
    event = campaign.campaign_events.create!(
      kind: "fundraiser",
      title: "Two Pints, One Purpose",
      external_url: "https://hafapass.shimizu-technology.com/events/two-pints"
    )
    audit = FinanceAuditEvent.record!(
      campaign: campaign,
      actor: @admin,
      record: campaign,
      action: "create",
      changes: { "status" => [ nil, "active" ] }
    )

    assert_not @tournament_2027.destroy
    assert_not campaign.destroy

    assert_raises(ActiveRecord::InvalidForeignKey) do
      ActiveRecord::Base.transaction(requires_new: true) do
        ActiveRecord::Base.connection.execute("DELETE FROM tournaments WHERE id = #{@tournament_2027.id}")
      end
    end
    assert_raises(ActiveRecord::InvalidForeignKey) do
      ActiveRecord::Base.transaction(requires_new: true) do
        ActiveRecord::Base.connection.execute("DELETE FROM host_campaigns WHERE id = #{campaign.id}")
      end
    end
    assert_raises(ActiveRecord::ReadOnlyRecord) { audit.update!(action: "tampered") }
    assert_raises(ActiveRecord::ReadOnlyRecord) { audit.destroy }

    assert CampaignEvent.exists?(event.id)
    assert FinanceAuditEvent.exists?(audit.id)
  end

  test "Tournament.active_for_public is not hijacked by an empty future placeholder tournament" do
    completed_2026 = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 6, 26),
      end_date: Date.new(2026, 7, 18),
      status: "completed"
    )
    team_a = completed_2026.teams.create!(class_year_label: "2025", display_name: "Class of 2025")
    team_b = completed_2026.teams.create!(class_year_label: "2013", display_name: "Class of 2013")
    completed_2026.games.create!(
      home_team: team_a,
      away_team: team_b,
      start_time: Time.zone.local(2026, 7, 18, 19, 0),
      status: "final",
      home_score: 61,
      away_score: 49
    )

    assert_equal completed_2026, Tournament.active_for_public
    assert_equal @tournament_2027, Tournament.home_context[:upcoming_or_live]
  end
end
