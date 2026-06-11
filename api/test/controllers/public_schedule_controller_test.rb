require "test_helper"

class PublicScheduleControllerTest < ActionDispatch::IntegrationTest
  test "returns schedule filtered by year division and phase" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
    maroon_home = tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
    maroon_away = tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")
    gold_home = tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018", division: "Gold")

    tournament.games.create!(
      home_team: maroon_home,
      away_team: maroon_away,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "scheduled",
      division: "Maroon",
      notes: "phase=pool"
    )
    tournament.games.create!(
      home_team: gold_home,
      away_team: maroon_home,
      start_time: Time.zone.local(2026, 7, 4, 18, 0),
      status: "scheduled",
      division: "Gold",
      notes: "phase=playoff"
    )

    get "/api/v1/public/schedule", params: { year: 2026, division: "Maroon", phase: "pool" }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "2026", body.dig("tournament", "year").to_s
    assert_equal [ "Gold", "Maroon" ], body["divisions"]
    assert_equal [ "pool", "playoff" ], body["phases"]
    assert_equal 1, body["games"].length
    assert_equal "Class of 2016", body.dig("games", 0, "homeTeam", "displayName")
  end
end
