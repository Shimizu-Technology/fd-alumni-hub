require "test_helper"

class AdvanceBracketWinnerTest < ActiveSupport::TestCase
  setup do
    @tournament = Tournament.create!(
      name: "FD Bracket Test 2027",
      year: 2027,
      start_date: Date.new(2027, 6, 25),
      end_date: Date.new(2027, 7, 16),
      status: "live"
    )
    @division = @tournament.divisions.create!(name: "Maroon", position: 1)
    @team_a = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: @division)
    @team_b = @tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018", division_record: @division)
    @team_c = @tournament.teams.create!(class_year_label: "2019", display_name: "Class of 2019", division_record: @division)
    @placeholder_home = @tournament.teams.create!(class_year_label: "WMP1", display_name: "Winner MP1", division_record: @division)
    @placeholder_away = @tournament.teams.create!(class_year_label: "WMP2", display_name: "Winner MP2", division_record: @division)

    @semifinal = @tournament.games.create!(
      home_team: @placeholder_home,
      away_team: @placeholder_away,
      division_record: @division,
      phase: "playoff",
      bracket_round: "semifinal",
      bracket_slot: 1,
      start_time: Time.zone.local(2027, 7, 14, 19, 0),
      status: "scheduled",
      placeholder: true
    )

    @quarterfinal = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @division,
      phase: "playoff",
      bracket_round: "quarterfinal",
      bracket_slot: 1,
      next_game: @semifinal,
      next_game_slot: "home",
      start_time: Time.zone.local(2027, 7, 12, 19, 0),
      status: "scheduled",
      placeholder: false
    )
  end

  test "advances winner into placeholder slot, supports loser correction before tip-off, and clears placeholder once both real" do
    @quarterfinal.update!(status: "final", home_score: 72, away_score: 64)

    result = Games::AdvanceBracketWinner.call(@quarterfinal)
    assert result.advanced?
    assert_equal @team_a.id.to_s, result.winner_team_id.to_s

    @semifinal.reload
    assert_equal @team_a.id, @semifinal.home_team_id
    assert_equal @placeholder_away.id, @semifinal.away_team_id
    assert_equal true, @semifinal.placeholder?

    # Score correction flips winner to away team before semifinal tips off
    @quarterfinal.update!(home_score: 64, away_score: 72)
    corrected = Games::AdvanceBracketWinner.call(@quarterfinal)
    assert corrected.advanced?
    @semifinal.reload
    assert_equal @team_b.id, @semifinal.home_team_id

    # Second feeder fills away slot with real team -> clears placeholder on semifinal
    @semifinal.update!(away_team: @team_c)
    @quarterfinal.update!(home_score: 75, away_score: 70)
    re_advanced = Games::AdvanceBracketWinner.call(@quarterfinal)
    assert re_advanced.advanced?
    @semifinal.reload
    assert_equal @team_a.id, @semifinal.home_team_id
    assert_equal false, @semifinal.placeholder?
  end

  test "does not advance on tie, placeholder feeder, occupied non-placeholder slot, or live/final downstream game" do
    @quarterfinal.update!(status: "final", home_score: 60, away_score: 60)
    assert_equal "tied_score", Games::AdvanceBracketWinner.call(@quarterfinal).reason

    @quarterfinal.update!(home_score: 68, away_score: 60, placeholder: true)
    assert_equal "placeholder_feeder", Games::AdvanceBracketWinner.call(@quarterfinal).reason

    @quarterfinal.update!(placeholder: false)
    @semifinal.update!(home_team: @team_c)
    assert_equal "slot_occupied_by_other_team", Games::AdvanceBracketWinner.call(@quarterfinal).reason

    @semifinal.reload.update!(home_team: @placeholder_home, status: "live")
    assert_equal "next_game_not_scheduled", Games::AdvanceBracketWinner.call(@quarterfinal).reason

    @semifinal.reload.update!(status: "scheduled", away_team: @team_a)
    assert_equal "winner_already_in_opposite_slot", Games::AdvanceBracketWinner.call(@quarterfinal).reason
  end
end
