require "test_helper"

class PublicTodayAndPredictionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
    @away = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")
    @home = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
    @home.roster_entries.create!(name: "Juan Duenas", jersey_number: "10", position: "G", nickname: "JD")
    @game = @tournament.games.create!(
      home_team: @home,
      away_team: @away,
      start_time: Time.zone.local(2026, 7, 3, 18, 30),
      status: "scheduled",
      division: "Maroon",
      venue: "The Jungle"
    )
    @tournament.game_day_notes.create!(date: Date.new(2026, 7, 3), host_class: "Class of 2006", food_menu: "BBQ", announcement: "Doors open at 6")
    @poll = @tournament.prediction_polls.create!(game: @game, poll_type: "game", question: "Who wins this game?")
  end

  test "today endpoint returns game-day notes rosters and prediction polls" do
    get "/api/v1/public/today", params: { year: 2026, date: "2026-07-03" }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "2026-07-03", body["date"]
    assert_equal "Class of 2006", body.dig("gameDayNote", "hostClass")
    assert_equal 1, body["games"].length
    assert_equal "Juan Duenas", body.dig("games", 0, "homeTeam", "rosterEntries", 0, "name")
    assert_equal @poll.id.to_s, body.dig("predictionPolls", 0, "id")
  end

  test "anonymous prediction vote can be changed for same device token" do
    post "/api/v1/public/prediction-polls/#{@poll.id}/vote",
      params: { predictionVote: { voterToken: "device-123", teamId: @away.id } },
      as: :json

    assert_response :success
    assert_equal @away.id.to_s, JSON.parse(response.body).dig("predictionPoll", "selectedTeamId")
    assert_equal 1, @poll.prediction_votes.count

    post "/api/v1/public/prediction-polls/#{@poll.id}/vote",
      params: { predictionVote: { voterToken: "device-123", teamId: @home.id } },
      as: :json

    assert_response :success
    assert_equal 1, @poll.prediction_votes.count
    assert_equal @home.id, @poll.prediction_votes.first.team_id
    assert_equal @home.id.to_s, JSON.parse(response.body).dig("predictionPoll", "selectedTeamId")
  end

  test "closed prediction poll rejects votes" do
    @poll.update!(status: "closed")

    post "/api/v1/public/prediction-polls/#{@poll.id}/vote",
      params: { predictionVote: { voterToken: "device-closed", teamId: @away.id } },
      as: :json

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body)["errors"].join, "Prediction poll is closed"
  end
end
