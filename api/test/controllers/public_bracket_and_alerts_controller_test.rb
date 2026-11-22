require "test_helper"

class PublicBracketAndAlertsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @staff = User.create!(email: "b21-staff@example.com", clerk_id: "clerk_b21_staff", role: "staff")
    @viewer = User.create!(email: "b21-viewer@example.com", clerk_id: "clerk_b21_viewer", role: "viewer")

    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament 2027",
      year: 2027,
      start_date: Date.new(2027, 6, 25),
      end_date: Date.new(2027, 7, 16),
      status: "live"
    )
    @other_tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament 2026",
      year: 2026,
      start_date: Date.new(2026, 6, 26),
      end_date: Date.new(2026, 7, 17),
      status: "completed"
    )

    @maroon = @tournament.divisions.create!(name: "Maroon", position: 1)
    @gold = @tournament.divisions.create!(name: "Gold", position: 2)
    @team_17 = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: @maroon)
    @team_18 = @tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018", division_record: @maroon)
    @placeholder_1 = @tournament.teams.create!(class_year_label: "WMQF1", display_name: "Winner MQF1", division_record: @maroon)
    @placeholder_2 = @tournament.teams.create!(class_year_label: "WMQF2", display_name: "Winner MQF2", division_record: @maroon)

    @sf = @tournament.games.create!(
      home_team: @placeholder_1,
      away_team: @placeholder_2,
      division_record: @maroon,
      phase: "playoff",
      bracket_round: "semifinal",
      bracket_slot: 1,
      start_time: Time.zone.local(2027, 7, 14, 19, 0),
      status: "scheduled",
      placeholder: true
    )
    @qf = @tournament.games.create!(
      home_team: @team_17,
      away_team: @team_18,
      division_record: @maroon,
      phase: "playoff",
      bracket_round: "quarterfinal",
      bracket_slot: 1,
      next_game: @sf,
      next_game_slot: "home",
      start_time: Time.zone.local(2027, 7, 12, 19, 0),
      status: "scheduled"
    )
    @pool_game = @tournament.games.create!(
      home_team: @team_17,
      away_team: @team_18,
      division_record: @maroon,
      phase: "pool",
      start_time: Time.zone.now.change(min: 0),
      status: "delayed",
      status_note: "Typhoon watch: tip-off delayed 45 minutes"
    )
  end

  test "public bracket groups playoff games by division and canonical round order and excludes pool games" do
    get "/api/v1/public/bracket", params: { year: 2027 }
    assert_response :success
    body = JSON.parse(response.body)

    assert_equal 1, body.fetch("divisions").length
    maroon_group = body.fetch("divisions").first
    assert_equal "Maroon", maroon_group.dig("division", "name")
    assert_equal %w[quarterfinal semifinal], maroon_group.fetch("rounds").map { |r| r["round"] }
    assert_equal [ @qf.id.to_s ], maroon_group.fetch("rounds").first.fetch("games").map { |g| g["id"] }
    assert_equal [ @sf.id.to_s ], maroon_group.fetch("rounds").last.fetch("games").map { |g| g["id"] }
  end

  test "admin game finalization automatically advances playoff winner into next game" do
    patch "/api/v1/admin/games/#{@qf.id}",
      params: { game: { status: "final", homeScore: 81, awayScore: 73, lockVersion: @qf.lock_version } },
      headers: headers_for(@staff),
      as: :json
    assert_response :success
    body = JSON.parse(response.body)

    assert_equal true, body.dig("bracketAdvancement", "advanced")
    assert_equal @sf.id.to_s, body.dig("bracketAdvancement", "nextGameId")
    assert_equal @team_17.id.to_s, @sf.reload.home_team_id.to_s
  end

  test "public alerts scopes strictly to site-wide and current tournament, active window, and urgent->warning->info order" do
    info = TournamentAlert.create!(tournament: @tournament, severity: "info", title: "Doors open", message: "Gym doors open at 5pm", active: true)
    urgent = TournamentAlert.create!(tournament: nil, severity: "urgent", title: "Typhoon delay", message: "All games delayed 1 hour", active: true)
    warning = TournamentAlert.create!(tournament: @tournament, severity: "warning", title: "Parking full", message: "Use overflow lot", active: true)
    TournamentAlert.create!(tournament: @other_tournament, severity: "urgent", title: "Old 2026 alert", message: "Should not leak", active: true)
    TournamentAlert.create!(tournament: @tournament, severity: "urgent", title: "Inactive alert", message: "Hidden", active: false)
    TournamentAlert.create!(tournament: @tournament, severity: "urgent", title: "Expired alert", message: "Past", active: true, expires_at: 10.minutes.ago)
    TournamentAlert.create!(tournament: @tournament, severity: "urgent", title: "Future alert", message: "Not yet", active: true, starts_at: 2.hours.from_now)

    get "/api/v1/public/alerts", params: { year: 2027 }
    assert_response :success
    alerts = JSON.parse(response.body).fetch("alerts")
    assert_equal [ urgent.id.to_s, warning.id.to_s, info.id.to_s ], alerts.map { |a| a["id"] }

    cohort = ClassCohort.find_or_create_by!(graduation_year: 2017) do |c|
      c.key = "17"
      c.display_name = "Class of 2017"
      c.short_label = "'17"
    end
    HostCampaign.create!(
      tournament: @tournament,
      class_cohort: cohort,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      status: "active",
      featured: true,
      goal_cents: 3_000_000,
      hafapass_distribution_code: "fd2027"
    )

    get "/api/v1/public/today", params: { year: 2027 }
    assert_response :success
    today_body = JSON.parse(response.body)
    assert_equal [ urgent.id.to_s, warning.id.to_s, info.id.to_s ], today_body.fetch("alerts").map { |a| a["id"] }
    assert_includes today_body.fetch("fallbackTicketUrl"), "/go/fd2027"
    assert_equal "Typhoon watch: tip-off delayed 45 minutes", today_body.fetch("games").first["statusNote"]
  end

  test "admin alerts requires staff role and supports CRUD" do
    post "/api/v1/admin/alerts",
      params: { alert: { title: "Viewer try", message: "Blocked", severity: "warning" } },
      headers: headers_for(@viewer),
      as: :json
    assert_response :forbidden

    post "/api/v1/admin/alerts",
      params: { alert: { tournamentId: 999_999, severity: "warning", title: "Bad FK", message: "Should 422" } },
      headers: headers_for(@staff),
      as: :json
    assert_response :unprocessable_entity

    get "/api/v1/admin/alerts", params: { tournamentId: "not-an-id" }, headers: headers_for(@staff)
    assert_response :unprocessable_entity

    post "/api/v1/admin/alerts",
      params: { alert: { tournamentId: @tournament.id, severity: "urgent", title: "Power outage", message: "Generator warming up" } },
      headers: headers_for(@staff),
      as: :json
    assert_response :created
    created_id = JSON.parse(response.body).dig("alert", "id")

    patch "/api/v1/admin/alerts/#{created_id}",
      params: { alert: { active: false, title: "Power restored" } },
      headers: headers_for(@staff),
      as: :json
    assert_response :success
    assert_equal false, JSON.parse(response.body).dig("alert", "active")

    delete "/api/v1/admin/alerts/#{created_id}", headers: headers_for(@staff)
    assert_response :no_content
  end

  private

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
