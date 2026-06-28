require "test_helper"

class PublicTeamsControllerTest < ActionDispatch::IntegrationTest
  test "returns public team profile with roster games and standing" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
    team = tournament.teams.create!(class_year_label: "2006", display_name: "Class of 2006", division: "Maroon")
    opponent = tournament.teams.create!(class_year_label: "2013", display_name: "Class of 2013", division: "Gold")
    team.roster_entries.create!(name: "Test Player", jersey_number: "6", active: true)
    game = tournament.games.create!(
      home_team: opponent,
      away_team: team,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "final",
      home_score: 58,
      away_score: 62
    )
    tournament.standings.create!(team: team, wins: 1, losses: 0, points_for: 62, points_against: 58)
    tournament.article_links.create!(title: "Class of 2006 wins", source: "GSPN", url: "https://example.com/recap", game: game)
    TournamentChampion.create!(year: 2021, slug: "2021", champion_label: "Class of 2006", champion_key: "06", source: "test", position: 1)

    get "/api/v1/public/teams/#{team.id}"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "Class of 2006", body.dig("team", "displayName")
    assert_equal 1, body.dig("team", "rosterEntries").length
    assert_equal 1, body["games"].length
    assert_equal "Class of 2006", body.dig("games", 0, "awayTeam", "displayName")
    assert_equal 1, body.dig("standing", "wins")
    assert_equal 1, body["articles"].length
    assert_equal 1, body["titleRecords"].length
    assert_equal "Class of 2006", body.dig("titleRecords", 0, "championLabel")
  end

  test "returns not found for unknown team" do
    get "/api/v1/public/teams/999999"

    assert_response :not_found
  end
end
