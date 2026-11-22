require "test_helper"

class StandingsRecomputeTest < ActiveSupport::TestCase
  test "tournament start and end are date-only columns" do
    assert_equal :date, Tournament.type_for_attribute("start_date").type
    assert_equal :date, Tournament.type_for_attribute("end_date").type
  end

  test "recomputes standings from final scored pool games only and persists division_rank" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "live"
    )
    maroon = tournament.divisions.create!(name: "Maroon", position: 1)
    class_2016 = tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division_record: maroon)
    class_2017 = tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: maroon)

    tournament.games.create!(
      home_team: class_2016,
      away_team: class_2017,
      division_record: maroon,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "final",
      home_score: 72,
      away_score: 64
    )
    tournament.games.create!(
      home_team: class_2017,
      away_team: class_2016,
      division_record: maroon,
      start_time: Time.zone.local(2026, 7, 5, 18, 0),
      status: "scheduled"
    )
    tournament.games.create!(
      home_team: class_2017,
      away_team: class_2016,
      division_record: maroon,
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

    assert_equal 1, standing_2016.division_rank
    assert_equal 1, standing_2016.wins
    assert_equal 0, standing_2016.losses
    assert_equal 72, standing_2016.points_for
    assert_equal 64, standing_2016.points_against

    assert_equal 2, standing_2017.division_rank
    assert_equal 0, standing_2017.wins
    assert_equal 1, standing_2017.losses
    assert_equal 64, standing_2017.points_for
    assert_equal 72, standing_2017.points_against

    coverage = Standings::Coverage.for(tournament)
    assert_equal 1, coverage[:scoredPoolGames]
    assert_equal 3, coverage[:totalPoolGames]
    assert_equal 33.3, coverage[:percent]
  end

  test "excludes unassigned, father-son, placeholder, playoff, exhibition, cross-division, and special games and teams" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "live"
    )
    tournament.ensure_default_divisions!
    maroon = tournament.divisions.find_by!(name: "Maroon")
    gold = tournament.divisions.find_by!(name: "Gold")
    special = tournament.divisions.find_by!(name: "Special")

    class_2016 = tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division_record: maroon)
    class_2017 = tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: maroon)
    no_div_team = tournament.teams.create!(class_year_label: "2020", display_name: "Class of 2020")
    fs1 = tournament.teams.create!(class_year_label: "FS1", display_name: "FS1")
    fs2 = tournament.teams.create!(class_year_label: "FS2", display_name: "FS2")
    tbd = tournament.teams.create!(class_year_label: "TBD", display_name: "Class TBD", division_record: maroon)
    special_team = tournament.teams.create!(class_year_label: "1980", display_name: "Class of 1980", division_record: special)
    wmp1 = tournament.teams.create!(class_year_label: "WMP1", display_name: "Class WMP1", division_record: maroon)
    m1_winner = tournament.teams.create!(class_year_label: "M1 Winner", display_name: "M1 Winner", division_record: maroon)
    fs_alumni = tournament.teams.create!(class_year_label: "FS Alumni", display_name: "FS Alumni", division_record: gold)
    sixties = tournament.teams.create!(class_year_label: "60s", display_name: "Class 60s", division_record: gold)
    seventies = tournament.teams.create!(class_year_label: "70s", display_name: "Class 70s", division_record: gold)

    # Counts: pool games in Maroon and Gold
    tournament.games.create!(home_team: class_2016, away_team: class_2017, division_record: maroon, start_time: Time.zone.local(2026, 7, 3, 18, 0), status: "final", home_score: 70, away_score: 65, phase: "pool")
    tournament.games.create!(home_team: sixties, away_team: seventies, division_record: gold, start_time: Time.zone.local(2026, 7, 4, 15, 0), status: "final", home_score: 48, away_score: 42, phase: "pool")
    tournament.games.create!(home_team: fs_alumni, away_team: seventies, division_record: gold, start_time: Time.zone.local(2026, 7, 5, 16, 0), status: "final", home_score: 52, away_score: 49, phase: "pool")

    # Excluded games:
    tournament.games.create!(home_team: class_2017, away_team: class_2016, division_record: maroon, start_time: Time.zone.local(2026, 7, 18, 19, 0), status: "final", home_score: 80, away_score: 75, notes: "phase=playoff")
    tournament.games.create!(home_team: class_2016, away_team: class_2017, division_record: maroon, start_time: Time.zone.local(2026, 7, 20, 19, 0), status: "final", home_score: 64, away_score: 61, bracket_code: "MSF1")
    tournament.games.create!(home_team: class_2016, away_team: class_2017, division_record: maroon, start_time: Time.zone.local(2026, 7, 13, 19, 0), status: "final", home_score: 60, away_score: 58, phase: "exhibition")
    tournament.games.create!(home_team: class_2016, away_team: sixties, start_time: Time.zone.local(2026, 7, 14, 19, 0), status: "final", home_score: 60, away_score: 58, phase: "pool") # cross-division
    tournament.games.create!(home_team: fs1, away_team: fs2, start_time: Time.zone.local(2026, 7, 5, 15, 40), status: "final", home_score: 50, away_score: 40, bracket_code: "FS01", notes: "phase=fatherson")
    tournament.games.create!(home_team: class_2016, away_team: class_2017, division_record: maroon, start_time: Time.zone.local(2026, 7, 17, 20, 20), status: "final", home_score: 99, away_score: 1, placeholder: true)
    tournament.games.create!(home_team: class_2016, away_team: class_2017, division_record: special, start_time: Time.zone.local(2026, 7, 11, 14, 0), status: "final", home_score: 55, away_score: 45)
    tournament.games.create!(home_team: class_2016, away_team: tbd, division_record: maroon, start_time: Time.zone.local(2026, 7, 11, 16, 0), status: "final", home_score: 55, away_score: 45)
    tournament.games.create!(home_team: special_team, away_team: class_2016, start_time: Time.zone.local(2026, 7, 12, 16, 0), status: "final", home_score: 51, away_score: 49)
    tournament.games.create!(home_team: class_2016, away_team: wmp1, division_record: maroon, start_time: Time.zone.local(2026, 7, 19, 19, 0), status: "final", home_score: 60, away_score: 50, bracket_code: "MP9")
    tournament.games.create!(home_team: m1_winner, away_team: class_2016, division_record: maroon, start_time: Time.zone.local(2026, 7, 21, 19, 0), status: "final", home_score: 40, away_score: 42)
    tournament.games.create!(home_team: no_div_team, away_team: class_2016, start_time: Time.zone.local(2026, 7, 15, 19, 0), status: "final", home_score: 50, away_score: 48)

    result = Standings::Recompute.call(tournament)

    assert_equal 5, result.teams
    assert_equal 3, result.games
    assert_equal 7, result.excluded_teams
    assert_equal 12, result.excluded_games

    assert_equal [ class_2016.id, class_2017.id, fs_alumni.id, sixties.id, seventies.id ].sort, tournament.standings.pluck(:team_id).sort

    # Ranks reset at #1 per division
    assert_equal 1, tournament.standings.find_by!(team: class_2016).division_rank
    assert_equal 2, tournament.standings.find_by!(team: class_2017).division_rank
    assert_equal 1, tournament.standings.find_by!(team: sixties).division_rank
    assert_equal 2, tournament.standings.find_by!(team: fs_alumni).division_rank
    assert_equal 3, tournament.standings.find_by!(team: seventies).division_rank
  end

  test "tiebreakers apply win pct, two-team H2H, point diff, and re-apply H2H when 3-way tie splits to a pair" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2027,
      start_date: Date.new(2027, 7, 2),
      end_date: Date.new(2027, 7, 23),
      status: "live"
    )
    maroon = tournament.divisions.create!(name: "Maroon", position: 1)
    team_a = tournament.teams.create!(class_year_label: "2015", display_name: "Alpha", division_record: maroon)
    team_b = tournament.teams.create!(class_year_label: "2016", display_name: "Bravo", division_record: maroon)
    team_c = tournament.teams.create!(class_year_label: "2017", display_name: "Charlie", division_record: maroon)
    team_d = tournament.teams.create!(class_year_label: "2018", display_name: "Delta", division_record: maroon)
    team_e = tournament.teams.create!(class_year_label: "2019", display_name: "Echo", division_record: maroon)

    # 3-way tie at 1-1 among A, B, C:
    # A beats B 70-65 (+5 / -5)
    # B beats C 65-50 (+15 / -15) -> B total diff +10 (#1 of trio)
    # C beats A 60-50 (+10 / -10) -> A total diff -5 (PF 120), C total diff -5 (PF 110)
    # Remaining 2-team tie (A & C) re-applies H2H -> Charlie beat Alpha, so Charlie ranks above Alpha despite lower PF!
    tournament.games.create!(home_team: team_a, away_team: team_b, division_record: maroon, start_time: Time.zone.local(2027, 7, 2, 18, 0), status: "final", home_score: 70, away_score: 65)
    tournament.games.create!(home_team: team_b, away_team: team_c, division_record: maroon, start_time: Time.zone.local(2027, 7, 3, 18, 0), status: "final", home_score: 65, away_score: 50)
    tournament.games.create!(home_team: team_c, away_team: team_a, division_record: maroon, start_time: Time.zone.local(2027, 7, 4, 18, 0), status: "final", home_score: 60, away_score: 50)
    # Delta beats Echo so Delta is 1-0 (#1), Bravo/Charlie/Alpha are 1-1 (#2..#4), Foxtrot is 0-0 (#5), Echo is 0-1 (#6).
    team_f = tournament.teams.create!(class_year_label: "2020", display_name: "Foxtrot", division_record: maroon)
    tournament.games.create!(home_team: team_d, away_team: team_e, division_record: maroon, start_time: Time.zone.local(2027, 7, 5, 18, 0), status: "final", home_score: 55, away_score: 50)

    Standings::Recompute.call(tournament)
    ordered = tournament.standings.ranked.map { |s| [ s.division_rank, s.team.display_name ] }

    assert_equal [
      [ 1, "Delta" ],   # 1-0 (100% win pct)
      [ 2, "Bravo" ],   # 1-1 (+10 diff)
      [ 3, "Charlie" ], # 1-1 (-5 diff, beat Alpha H2H despite lower PF)
      [ 4, "Alpha" ],   # 1-1 (-5 diff, lost to Charlie H2H)
      [ 5, "Foxtrot" ], # 0-0 (ranks above 0-1)
      [ 6, "Echo" ]     # 0-1
    ], ordered
  end

  test "two-team tie uses head-to-head even when point differential favors the loser" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2028,
      start_date: Date.new(2028, 7, 1),
      end_date: Date.new(2028, 7, 20),
      status: "live"
    )
    gold = tournament.divisions.create!(name: "Gold", position: 1)
    team_a = tournament.teams.create!(class_year_label: "2010", display_name: "Team A", division_record: gold)
    team_b = tournament.teams.create!(class_year_label: "2011", display_name: "Team B", division_record: gold)
    team_c = tournament.teams.create!(class_year_label: "2012", display_name: "Team C", division_record: gold)
    team_d = tournament.teams.create!(class_year_label: "2013", display_name: "Team D", division_record: gold)

    # Team D finishes 2-0 (#1), Team C finishes 0-2 (#4), and Teams A & B tie at 1-1.
    # Team A beat Team B 51-50 head-to-head, so Team A ranks #2 despite Team B's larger point differential.
    tournament.games.create!(home_team: team_a, away_team: team_b, division_record: gold, start_time: Time.zone.local(2028, 7, 1, 18, 0), status: "final", home_score: 51, away_score: 50)
    tournament.games.create!(home_team: team_b, away_team: team_c, division_record: gold, start_time: Time.zone.local(2028, 7, 2, 18, 0), status: "final", home_score: 90, away_score: 40)
    tournament.games.create!(home_team: team_d, away_team: team_a, division_record: gold, start_time: Time.zone.local(2028, 7, 3, 18, 0), status: "final", home_score: 70, away_score: 50)
    tournament.games.create!(home_team: team_d, away_team: team_c, division_record: gold, start_time: Time.zone.local(2028, 7, 4, 18, 0), status: "final", home_score: 70, away_score: 50)

    Standings::Recompute.call(tournament)
    ordered = tournament.standings.ranked.map { |s| [ s.division_rank, s.team.display_name ] }

    # D is 2-0 (#1). A (1-1, diff -19) beat B (1-1, diff +49) head-to-head -> A ranks #2, B ranks #3!
    assert_equal [
      [ 1, "Team D" ],
      [ 2, "Team A" ],
      [ 3, "Team B" ],
      [ 4, "Team C" ]
    ], ordered
  end
end
