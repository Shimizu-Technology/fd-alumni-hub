require "test_helper"

class GameTest < ActiveSupport::TestCase
  setup do
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "live"
    )
    @team = @tournament.teams.create!(class_year_label: "TBD", display_name: "Class TBD", division: "Special")
  end

  test "allows scheduled unscored placeholder games with the same team" do
    game = @tournament.games.build(
      home_team: @team,
      away_team: @team,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "scheduled"
    )

    assert game.valid?
  end

  test "rejects scored same-team games" do
    game = @tournament.games.build(
      home_team: @team,
      away_team: @team,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "final",
      home_score: 1,
      away_score: 0
    )

    assert_not game.valid?
    assert_includes game.errors[:away_team_id], "must be different from home team"
  end
end
