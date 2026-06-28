require "test_helper"

class PublicClassesControllerTest < ActionDispatch::IntegrationTest
  test "returns class archive without merging combined and individual titles" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2025,
      start_date: Date.new(2025, 7, 1),
      end_date: Date.new(2025, 7, 31),
      status: "completed"
    )
    combined = tournament.teams.create!(class_year_label: "2002/04", display_name: "Class of 2002/04", division: "Maroon")
    opponent = tournament.teams.create!(class_year_label: "2013", display_name: "Class of 2013", division: "Maroon")
    game = tournament.games.create!(home_team: combined, away_team: opponent, start_time: Time.zone.local(2025, 7, 25, 20, 0), status: "final", home_score: 50, away_score: 44)
    tournament.article_links.create!(title: "02/04 wins", source: "GSPN", url: "https://example.test/recap", game: game)

    TournamentChampion.create!(year: 2009, slug: "2009", champion_label: "Class of 2002", champion_key: "02", source: "test", position: 1)
    TournamentChampion.create!(year: 2022, slug: "2022", champion_label: "Class of 2002/04", champion_key: "02/04", source: "test", position: 2)
    TournamentChampion.create!(year: 2025, slug: "2025", champion_label: "Class of 2002/04", champion_key: "02/04", source: "test", position: 3, tournament: tournament)

    get "/api/v1/public/classes/02-04"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "02/04", body.dig("classProfile", "classKey")
    assert_equal 2, body.dig("classProfile", "titleCount")
    assert_equal [ 2025, 2022 ], body.dig("classProfile", "titleYears")
    assert_equal 1, body["teams"].length
    assert_equal 1, body["games"].length
    assert_equal 1, body["articles"].length
    assert_empty body["relatedTitleRecords"]
  end

  test "returns combined records as related context for an individual class" do
    TournamentChampion.create!(year: 2009, slug: "2009", champion_label: "Class of 2002", champion_key: "02", source: "test", position: 1)
    TournamentChampion.create!(year: 2022, slug: "2022", champion_label: "Class of 2002/04", champion_key: "02/04", source: "test", position: 2)

    get "/api/v1/public/classes/02"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 1, body.dig("classProfile", "titleCount")
    assert_equal [ 2009 ], body.dig("classProfile", "titleYears")
    assert_equal [ "Class of 2002/04" ], body["relatedTitleRecords"].map { |record| record["championLabel"] }
  end
end
