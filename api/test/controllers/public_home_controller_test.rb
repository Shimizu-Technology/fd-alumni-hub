require "test_helper"

class PublicHomeControllerTest < ActionDispatch::IntegrationTest
  setup do
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2099,
      start_date: Date.new(2099, 7, 3),
      end_date: Date.new(2099, 7, 24),
      status: "upcoming"
    )
    @away = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")
    @home = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
    @game = @tournament.games.create!(home_team: @home, away_team: @away, start_time: Time.zone.now.change(hour: 18, min: 30), status: "scheduled")
    @poll = @tournament.prediction_polls.create!(game: @game, poll_type: "game", question: "Who wins this game?")
    @tournament.game_day_notes.create!(date: Time.zone.today, host_class: "Class of 2006", food_menu: "BBQ plates", announcement: "Doors open at 6")
  end

  test "home endpoint includes active game-day note for today" do
    get "/api/v1/public/home", headers: { "X-FD-Voter-Token" => "home-device" }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal @tournament.id.to_s, body.dig("tournament", "id")
    assert_equal "BBQ plates", body.dig("gameDayNote", "foodMenu")
    assert_equal @game.id.to_s, body.dig("todayGames", 0, "id")
    assert_equal @poll.id.to_s, body.dig("predictionPolls", 0, "id")
    assert_nil body.dig("predictionPolls", 0, "resultsVisible")
  end
end
