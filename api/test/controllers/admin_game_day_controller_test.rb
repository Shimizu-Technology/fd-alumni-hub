require "test_helper"

class AdminGameDayControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "admin-gameday@example.com", clerk_id: "test_clerk_gameday", role: "admin")
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
    @away = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")
    @home = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
    @game = @tournament.games.create!(home_team: @home, away_team: @away, start_time: Time.zone.local(2026, 7, 3, 18, 30), status: "scheduled")
  end

  test "staff can upsert game-day note and create prediction poll" do
    post "/api/v1/admin/game-day-notes",
      params: { gameDayNote: { tournamentId: @tournament.id, date: "2026-07-03", hostClass: "Class of 2006", foodMenu: "BBQ" } },
      headers: auth_headers,
      as: :json

    assert_response :created
    assert_equal "Class of 2006", JSON.parse(response.body).dig("gameDayNote", "hostClass")

    post "/api/v1/admin/prediction-polls",
      params: { predictionPoll: { tournamentId: @tournament.id, gameId: @game.id, pollType: "game" } },
      headers: auth_headers,
      as: :json

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal "Who wins this game?", body.dig("predictionPoll", "question")
    assert_equal "open", body.dig("predictionPoll", "status")
  end

  test "staff can add roster entry" do
    post "/api/v1/admin/roster-entries",
      params: { rosterEntry: { teamId: @home.id, name: "Juan Duenas", jerseyNumber: "10", position: "G" } },
      headers: auth_headers,
      as: :json

    assert_response :created
    assert_equal "Juan Duenas", JSON.parse(response.body).dig("rosterEntry", "name")
    assert_equal "10", @home.roster_entries.first.jersey_number
  end

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
