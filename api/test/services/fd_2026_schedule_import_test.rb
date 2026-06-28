require "test_helper"

class Fd2026ScheduleImportTest < ActiveSupport::TestCase
  test "imports the organizer 2026 pool-play schedule idempotently" do
    result = DataImport::Fd2026ScheduleImport.call

    tournament = Tournament.find_by!(year: 2026)
    assert_equal "FD Alumni Basketball Tournament", tournament.name
    assert_equal Date.new(2026, 7, 3), tournament.start_date
    assert_equal Date.new(2026, 7, 24), tournament.end_date
    assert_equal 61, result[:games]
    assert_equal 3, result[:skippedRows]
    assert_equal 32, tournament.teams.count
    assert_equal 61, tournament.games.count
    assert Team.exists?(display_name: "430-5")
    assert Team.exists?(display_name: "08/15")
    assert_not Team.exists?(display_name: "435")
    assert_not Team.exists?(display_name: "815")

    opener = Game.find_by!(legacy_id: "fd-2026-schedule-1")
    assert_equal "79/80", opener.away_team.display_name
    assert_equal "84/85", opener.home_team.display_name
    assert_equal "The Jungle", opener.venue
    assert_equal "1", opener.bracket_code
    assert_includes opener.notes, "phase=pool"
    assert_equal Time.find_zone!("Pacific/Guam").local(2026, 7, 3, 18, 0), opener.start_time

    father_son = Game.find_by!(legacy_id: "fd-2026-schedule-fs01")
    assert_equal "FS1", father_son.away_team.display_name
    assert_equal "FS2", father_son.home_team.display_name
    assert_includes father_son.notes, "phase=fatherson"

    assert_nil Game.find_by(legacy_id: "fd-2026-schedule-60sfs")

    assert_no_difference -> { Tournament.count } do
      assert_no_difference -> { Team.count } do
        assert_no_difference -> { Game.count } do
          DataImport::Fd2026ScheduleImport.call
        end
      end
    end
  end

  test "renames previous shorthand team labels on later seed runs" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
    four_thirty_five = tournament.teams.create!(legacy_id: "fd-2026-team-435", class_year_label: "435", display_name: "435")
    eight_fifteen = tournament.teams.create!(legacy_id: "fd-2026-team-815", class_year_label: "815", display_name: "815")

    DataImport::Fd2026ScheduleImport.call

    assert_equal 32, tournament.teams.count
    assert_equal "430-5", four_thirty_five.reload.display_name
    assert_equal "fd-2026-team-430-5", four_thirty_five.legacy_id
    assert_equal "08/15", eight_fifteen.reload.display_name
    assert_equal "fd-2026-team-08-15", eight_fifteen.legacy_id
  end

  test "does not overwrite admin edits on later seed runs" do
    DataImport::Fd2026ScheduleImport.call
    tournament = Tournament.find_by!(year: 2026)
    team = Team.find_by!(legacy_id: "fd-2026-team-79-80")
    game = Game.find_by!(legacy_id: "fd-2026-schedule-1")
    adjusted_start_date = Date.new(2026, 7, 4)
    adjusted_end_date = Date.new(2026, 7, 25)
    adjusted_tipoff = Time.find_zone!("Pacific/Guam").local(2026, 7, 3, 18, 10)

    tournament.update!(start_date: adjusted_start_date, end_date: adjusted_end_date)
    team.update!(class_year_label: "1979/1980", display_name: "Class of 1979/1980")
    game.update!(status: "final", away_score: 70, home_score: 68, start_time: adjusted_tipoff, notes: "phase=pool; scorer note")

    DataImport::Fd2026ScheduleImport.call

    tournament.reload
    team.reload
    game.reload
    assert_equal adjusted_start_date, tournament.start_date
    assert_equal adjusted_end_date, tournament.end_date
    assert_equal "1979/1980", team.class_year_label
    assert_equal "Class of 1979/1980", team.display_name
    assert_equal "final", game.status
    assert_equal 70, game.away_score
    assert_equal 68, game.home_score
    assert_equal adjusted_tipoff, game.start_time
    assert_includes game.notes, "scorer note"
    assert_includes game.notes, "phase=pool"

    DataImport::Fd2026ScheduleImport.call(overwrite: true)

    tournament.reload
    team.reload
    game.reload
    assert_equal Date.new(2026, 7, 3), tournament.start_date
    assert_equal Date.new(2026, 7, 24), tournament.end_date
    assert_equal "79/80", team.class_year_label
    assert_equal "79/80", team.display_name
    assert_equal Time.find_zone!("Pacific/Guam").local(2026, 7, 3, 18, 0), game.start_time
  end
end
