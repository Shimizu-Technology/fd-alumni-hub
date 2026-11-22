require "test_helper"

class AdminGymResultsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @tournament = Tournament.create!(name: "Gym results", year: 2031, status: "live",
      start_date: Date.new(2031, 7, 1), end_date: Date.new(2031, 7, 14))
    @division = @tournament.divisions.create!(name: "Maroon")
    @home = @tournament.teams.create!(display_name: "Home alumni", class_year_label: "Alumni A", division_record: @division)
    @away = @tournament.teams.create!(display_name: "Away alumni", class_year_label: "Alumni B", division_record: @division)
    @keeper = User.create!(email: "gym-keeper@example.test", clerk_id: "gym-keeper", role: "scorekeeper")
    @other_keeper = User.create!(email: "other-keeper@example.test", clerk_id: "other-keeper", role: "scorekeeper")
    @staff = User.create!(email: "gym-staff@example.test", clerk_id: "gym-staff", role: "staff")
    @game = create_game
  end

  test "blank stays blank, zero is preserved and overtime finals are published" do
    score(@game, homeScore: "", awayScore: "0", status: "final")
    assert_response :unprocessable_entity
    assert_nil @game.reload.away_score

    score(@game, homeScore: "", awayScore: "0", status: "live")
    assert_response :success
    assert_nil body.dig("game", "homeScore")
    assert_equal 0, body.dig("game", "awayScore")
    assert_equal "skipped", body["standingsStatus"]

    score(@game, homeScore: "17", awayScore: 0, status: "final", resultOutcome: "overtime")
    assert_response :success
    assert_equal "overtime", body.dig("game", "resultOutcome")
    assert_equal "updated", body["standingsStatus"]
    assert_equal "score_recorded", latest_game_audit.action
    assert_equal @keeper.id, latest_game_audit.actor_id
  end

  test "invalid numeric types, outcomes and placeholder score writes are rejected" do
    [ -1, 301, 1.5, "3.0", [ 2 ], true ].each do |invalid|
      score(@game, homeScore: invalid, awayScore: 5, status: "live")
      assert_response :unprocessable_entity
    end
    score(@game, resultOutcome: "unknown")
    assert_response :unprocessable_entity
    @game.update!(placeholder: true)
    score(@game, homeScore: 5, awayScore: 0, status: "final")
    assert_response :unprocessable_entity
    assert_match(/placeholder/, body.fetch("errors").join)
    assert_nil @game.reload.home_score
  end

  test "forfeits have a winner without points and stopped games can carry a public note and new Guam time" do
    score(@game, status: "final", resultOutcome: "forfeit")
    assert_response :unprocessable_entity
    score(@game, status: "final", resultOutcome: "forfeit", officialWinnerTeamId: @away.id)
    assert_response :success
    standings = @tournament.standings.index_by(&:team_id)
    assert_equal [ 1, 0, 0 ], standings.fetch(@away.id).attributes.values_at("wins", "points_for", "points_against")
    assert_equal 1, standings.fetch(@home.id).losses
    assert_nil body.dig("game", "homeScore")

    score(@game, user: @staff, resultOutcome: "postponed", statusNote: "Court unavailable", reason: "Incorrect forfeit",
      startTime: "2031-07-09T18:00:00+10:00")
    assert_response :success
    assert_equal "postponed", body.dig("game", "status")
    assert_equal "Court unavailable", body.dig("game", "statusNote")
    assert_equal Time.zone.local(2031, 7, 9, 18), @game.reload.start_time
    assert_nil @game.official_winner_team_id
    assert_equal 0, standings.fetch(@away.id).reload.wins

    score(@game, status: "cancelled", statusNote: "Gym closed")
    assert_response :success
    assert_equal "cancelled", body.dig("game", "resultOutcome")
  end

  test "durable replay survives new results and is isolated by both actor and game" do
    first = { homeScore: 0, status: "live", clientMutationId: "first-attempt", lockVersion: @game.lock_version }
    score(@game, **first)
    assert_response :success
    score(@game, user: @other_keeper, **first.merge(homeScore: 7, lockVersion: @game.reload.lock_version))
    assert_response :success
    score(create_game, **first)
    assert_response :success
    score(@game, homeScore: 20, awayScore: 13, status: "final")
    assert_response :success

    score(@game, **first.merge(homeScore: "0"))
    assert_response :success
    assert_equal true, body["idempotentReplay"]
    assert_equal 20, body.dig("game", "homeScore")
    assert_equal 3, ScoreMutation.where(client_mutation_id: "first-attempt").count
    score(@game, **first.merge(homeScore: 9))
    assert_response :conflict
    assert_equal "Mutation ID reused with different score payload.", body["error"]
    assert_equal 20, body.dig("currentGame", "homeScore")
  end

  test "force requires a staff correction reason and final audit captures it" do
    score(@game, forceOverwrite: true, homeScore: 0)
    assert_response :forbidden
    @game.update!(status: "final", home_score: 7, away_score: 0)
    score(@game, user: @staff, homeScore: 9)
    assert_response :unprocessable_entity
    score(@game, user: @staff, homeScore: 9, forceOverwrite: true)
    assert_response :forbidden
    score(@game, user: @staff, homeScore: 9, reason: "Check official book")
    assert_response :success
    assert_equal "score_corrected", latest_game_audit.action
    assert_equal "Check official book", latest_game_audit.reason
  end

  test "batch applies successful rows independently and recomputes a pool tournament once" do
    second = create_game
    rejected = create_game
    rows = [
      row(@game, 20, 0).merge(clientMutationId: "night-first"),
      row(second, 12, 15).merge(clientMutationId: "night-second"),
      row(rejected, "", 0),
      "malformed"
    ]
    recompute = Standings::Recompute.method(:call)
    calls = []
    with_recompute(->(tournament) { calls << tournament.id; recompute.call(tournament) }) do
      post "/api/v1/admin/games/batch-results", params: { tournamentId: @tournament.id, results: rows }, headers: headers(@keeper), as: :json
      assert_response :success
      assert_equal [ 200, 200, 422, 404 ], body["results"].pluck("status")
      assert_equal "updated", body["standingsStatus"]
      assert_equal({ "teams" => 2, "games" => 2 }, body["recompute"])
      assert_equal [ @tournament.id ], calls
      assert_equal "scheduled", rejected.reload.status
    end
  end

  test "standings failures leave score and replay record committed" do
    failure = ->(*) { raise "forced standings failure" }
    with_recompute(failure) do
      score(@game, homeScore: 11, awayScore: 0, status: "final", clientMutationId: "stored-result")
      assert_response :success
      assert_equal "failed", body["standingsStatus"]
      assert_equal 11, @game.reload.home_score
      assert_equal 1, ScoreMutation.where(game: @game).count
    end
  end

  test "official shootout winner advances and changing or reopening the feeder flags a started matchup" do
    opponent = @tournament.teams.create!(display_name: "Other alumni", class_year_label: "Alumni C", division_record: @division)
    placeholder = @tournament.teams.create!(display_name: "Winner Q1", class_year_label: "Winner Q1", division_record: @division)
    target = create_game(home_team: placeholder, away_team: opponent, phase: "playoff", bracket_round: "final",
      start_time: Time.zone.local(2031, 7, 10, 19), placeholder: true)
    @game.update!(phase: "playoff", bracket_round: "semifinal", next_game: target, next_game_slot: "home")
    score(@game, homeScore: 30, awayScore: 30, status: "final", resultOutcome: "shootout")
    assert_response :unprocessable_entity
    score(@game, homeScore: 30, awayScore: 30, status: "final", resultOutcome: "shootout", officialWinnerTeamId: @home.id)
    assert_response :success
    assert_equal @home.id, target.reload.home_team_id
    target.update!(status: "live")

    score(@game, user: @staff, officialWinnerTeamId: @away.id, reason: "Official shootout correction")
    assert_response :success
    assert_equal true, body.dig("bracketAdvancement", "needsReview")
    assert_equal target.id.to_s, body.dig("bracketAdvancement", "affectedNextGame", "id")
    assert_equal @home.id, target.reload.home_team_id
    assert target.bracket_needs_review?

    patch "/api/v1/admin/games/#{target.id}/resolve-bracket-review", headers: headers(@keeper), as: :json
    assert_response :forbidden
    patch "/api/v1/admin/games/#{target.id}/resolve-bracket-review", params: { note: "Confirmed lineup" }, headers: headers(@staff), as: :json
    assert_response :success
    assert_not target.reload.bracket_needs_review?
    score(@game, user: @staff, resultOutcome: "cancelled", reason: "Game must be replayed")
    assert_response :success
    assert target.reload.bracket_needs_review?
  end

  test "official winner cannot contradict unequal scores, clears on non-tie correction, and guards father-son bracket ties" do
    opponent = @tournament.teams.create!(display_name: "Other alumni", class_year_label: "Alumni C", division_record: @division)
    placeholder = @tournament.teams.create!(display_name: "Winner FS1", class_year_label: "Winner FS1", division_record: @division)
    target = create_game(home_team: placeholder, away_team: opponent, phase: "fatherson",
      start_time: Time.zone.local(2031, 7, 10, 19), placeholder: true)
    @game.update!(phase: "fatherson", next_game: target, next_game_slot: "home")

    # Father-son feeder tie requires an official winner
    score(@game, homeScore: 40, awayScore: 40, status: "final")
    assert_response :unprocessable_entity

    # Contradicting shootout winner on unequal scores is rejected
    score(@game, homeScore: 42, awayScore: 40, status: "final", resultOutcome: "shootout", officialWinnerTeamId: @away.id)
    assert_response :unprocessable_entity
    assert_match(/Official winner must match the higher score/, body.fetch("errors").join)

    # Save tied final with Away as official winner, then correct to 42-40 without passing officialWinnerTeamId
    score(@game, homeScore: 40, awayScore: 40, status: "final", resultOutcome: "shootout", officialWinnerTeamId: @away.id)
    assert_response :success
    assert_equal @away.id, target.reload.home_team_id

    score(@game, user: @staff, homeScore: 42, awayScore: 40, status: "final", reason: "Fixed scorebook typo")
    assert_response :success
    assert_nil @game.reload.official_winner_team_id
    assert_equal @home.id, @game.winner_team_id
    assert_equal @home.id, target.reload.home_team_id
  end

  test "approving a stale correction request returns conflict when the game changed meanwhile" do
    @game.update!(status: "final", home_score: 40, away_score: 21)
    post "/api/v1/admin/games/#{@game.id}/correction-requests",
      params: { homeScore: 45, awayScore: 21, status: "final", reason: "Table correction" },
      headers: headers(@keeper), as: :json
    assert_response :created
    req_id = body.dig("correctionRequest", "id")

    score(@game, user: @staff, homeScore: 42, awayScore: 21, reason: "Official book check")
    assert_response :success

    post "/api/v1/admin/score-correction-requests/#{req_id}/approve", headers: headers(@staff), as: :json
    assert_response :conflict
    assert_equal 42, @game.reload.home_score
    assert_equal "pending", ScoreCorrectionRequest.find(req_id).status
  end

  test "bracket advancement failure keeps the score committed and flags feeder for review" do
    opponent = @tournament.teams.create!(display_name: "Other alumni", class_year_label: "Alumni C", division_record: @division)
    placeholder = @tournament.teams.create!(display_name: "Winner Q2", class_year_label: "Winner Q2", division_record: @division)
    target = create_game(home_team: placeholder, away_team: opponent, phase: "playoff", bracket_round: "final",
      start_time: Time.zone.local(2031, 7, 10, 19), placeholder: true)
    @game.update!(phase: "playoff", bracket_round: "semifinal", next_game: target, next_game_slot: "home")

    original = Games::AdvanceBracketWinner.method(:call)
    Games::AdvanceBracketWinner.define_singleton_method(:call) { |*, **| raise ActiveRecord::RecordInvalid.new(target) }
    begin
      score(@game, homeScore: 55, awayScore: 48, status: "final")
      assert_response :success
      assert_equal 55, @game.reload.home_score
      assert_equal "final", @game.status
      assert @game.bracket_needs_review?
      assert_equal "advancement_failed", body.dig("bracketAdvancement", "reason")
      assert_equal true, body.dig("bracketAdvancement", "needsReview")
    ensure
      Games::AdvanceBracketWinner.define_singleton_method(:call, original)
    end
  end

  test "volunteers see their own correction requests and staff can approve and reject" do
    @game.update!(status: "final", home_score: 40, away_score: 21)
    path = "/api/v1/admin/games/#{@game.id}/correction-requests"
    proposal = { homeScore: 45, awayScore: 21, status: "final", resultOutcome: "overtime", reason: "Verified with table" }
    post path, params: proposal.merge(reason: " "), headers: headers(@keeper), as: :json
    assert_response :unprocessable_entity
    post path, params: proposal, headers: headers(@keeper), as: :json
    assert_response :created
    first = body.dig("correctionRequest", "id")
    post path, params: proposal.merge(homeScore: 41), headers: headers(@other_keeper), as: :json
    assert_response :created
    second = body.dig("correctionRequest", "id")
    listing = "/api/v1/admin/score-correction-requests?tournamentId=#{@tournament.id}&status=pending"
    get listing, headers: headers(@keeper)
    assert_response :success
    assert_equal [ first ], body["correctionRequests"].pluck("id")
    get listing, headers: headers(@staff)
    assert_response :success
    assert_equal [ second, first ], body["correctionRequests"].pluck("id")

    post "/api/v1/admin/score-correction-requests/#{first}/approve", headers: headers(@keeper), as: :json
    assert_response :forbidden
    post "/api/v1/admin/score-correction-requests/#{first}/approve", headers: headers(@staff), as: :json
    assert_response :success
    assert_equal "approved", body.dig("correctionRequest", "status")
    assert_equal 45, @game.reload.home_score
    assert_equal "score_corrected", latest_game_audit.action
    assert_equal "Approved correction request ##{first}: Verified with table", latest_game_audit.reason
    assert_equal @staff.id, latest_game_audit.actor_id

    post "/api/v1/admin/score-correction-requests/#{second}/reject", params: { resolutionNote: "Checked final book" }, headers: headers(@staff), as: :json
    assert_response :success
    assert_equal "Checked final book", ScoreCorrectionRequest.find(second).resolution_note
    event = AuditEvent.where(record_type: "ScoreCorrectionRequest", record_id: second).last
    assert_equal [ "correction_rejected", "results", @tournament.id ], [ event.action, event.area, event.tournament_id ]
  end

  test "Guam day filter respects midnight, lists future active nights and validates dates" do
    @game.update!(start_time: Time.iso8601("2031-07-03T14:00:00Z"))
    yesterday = create_game(start_time: Time.iso8601("2031-07-03T13:59:59Z"))
    completed = create_game(start_time: Time.zone.local(2031, 7, 5, 20), status: "final", home_score: 0, away_score: 15)
    next_game = create_game(start_time: Time.zone.local(2031, 7, 6, 18), status: "delayed")
    path = "/api/v1/admin/games?tournamentId=#{@tournament.id}"
    get "#{path}&date=2031-07-04", headers: headers(@keeper)
    assert_response :success
    assert_equal [ @game.id.to_s ], body["games"].pluck("id")
    assert_equal "2031-07-04", body["requestedDate"]
    assert_equal "2031-07-06", body["nextScheduledDate"]
    assert_equal %w[2031-07-03 2031-07-04 2031-07-05 2031-07-06], body["availableDates"]
    get "#{path}&unscoredOnly=true", headers: headers(@keeper)
    assert_response :success
    assert_equal [ yesterday, @game, next_game ].map { |game| game.id.to_s }, body["games"].pluck("id")
    assert_not_includes body["games"].pluck("id"), completed.id.to_s
    get "#{path}&date=2031-02-30", headers: headers(@keeper)
    assert_response :unprocessable_entity
  end

  private

  def with_recompute(implementation)
    original = Standings::Recompute.method(:call)
    Standings::Recompute.define_singleton_method(:call, implementation)
    yield
  ensure
    Standings::Recompute.define_singleton_method(:call, original)
  end

  def create_game(**attrs)
    @tournament.games.create!(**{ home_team: @home, away_team: @away, division_record: @division,
      start_time: Time.zone.local(2031, 7, 3, 18) }.merge(attrs))
  end

  def score(game, user: @keeper, **attrs)
    patch "/api/v1/admin/games/#{game.id}/score", params: { lockVersion: game.reload.lock_version }.merge(attrs),
      headers: headers(user), as: :json
  end

  def row(game, home, away)
    { gameId: game.id.to_s, homeScore: home, awayScore: away, status: "final", lockVersion: game.lock_version }
  end

  def latest_game_audit
    AuditEvent.where(record_type: "Game", record_id: @game.id.to_s).last
  end

  def body
    response.parsed_body
  end

  def headers(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
