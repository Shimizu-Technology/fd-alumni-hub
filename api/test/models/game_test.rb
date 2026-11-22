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
    @maroon = @tournament.divisions.create!(name: "Maroon", position: 1)
    @special = @tournament.divisions.create!(name: "Special", position: 4, counts_for_standings: false)
    @team = @tournament.teams.create!(class_year_label: "TBD", display_name: "Class TBD", division_record: @special)
    @team_a = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division_record: @maroon)
    @team_b = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: @maroon)
    @team_c = @tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018", division_record: @maroon)
  end

  test "validates https urls on change while preserving unrelated saves on legacy rows" do
    bad_game = @tournament.games.build(
      home_team: @team_a,
      away_team: @team_b,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "scheduled",
      ticket_url: "http://guamtime.net/tickets/fd",
      stream_url: "javascript:alert(1)"
    )
    assert_not bad_game.valid?
    assert_includes bad_game.errors[:ticket_url], "must be a valid https:// URL"
    assert_includes bad_game.errors[:stream_url], "must be a valid https:// URL"

    game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "scheduled",
      ticket_url: "https://guamtime.net/tickets/fd",
      stream_url: "https://clutchguam.com/live/fd"
    )
    assert_equal "https://guamtime.net/tickets/fd", game.api_json[:ticketUrl]
    assert_equal "https://clutchguam.com/live/fd", game.api_json[:streamUrl]

    # Simulate an untouched legacy invalid URL in the DB: score update must still succeed and api_json fails closed.
    game.update_column(:stream_url, "javascript:alert(1)")
    assert game.reload.update(status: "final", home_score: 70, away_score: 65)
    assert_nil game.api_json[:streamUrl]
  end

  test "allows explicitly marked placeholder games with the same team" do
    game = @tournament.games.build(
      home_team: @team,
      away_team: @team,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "scheduled",
      placeholder: true
    )

    assert game.valid?
  end

  test "rejects unmarked scheduled same-team games" do
    game = @tournament.games.build(
      home_team: @team,
      away_team: @team,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "scheduled"
    )

    assert_not game.valid?
    assert_includes game.errors[:away_team_id], "must be different from home team"
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

  test "enforces game_number uniqueness per tournament case-insensitively" do
    @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      game_number: "G1"
    )
    duplicate = @tournament.games.build(
      home_team: @team_a,
      away_team: @team_c,
      start_time: Time.zone.local(2026, 7, 4, 18, 0),
      game_number: "g1"
    )
    assert_not duplicate.valid?
    assert_includes duplicate.errors[:game_number], "has already been taken"
  end

  test "enforces bracket next_game phase, slot uniqueness, cycle detection, and depth limit" do
    pool_game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @maroon,
      phase: "pool",
      start_time: Time.zone.local(2026, 7, 3, 18, 0)
    )
    semifinal = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @maroon,
      phase: "playoff",
      bracket_round: "semifinal",
      bracket_slot: 1,
      start_time: Time.zone.local(2026, 7, 20, 18, 0)
    )
    final_game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_c,
      division_record: @maroon,
      phase: "playoff",
      bracket_round: "final",
      bracket_slot: 1,
      start_time: Time.zone.local(2026, 7, 24, 19, 0)
    )

    # Cannot wire into a pool game
    bad_target = @tournament.games.build(
      home_team: @team_b,
      away_team: @team_c,
      division_record: @maroon,
      phase: "playoff",
      start_time: Time.zone.local(2026, 7, 19, 18, 0),
      next_game: pool_game,
      next_game_slot: "home"
    )
    assert_not bad_target.valid?
    assert_includes bad_target.errors[:next_game_id], "must target a playoff or father-son bracket game"

    # Wire semifinal -> final (home)
    assert semifinal.update(next_game: final_game, next_game_slot: "home")

    # Duplicate slot into same next_game rejected
    competing_feeder = @tournament.games.build(
      home_team: @team_b,
      away_team: @team_c,
      division_record: @maroon,
      phase: "playoff",
      start_time: Time.zone.local(2026, 7, 20, 20, 0),
      next_game: final_game,
      next_game_slot: "home"
    )
    assert_not competing_feeder.valid?
    assert_includes competing_feeder.errors[:next_game_slot], "is already fed by another game"

    # Cycle rejected (final -> semifinal)
    final_game.next_game = semifinal
    final_game.next_game_slot = "away"
    assert_not final_game.valid?
    assert_includes final_game.errors[:next_game_id], "creates a bracket cycle"
  end

  test "rejects bracket chains exceeding MAX_BRACKET_DEPTH hops" do
    chain = []
    (Game::MAX_BRACKET_DEPTH + 1).times do |i|
      chain << @tournament.games.create!(
        home_team: @team_a,
        away_team: @team_b,
        division_record: @maroon,
        phase: "playoff",
        start_time: Time.zone.local(2026, 7, 10 + i, 18, 0)
      )
    end

    # Link chain[1] -> chain[2] -> ... -> chain[MAX_BRACKET_DEPTH] (MAX_BRACKET_DEPTH - 1 hops)
    (1...(chain.length - 1)).each do |i|
      chain[i].update!(next_game: chain[i + 1], next_game_slot: "home")
    end

    # Adding one more hop at the front makes chain[0] have MAX_BRACKET_DEPTH hops (8) — allowed?
    # Walk from chain[0]: chain[1] (1), chain[2] (2), ..., chain[8] (8) -> allowed (8 <= 8)
    assert chain[0].update(next_game: chain[1], next_game_slot: "home")

    # One more game prepended would be 9 hops > MAX_BRACKET_DEPTH -> rejected!
    too_deep = @tournament.games.build(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @maroon,
      phase: "playoff",
      start_time: Time.zone.local(2026, 7, 9, 18, 0),
      next_game: chain[0],
      next_game_slot: "home"
    )
    assert_not too_deep.valid?
    assert_includes too_deep.errors[:next_game_id], "exceeds maximum bracket depth (#{Game::MAX_BRACKET_DEPTH})"
  end

  test "validates last_score_mutation_id format" do
    game = @tournament.games.build(
      home_team: @team_a,
      away_team: @team_b,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      last_score_mutation_id: "bad id!"
    )
    assert_not game.valid?
    assert game.errors[:last_score_mutation_id].any?

    game.last_score_mutation_id = "mut_12345678-abcd"
    assert game.valid?
  end

  test "destroying a bracket target game or its tournament cleanly clears feeder links without check violations" do
    semifinal = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @maroon,
      phase: "playoff",
      bracket_round: "semifinal",
      bracket_slot: 1,
      start_time: Time.zone.local(2026, 7, 20, 18, 0)
    )
    final_game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_c,
      division_record: @maroon,
      phase: "playoff",
      bracket_round: "final",
      bracket_slot: 1,
      start_time: Time.zone.local(2026, 7, 24, 19, 0)
    )
    semifinal.update!(next_game: final_game, next_game_slot: "home")

    assert_nothing_raised { final_game.destroy! }
    semifinal.reload
    assert_nil semifinal.next_game_id
    assert_nil semifinal.next_game_slot

    # Also verify DB-level ON DELETE SET NULL on next_game_id satisfies the check constraint
    final_game_2 = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_c,
      division_record: @maroon,
      phase: "playoff",
      bracket_round: "final",
      bracket_slot: 1,
      start_time: Time.zone.local(2026, 7, 24, 19, 0)
    )
    semifinal.update!(next_game: final_game_2, next_game_slot: "away")
    assert_nothing_raised { Game.where(id: final_game_2.id).delete_all }
    assert_nil semifinal.reload.next_game_id
  end

  test "explicit phase pool is not overridden by bracket code and scoreUpdatedByName is admin-only" do
    staff = User.create!(email: "staff-audit@example.com", clerk_id: "clerk_staff_audit", first_name: "Pat", last_name: "Cruz", role: "staff")
    game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @maroon,
      phase: "pool",
      bracket_code: "F1",
      start_time: Time.zone.local(2026, 7, 4, 18, 0),
      score_updated_by: staff
    )
    assert_equal "pool", game.phase
    assert_not game.api_json.key?(:scoreUpdatedByName)
    assert_equal "Pat Cruz", game.api_json(include_score_audit: true)[:scoreUpdatedByName]
  end

  test "deactivating a division does not block score updates on existing games" do
    game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @maroon,
      start_time: Time.zone.local(2026, 7, 5, 18, 0),
      status: "scheduled"
    )
    @maroon.update!(active: false)
    assert game.reload.update(status: "final", home_score: 65, away_score: 60)
  end
end
