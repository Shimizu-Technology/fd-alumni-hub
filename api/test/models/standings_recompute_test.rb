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

  test "excludes father-son, placeholder, playoff, and special games and teams from standings" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "live"
    )
    class_2016 = tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
    class_2017 = tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")
    fs1 = tournament.teams.create!(class_year_label: "FS1", display_name: "FS1")
    fs2 = tournament.teams.create!(class_year_label: "FS2", display_name: "FS2")
    tbd = tournament.teams.create!(class_year_label: "TBD", display_name: "Class TBD", division: "Maroon")
    special_team = tournament.teams.create!(class_year_label: "1980", display_name: "Class of 1980", division: "Special")
    wmp1 = tournament.teams.create!(class_year_label: "WMP1", display_name: "Class WMP1", division: "Maroon")
    m1_winner = tournament.teams.create!(class_year_label: "M1 Winner", display_name: "M1 Winner", division: "Maroon")
    fs_alumni = tournament.teams.create!(class_year_label: "FS Alumni", display_name: "FS Alumni", division: "Gold")
    sixties = tournament.teams.create!(class_year_label: "60s", display_name: "Class 60s", division: "Gold")
    seventies = tournament.teams.create!(class_year_label: "70s", display_name: "Class 70s", division: "Gold")

    # Counts: pool games (including real Gold division 60s and non-father-son "FS Alumni" teams)
    tournament.games.create!(
      home_team: class_2016,
      away_team: class_2017,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "final",
      home_score: 70,
      away_score: 65,
      notes: "phase=pool"
    )
    tournament.games.create!(
      home_team: sixties,
      away_team: seventies,
      start_time: Time.zone.local(2026, 7, 4, 15, 0),
      status: "final",
      home_score: 48,
      away_score: 42
    )
    tournament.games.create!(
      home_team: fs_alumni,
      away_team: seventies,
      start_time: Time.zone.local(2026, 7, 5, 16, 0),
      status: "final",
      home_score: 52,
      away_score: 49
    )
    # Excluded: playoff game (notes)
    tournament.games.create!(
      home_team: class_2017,
      away_team: class_2016,
      start_time: Time.zone.local(2026, 7, 18, 19, 0),
      status: "final",
      home_score: 80,
      away_score: 75,
      notes: "phase=playoff"
    )
    # Excluded: division-prefixed playoff bracket code
    tournament.games.create!(
      home_team: class_2016,
      away_team: class_2017,
      start_time: Time.zone.local(2026, 7, 20, 19, 0),
      status: "final",
      home_score: 64,
      away_score: 61,
      bracket_code: "MSF1"
    )
    # Excluded: father-son game
    tournament.games.create!(
      home_team: fs1,
      away_team: fs2,
      start_time: Time.zone.local(2026, 7, 5, 15, 40),
      status: "final",
      home_score: 50,
      away_score: 40,
      bracket_code: "FS01",
      notes: "phase=fatherson"
    )
    # Excluded: placeholder game
    tournament.games.create!(
      home_team: class_2016,
      away_team: class_2017,
      start_time: Time.zone.local(2026, 7, 17, 20, 20),
      status: "final",
      home_score: 99,
      away_score: 1,
      placeholder: true
    )
    # Excluded: special division game between two otherwise eligible teams
    tournament.games.create!(
      home_team: class_2016,
      away_team: class_2017,
      start_time: Time.zone.local(2026, 7, 11, 14, 0),
      status: "final",
      home_score: 55,
      away_score: 45,
      division: "Special"
    )
    # Excluded: placeholder team (TBD) in Maroon
    tournament.games.create!(
      home_team: class_2016,
      away_team: tbd,
      start_time: Time.zone.local(2026, 7, 11, 16, 0),
      status: "final",
      home_score: 55,
      away_score: 45
    )
    # Excluded: numeric-class team in Special division
    tournament.games.create!(
      home_team: special_team,
      away_team: class_2016,
      start_time: Time.zone.local(2026, 7, 12, 16, 0),
      status: "final",
      home_score: 51,
      away_score: 49
    )
    # Excluded: bracket placeholder team game
    tournament.games.create!(
      home_team: class_2016,
      away_team: wmp1,
      start_time: Time.zone.local(2026, 7, 19, 19, 0),
      status: "final",
      home_score: 60,
      away_score: 50,
      bracket_code: "MP9"
    )
    # Excluded: named winner placeholder team
    tournament.games.create!(
      home_team: m1_winner,
      away_team: class_2016,
      start_time: Time.zone.local(2026, 7, 21, 19, 0),
      status: "final",
      home_score: 40,
      away_score: 42
    )

    result = Standings::Recompute.call(tournament)

    assert_equal 5, result.teams
    assert_equal 3, result.games
    assert_equal 6, result.excluded_teams
    assert_equal 9, result.excluded_games

    assert_equal [ class_2016.id, class_2017.id, fs_alumni.id, sixties.id, seventies.id ].sort, tournament.standings.pluck(:team_id).sort

    standing_2016 = tournament.standings.find_by!(team: class_2016)
    standing_2017 = tournament.standings.find_by!(team: class_2017)

    assert_equal 1, standing_2016.wins
    assert_equal 0, standing_2016.losses
    assert_equal 70, standing_2016.points_for
    assert_equal 65, standing_2016.points_against

    assert_equal 0, standing_2017.wins
    assert_equal 1, standing_2017.losses
  end
end
