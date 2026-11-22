require "test_helper"

class RecordResultTest < ActiveSupport::TestCase
  test "trusted imports use the same validation and rollback schedule and result changes together" do
    tournament = Tournament.create!(name: "Historical import", year: 2002, status: "completed",
      start_date: Date.new(2002, 7, 1), end_date: Date.new(2002, 7, 14))
    home = tournament.teams.create!(display_name: "Red Alumni", class_year_label: "Red")
    away = tournament.teams.create!(display_name: "Gold Alumni", class_year_label: "Gold")
    game = tournament.games.create!(home_team: home, away_team: away, start_time: Time.zone.local(2002, 7, 3, 18),
      venue: "Old gym")

    failed = Games::RecordResult.call(game, { status: "final", home_score: 0 }, interactive: false,
      schedule_attributes: { venue: "New gym" })
    assert_equal 422, failed.status
    assert_equal "Old gym", game.reload.venue

    saved = Games::RecordResult.call(game, { status: "final", home_score: 0, away_score: 11 }, interactive: false,
      schedule_attributes: { venue: "New gym" }, defer_recompute: true)
    assert saved.ok?
    assert_equal tournament.id, saved.recompute_tournament.id
    assert_equal [ "New gym", 0, 11 ], game.reload.attributes.values_at("venue", "home_score", "away_score")
  end

  test "schedule preview surfaces result validation errors before commit" do
    tournament = Tournament.create!(name: "Preview validation", year: 2003, status: "upcoming",
      start_date: Date.new(2003, 7, 1), end_date: Date.new(2003, 7, 14))
    division = tournament.divisions.create!(name: "Maroon")
    preview = Imports::SchedulePreview.call(
      tournament: tournament,
      rows: [
        {
          rowIndex: 1,
          startTime: "2003-07-03T18:00:00+10:00",
          phase: "playoff",
          awayTeam: "Class of 2001",
          homeTeam: "Class of 2002",
          division: division.name,
          status: "final",
          homeScore: 40,
          awayScore: 40
        },
        {
          rowIndex: 2,
          startTime: "2003-07-03T19:00:00+10:00",
          phase: "pool",
          awayTeam: "Class of 2001",
          homeTeam: "Class of 2002",
          division: division.name,
          status: "final",
          homeScore: 50
        }
      ]
    )
    assert_equal 2, preview.dig(:summary, :errorCount)
    assert_match(/official winner/i, preview[:rows][0][:errors].join)
    assert_match(/Both home and away scores/, preview[:rows][1][:errors].join)
  end
end
