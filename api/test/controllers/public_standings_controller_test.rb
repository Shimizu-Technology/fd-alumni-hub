require "test_helper"

class PublicStandingsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2027,
      start_date: Date.new(2027, 7, 2),
      end_date: Date.new(2027, 7, 23),
      status: "live"
    )
    @tournament.ensure_default_divisions!
    @maroon = @tournament.divisions.find_by!(name: "Maroon")
    @gold = @tournament.divisions.find_by!(name: "Gold")
    @special = @tournament.divisions.find_by!(name: "Special")

    @m1 = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division_record: @maroon)
    @m2 = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: @maroon)
    @g1 = @tournament.teams.create!(class_year_label: "2008", display_name: "Class of 2008", division_record: @gold)
    @g2 = @tournament.teams.create!(class_year_label: "2009", display_name: "Class of 2009", division_record: @gold)
    @sp = @tournament.teams.create!(class_year_label: "1980", display_name: "Class of 1980", division_record: @special)

    @tournament.games.create!(home_team: @m1, away_team: @m2, division_record: @maroon, start_time: Time.zone.local(2027, 7, 2, 18, 0), status: "final", home_score: 70, away_score: 60, phase: "pool")
    @tournament.games.create!(home_team: @m2, away_team: @m1, division_record: @maroon, start_time: Time.zone.local(2027, 7, 3, 18, 0), status: "scheduled", phase: "pool")
    @tournament.games.create!(home_team: @g1, away_team: @g2, division_record: @gold, start_time: Time.zone.local(2027, 7, 2, 19, 30), status: "final", home_score: 55, away_score: 50, phase: "pool")
    # Playoff game should NOT count in pool scoreCoverage
    @tournament.games.create!(home_team: @m1, away_team: @m2, division_record: @maroon, start_time: Time.zone.local(2027, 7, 20, 19, 0), status: "scheduled", phase: "playoff")
    Standings::Recompute.call(@tournament)
  end

  test "returns per-division standings starting at rank 1 and pool-only scoreCoverage" do
    get "/api/v1/public/standings", params: { year: 2027 }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal %w[Maroon Gold Platinum], body["divisions"]

    groups = body.fetch("divisionStandings")
    assert_equal %w[Maroon Gold Platinum], groups.map { |g| g.dig("division", "name") }

    maroon_group = groups.find { |g| g.dig("division", "name") == "Maroon" }
    gold_group = groups.find { |g| g.dig("division", "name") == "Gold" }
    assert_equal [ 1, 2 ], maroon_group["standings"].map { |row| row["rank"] }
    assert_equal [ 1, 2 ], gold_group["standings"].map { |row| row["rank"] }
    assert_equal 1, maroon_group.dig("scoreCoverage", "scoredPoolGames")
    assert_equal 2, maroon_group.dig("scoreCoverage", "totalPoolGames")
    assert_equal 50.0, maroon_group.dig("scoreCoverage", "percent")

    # Overall pool coverage: 2 scored of 3 pool games (playoff excluded)
    assert_equal 2, body.dig("scoreCoverage", "scoredPoolGames")
    assert_equal 3, body.dig("scoreCoverage", "totalPoolGames")
    assert_equal 66.7, body.dig("scoreCoverage", "percent")
  end

  test "filters by divisionId or division slug" do
    get "/api/v1/public/standings", params: { year: 2027, division: "gold" }
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [ "Gold" ], body["divisionStandings"].map { |g| g.dig("division", "name") }
    assert_equal 2, body["standings"].length
    assert_equal 1, body.dig("scoreCoverage", "totalPoolGames")
  end

  test "returns empty 200 payload when no tournament matches the requested year" do
    get "/api/v1/public/standings", params: { year: 1999 }

    assert_response :success
    body = JSON.parse(response.body)
    assert_nil body["tournament"]
    assert_equal [], body["standings"]
    assert_equal [], body["divisions"]
    assert_equal [], body["divisionStandings"]
    assert_equal 0, body.dig("scoreCoverage", "scoredPoolGames")
    assert_equal 0, body.dig("scoreCoverage", "totalPoolGames")
  end
end
