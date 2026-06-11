require "test_helper"

class AdminTournamentsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "admin@example.com", clerk_id: "test_clerk_admin", role: "admin")
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
  end

  test "explicit null date is validated instead of silently ignored" do
    patch "/api/v1/admin/tournaments/#{@tournament.id}",
      params: { tournament: { startDate: nil } },
      headers: auth_headers,
      as: :json

    assert_response :unprocessable_entity
    assert_equal Date.new(2026, 7, 3), @tournament.reload.start_date
  end

  test "recompute standings returns freshly recomputed rows" do
    class_2016 = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
    class_2017 = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")
    @tournament.standings.create!(team: class_2016, wins: 9, losses: 0, points_for: 999, points_against: 1)
    @tournament.games.create!(
      home_team: class_2016,
      away_team: class_2017,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "final",
      home_score: 72,
      away_score: 64
    )

    with_preloaded_standings_during_recompute do
      post "/api/v1/admin/tournaments/#{@tournament.id}/recompute-standings", headers: auth_headers
    end

    assert_response :success
    standings = JSON.parse(response.body).fetch("standings")
    class_2016_row = standings.find { |row| row.dig("team", "displayName") == "Class of 2016" }
    assert_equal 1, class_2016_row["wins"]
    assert_equal 72, class_2016_row["pointsFor"]
  end

  test "missing tournament returns JSON 404" do
    get "/api/v1/admin/tournaments/999999", headers: auth_headers

    assert_response :not_found
    assert_equal({ "error" => "Not found" }, JSON.parse(response.body))
    assert_equal "application/json", response.media_type
  end

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end

  def with_preloaded_standings_during_recompute
    original_call = Standings::Recompute.method(:call)

    Standings::Recompute.define_singleton_method(:call) do |tournament|
      tournament.standings.to_a
      original_call.call(tournament)
    end

    yield
  ensure
    Standings::Recompute.define_singleton_method(:call) { |tournament| original_call.call(tournament) }
  end
end
