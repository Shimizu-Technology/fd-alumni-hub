require "test_helper"

class StandingsRecomputeTest < ActiveSupport::TestCase
  test "tournament start and end are date-only columns" do
    assert_equal :date, Tournament.type_for_attribute("start_date").type
    assert_equal :date, Tournament.type_for_attribute("end_date").type
  end

  test "recomputes standings from final scored games only" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "live"
    )
    class_2016 = tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
    class_2017 = tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")

    tournament.games.create!(
      home_team: class_2016,
      away_team: class_2017,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "final",
      home_score: 72,
      away_score: 64
    )
    tournament.games.create!(
      home_team: class_2017,
      away_team: class_2016,
      start_time: Time.zone.local(2026, 7, 5, 18, 0),
      status: "scheduled"
    )
    tournament.games.create!(
      home_team: class_2017,
      away_team: class_2016,
      start_time: Time.zone.local(2026, 7, 6, 18, 0),
      status: "final",
      home_score: 80,
      away_score: nil
    )

    assert_equal 1, tournament.games.scored.count

    result = Standings::Recompute.call(tournament)

    assert_equal 2, result.teams
    assert_equal 1, result.games

    standing_2016 = tournament.standings.find_by!(team: class_2016)
    standing_2017 = tournament.standings.find_by!(team: class_2017)

    assert_equal 1, standing_2016.wins
    assert_equal 0, standing_2016.losses
    assert_equal 72, standing_2016.points_for
    assert_equal 64, standing_2016.points_against

    assert_equal 0, standing_2017.wins
    assert_equal 1, standing_2017.losses
    assert_equal 64, standing_2017.points_for
    assert_equal 72, standing_2017.points_against
  end
end
