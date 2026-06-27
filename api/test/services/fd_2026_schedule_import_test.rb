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

  test "does not overwrite scores or status on later seed runs" do
    DataImport::Fd2026ScheduleImport.call
    game = Game.find_by!(legacy_id: "fd-2026-schedule-1")
    adjusted_tipoff = Time.find_zone!("Pacific/Guam").local(2026, 7, 3, 18, 10)
    game.update!(status: "final", away_score: 70, home_score: 68, start_time: adjusted_tipoff, notes: "phase=pool; scorer note")

    DataImport::Fd2026ScheduleImport.call

    game.reload
    assert_equal "final", game.status
    assert_equal 70, game.away_score
    assert_equal 68, game.home_score
    assert_equal adjusted_tipoff, game.start_time
    assert_includes game.notes, "scorer note"
    assert_includes game.notes, "phase=pool"

    DataImport::Fd2026ScheduleImport.call(overwrite: true)

    assert_equal Time.find_zone!("Pacific/Guam").local(2026, 7, 3, 18, 0), game.reload.start_time
  end
end
