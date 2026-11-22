require "test_helper"

class SiteModeControllerTest < ActionDispatch::IntegrationTest
  ADMIN = "/api/v1/admin/site-mode"
  PUBLIC = "/api/v1/public"
  CAPABILITY = "site_mode_and_settings"

  setup do
    @admin = User.create!(email: "site-admin@example.org", role: "admin")
    @viewer = User.create!(email: "site-editor@example.org", role: "viewer")
    @season = create_season(2090, "upcoming")
    @past = create_season(2089, "completed")
  end

  test "draft games, teams, rosters and results stay private by id and year" do
    publish("fundraising", @season)
    assert_response :created

    [ {}, { tournamentId: @season.id }, { year: @season.year } ].each do |selection|
      assert_empty_scope(selection)
    end
    get "#{PUBLIC}/teams/#{@season.teams.first.id}"
    assert_response :not_found
    get "#{PUBLIC}/home"
    assert_response :success
    assert_empty json.fetch("todayGames")
    assert_empty json.fetch("predictionPolls")

    assert_visible @past
    publish("schedule_ready", @season, publishSchedule: true)
    assert_response :created
    assert_visible @season
  end

  test "the publication selects the public season and keeps campaign finances out of site context" do
    cohort = ClassCohort.find_or_create_by!(graduation_year: 2017) do |entry|
      entry.key = "17"
      entry.display_name = "Class of 2017"
      entry.short_label = "'17"
    end
    campaign = HostCampaign.create!(tournament: @season, class_cohort: cohort, slug: "class-of-2017", title: "Class of 2017 Host Year",
      status: "active", goal_cents: 100_000, public_meter_enabled: true)
    publish("tournament_recap", @past, hostCampaignId: campaign.id, handoffBannerEnabled: true, recapHeadline: "Alumni champions")
    assert_response :created

    %w[home schedule teams today sponsors tickets tournaments].each do |path|
      get "#{PUBLIC}/#{path}"
      assert_response :success
      tournament_key = path == "tournaments" ? "activeTournament" : "tournament"
      assert_equal @past.id.to_s, json.dig(tournament_key, "id"), path
    end

    get "#{PUBLIC}/site-mode"
    campaign_summary = json.dig("siteMode", "hostCampaign")
    assert_equal campaign.slug, campaign_summary.fetch("slug")
    refute campaign_summary.key?("meter")
    refute campaign_summary.key?("goalCents")
    assert_equal "Alumni champions", json.dig("siteMode", "recap", "headline")
    assert json.dig("siteMode", "recap", "handoffBannerEnabled")
    assert_equal campaign.id, AuditEvent.find_by!(record_type: "SitePublication", action: "create").host_campaign_id
  end

  test "active storm notices and historical records are independent of mode" do
    warning = @season.tournament_alerts.create!(severity: "urgent", title: "Storm warning", message: "Check road conditions", active: true)

    SitePublication::MODES.each do |mode|
      publish(mode, @past)
      assert_response :created
      get "#{PUBLIC}/site-mode"
      assert_equal mode, json.dig("siteMode", "mode")
      assert_includes json.fetch("alerts").pluck("id"), warning.id.to_s
      get "#{PUBLIC}/home"
      assert_equal mode, json.dig("siteMode", "mode")
      assert_includes json.fetch("alerts").pluck("id"), warning.id.to_s
      get "#{PUBLIC}/champions"
      assert_response :success
      get "#{PUBLIC}/tournaments/#{@past.year}"
      assert_response :success
    end
  end

  test "site-level view grants can preview without database writes and cannot publish or restore" do
    grant(@viewer, %w[view publish restore], scope: "tournament")
    get ADMIN, headers: headers_for(@viewer)
    assert_response :forbidden
    post "#{ADMIN}/publish", params: { mode: "fundraising" }, headers: headers_for(@viewer), as: :json
    assert_response :forbidden

    grant(@viewer, %w[view])
    get ADMIN, headers: headers_for(@viewer)
    assert_response :success
    assert_empty json.fetch("actions")

    assert_no_changes -> { [ SitePublication.count, AuditEvent.count, @season.reload.attributes, @viewer.reload.attributes ] } do
      post "#{ADMIN}/preview", params: { mode: "schedule_ready", tournamentId: @season.id, publishSchedule: true },
        headers: headers_for(@viewer), as: :json
      assert_response :success
      assert_equal "no-store", response.headers["Cache-Control"]
      assert json.dig("previewSiteMode", "isPreview")
      assert json.dig("previewSiteMode", "schedulePublished")
      assert_includes json.dig("changes", "appearing"), "schedule"
    end

    %w[publish restore].each do |action|
      post "#{ADMIN}/#{action}", params: { mode: "fundraising" }, headers: headers_for(@viewer), as: :json
      assert_response :forbidden
    end
  end

  test "publish is atomic and restore appends audited history with independent action grants" do
    grant(@viewer, %w[publish])
    publish("fundraising", @season, user: @viewer)
    assert_response :created
    first = SitePublication.current
    assert_equal 1, first.version_number
    assert_nil @season.reload.schedule_published_at

    publish("invalid", @season, user: @viewer, publishSchedule: true)
    assert_response :unprocessable_entity
    assert_equal first.id, SitePublication.current.id
    assert_nil @season.reload.schedule_published_at

    publish("schedule_ready", @season, user: @viewer, publishSchedule: true)
    assert_response :created
    assert_equal 2, SitePublication.current.version_number
    assert_equal 1, @season.reload.schedule_revision
    timestamp = @season.schedule_published_at
    assert_not_nil timestamp
    event = AuditEvent.find_by!(record_type: "SitePublication", record_id: SitePublication.current.id.to_s, action: "create")
    assert_equal "site_mode", event.area
    assert_equal "Site Mode v2 (schedule_ready)", event.record_label
    assert_equal @viewer.id, event.actor_id
    assert_equal @season.id, event.tournament_id

    post "#{ADMIN}/restore", params: { publicationId: first.id }, headers: headers_for(@viewer), as: :json
    assert_response :forbidden
    grant(@viewer, %w[restore])
    assert_difference("SitePublication.count", 1) do
      post "#{ADMIN}/restore", params: { publicationId: first.id }, headers: headers_for(@viewer), as: :json
      assert_response :created
    end
    assert_equal first.id, SitePublication.current.restored_from_id
    assert_equal 3, SitePublication.current.version_number
    assert_equal "fundraising", SitePublication.current.mode
    assert_equal timestamp, @season.reload.schedule_published_at
    assert_equal 1, @season.schedule_revision
  end

  private

  def create_season(year, status)
    season = Tournament.create!(name: "Alumni Tournament", year: year, status: status, start_date: Date.current, end_date: Date.current)
    division = season.divisions.create!(name: "Maroon", slug: "maroon", counts_for_standings: true)
    home = season.teams.create!(display_name: "Class of 2016", class_year_label: "2016", division_record: division)
    away = season.teams.create!(display_name: "Class of 2017", class_year_label: "2017", division_record: division)
    season.games.create!(home_team: home, away_team: away, start_time: Time.current, division_record: division, phase: "playoff", bracket_round: "final", bracket_slot: 1)
    season
  end

  def assert_empty_scope(selection)
    { schedule: %w[games teams], today: %w[games predictionPolls], standings: %w[standings divisionStandings], bracket: %w[divisions], teams: %w[teams] }.each do |path, collections|
      get "#{PUBLIC}/#{path}", params: selection
      assert_response :success
      collections.each { |collection| assert_empty json.fetch(collection) }
    end
  end

  def assert_visible(season)
    { schedule: "games", today: "games", standings: "divisionStandings", bracket: "divisions", teams: "teams" }.each do |path, collection|
      get "#{PUBLIC}/#{path}", params: { year: season.year }
      assert_response :success
      assert_not_empty json.fetch(collection)
    end
    get "#{PUBLIC}/teams/#{season.teams.first.id}"
    assert_response :success
  end

  def publish(mode, season, user: @admin, **settings)
    post "#{ADMIN}/publish", params: { mode: mode, tournamentId: season.id, **settings }, headers: headers_for(user), as: :json
  end

  def grant(user, actions, scope: "site")
    grant = user.permission_grants.find_or_initialize_by(capability: CAPABILITY, scope_type: scope)
    grant.update!(email: user.email, actions: actions, scope_id: (scope == "tournament" ? @season.id : nil))
  end

  def json
    response.parsed_body
  end

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
