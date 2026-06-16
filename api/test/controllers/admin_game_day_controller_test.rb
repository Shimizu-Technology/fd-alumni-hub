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
    post "/api/v1/admin/game-day-notes?tournamentId=#{@tournament.id}",
      params: { gameDayNote: { date: "2026-07-03", hostClass: "Class of 2006", foodMenu: "BBQ" } },
      headers: auth_headers,
      as: :json

    assert_response :created
    assert_equal "Class of 2006", JSON.parse(response.body).dig("gameDayNote", "hostClass")

    post "/api/v1/admin/prediction-polls?tournamentId=#{@tournament.id}",
      params: { predictionPoll: { gameId: @game.id, pollType: "game" } },
      headers: auth_headers,
      as: :json

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal "Who wins this game?", body.dig("predictionPoll", "question")
    assert_equal "open", body.dig("predictionPoll", "status")
  end

  test "staff can add roster entry" do
    post "/api/v1/admin/roster-entries?tournamentId=#{@tournament.id}",
      params: { rosterEntry: { teamId: @home.id, name: "Juan Duenas", jerseyNumber: "10", position: "G" } },
      headers: auth_headers,
      as: :json

    assert_response :created
    assert_equal "Juan Duenas", JSON.parse(response.body).dig("rosterEntry", "name")
    assert_equal "10", @home.roster_entries.first.jersey_number
  end

  test "admin updates and deletes are scoped to selected tournament" do
    other_tournament, other_home, other_game = build_other_tournament_context
    other_note = other_tournament.game_day_notes.create!(date: Date.new(2025, 7, 3), host_class: "Other host")
    other_poll = other_tournament.prediction_polls.create!(game: other_game, poll_type: "game", question: "Other poll")
    other_roster_entry = other_home.roster_entries.create!(name: "Other Player")

    patch "/api/v1/admin/game-day-notes/#{other_note.id}",
      params: { tournamentId: @tournament.id, gameDayNote: { hostClass: "Wrong host" } },
      headers: auth_headers,
      as: :json
    assert_response :not_found
    assert_equal "Other host", other_note.reload.host_class

    patch "/api/v1/admin/prediction-polls/#{other_poll.id}",
      params: { tournamentId: @tournament.id, predictionPoll: { status: "closed" } },
      headers: auth_headers,
      as: :json
    assert_response :not_found
    assert_equal "open", other_poll.reload.status

    delete "/api/v1/admin/roster-entries/#{other_roster_entry.id}",
      params: { tournamentId: @tournament.id },
      headers: auth_headers,
      as: :json
    assert_response :not_found
    assert RosterEntry.exists?(other_roster_entry.id)
  end

  test "admin creates ignore cross-tournament ids from request bodies" do
    other_tournament, other_home, other_game = build_other_tournament_context

    assert_difference -> { @tournament.game_day_notes.count }, 1 do
      assert_no_difference -> { other_tournament.game_day_notes.count } do
        post "/api/v1/admin/game-day-notes?tournamentId=#{@tournament.id}",
          params: { gameDayNote: { tournamentId: other_tournament.id, date: "2026-07-03", hostClass: "Selected host" } },
          headers: auth_headers,
          as: :json
      end
    end
    assert_response :created
    assert_equal @tournament.id.to_s, JSON.parse(response.body).dig("gameDayNote", "tournamentId")

    assert_difference -> { @tournament.prediction_polls.count }, 1 do
      assert_no_difference -> { other_tournament.prediction_polls.count } do
        post "/api/v1/admin/prediction-polls?tournamentId=#{@tournament.id}",
          params: { predictionPoll: { tournamentId: other_tournament.id, pollType: "tournament" } },
          headers: auth_headers,
          as: :json
      end
    end
    assert_response :created
    assert_equal @tournament.id.to_s, JSON.parse(response.body).dig("predictionPoll", "tournamentId")

    assert_no_difference -> { RosterEntry.count } do
      post "/api/v1/admin/roster-entries?tournamentId=#{@tournament.id}",
        params: { rosterEntry: { teamId: other_home.id, name: "Wrong Tournament" } },
        headers: auth_headers,
        as: :json
    end
    assert_response :not_found

    assert_no_difference -> { PredictionPoll.count } do
      post "/api/v1/admin/prediction-polls?tournamentId=#{@tournament.id}",
        params: { predictionPoll: { gameId: other_game.id, pollType: "game" } },
        headers: auth_headers,
        as: :json
    end
    assert_response :not_found
  end

  test "invalid game-day note date returns validation error" do
    assert_no_difference -> { GameDayNote.count } do
      post "/api/v1/admin/game-day-notes?tournamentId=#{@tournament.id}",
        params: { gameDayNote: { date: "next-Friday", hostClass: "Class of 2006" } },
        headers: auth_headers,
        as: :json
    end

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body)["errors"], "Date must be a valid ISO 8601 date"

    note = @tournament.game_day_notes.create!(date: Date.new(2026, 7, 3), host_class: "Original host")
    patch "/api/v1/admin/game-day-notes/#{note.id}?tournamentId=#{@tournament.id}",
      params: { gameDayNote: { date: "bad-date", hostClass: "Changed host" } },
      headers: auth_headers,
      as: :json

    assert_response :unprocessable_entity
    assert_equal "Original host", note.reload.host_class
  end

  private

  def build_other_tournament_context
    other_tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2025,
      start_date: Date.new(2025, 7, 3),
      end_date: Date.new(2025, 7, 24),
      status: "completed"
    )
    other_away = other_tournament.teams.create!(class_year_label: "2015", display_name: "Class of 2015", division: "Maroon")
    other_home = other_tournament.teams.create!(class_year_label: "2014", display_name: "Class of 2014", division: "Maroon")
    other_game = other_tournament.games.create!(home_team: other_home, away_team: other_away, start_time: Time.zone.local(2025, 7, 3, 18, 30), status: "scheduled")

    [ other_tournament, other_home, other_game ]
  end

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
