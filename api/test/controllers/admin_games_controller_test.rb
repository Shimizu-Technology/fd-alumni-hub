require "test_helper"

class AdminGamesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "admin@example.com", clerk_id: "test_clerk_admin", role: "admin")
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "live"
    )
    @class_2016 = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
    @class_2017 = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")
    @game = @tournament.games.create!(
      home_team: @class_2016,
      away_team: @class_2017,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "final",
      home_score: 72,
      away_score: 64
    )
    Standings::Recompute.call(@tournament)
  end

  test "explicit null scores clear existing scores and recompute standings" do
    patch "/api/v1/admin/games/#{@game.id}",
      params: { game: { homeScore: nil, awayScore: nil, status: "scheduled" } },
      headers: auth_headers,
      as: :json

    assert_response :success

    @game.reload
    assert_nil @game.home_score
    assert_nil @game.away_score
    assert_equal "scheduled", @game.status

    body = JSON.parse(response.body)
    assert_nil body.dig("game", "homeScore")
    assert_nil body.dig("game", "awayScore")
    assert_equal({ "teams" => 2, "games" => 0 }, body["recompute"])

    standing = @tournament.standings.find_by!(team: @class_2016)
    assert_equal 0, standing.wins
    assert_equal 0, standing.losses
    assert_equal 0, standing.points_for
    assert_equal 0, standing.points_against
  end

  test "missing game returns JSON 404" do
    patch "/api/v1/admin/games/999999",
      params: { game: { status: "scheduled" } },
      headers: auth_headers,
      as: :json

    assert_response :not_found
    assert_equal({ "error" => "Not found" }, JSON.parse(response.body))
    assert_equal "application/json", response.media_type
  end

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
