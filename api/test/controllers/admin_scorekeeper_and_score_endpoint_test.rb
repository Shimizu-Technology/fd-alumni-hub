require "test_helper"

class AdminScorekeeperAndScoreEndpointTest < ActionDispatch::IntegrationTest
  setup do
    @admin = User.create!(email: "sk-admin@example.com", clerk_id: "clerk_sk_admin", role: "admin")
    @staff = User.create!(email: "sk-staff@example.com", clerk_id: "clerk_sk_staff", role: "staff")
    @scorekeeper = User.create!(email: "sk-user@example.com", clerk_id: "clerk_sk_user", role: "scorekeeper", first_name: "Court", last_name: "Keeper")
    @viewer = User.create!(email: "sk-viewer@example.com", clerk_id: "clerk_sk_viewer", role: "viewer")

    @live_tournament = Tournament.create!(
      name: "FD Alumni 2027",
      year: 2027,
      start_date: Date.new(2027, 6, 25),
      end_date: Date.new(2027, 7, 16),
      status: "live"
    )
    @completed_tournament = Tournament.create!(
      name: "FD Alumni 2026",
      year: 2026,
      start_date: Date.new(2026, 6, 26),
      end_date: Date.new(2026, 7, 17),
      status: "completed"
    )

    @division = @live_tournament.divisions.create!(name: "Maroon", position: 1)
    @team_a = @live_tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: @division)
    @team_b = @live_tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018", division_record: @division)
    @placeholder_1 = @live_tournament.teams.create!(class_year_label: "WQF1", display_name: "Winner QF1", division_record: @division)
    @placeholder_2 = @live_tournament.teams.create!(class_year_label: "WQF2", display_name: "Winner QF2", division_record: @division)

    @pool_game = @live_tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @division,
      phase: "pool",
      start_time: Time.zone.local(2027, 6, 25, 19, 0),
      status: "scheduled"
    )

    @semifinal = @live_tournament.games.create!(
      home_team: @placeholder_1,
      away_team: @placeholder_2,
      division_record: @division,
      phase: "playoff",
      bracket_round: "semifinal",
      bracket_slot: 1,
      start_time: Time.zone.local(2027, 7, 14, 19, 0),
      status: "scheduled",
      placeholder: true
    )

    @playoff_game = @live_tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @division,
      phase: "playoff",
      bracket_round: "quarterfinal",
      bracket_slot: 1,
      next_game: @semifinal,
      next_game_slot: "home",
      start_time: Time.zone.local(2027, 7, 12, 19, 0),
      status: "scheduled"
    )

    @old_division = @completed_tournament.divisions.create!(name: "Maroon", position: 1)
    @old_team_a = @completed_tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division_record: @old_division)
    @old_team_b = @completed_tournament.teams.create!(class_year_label: "2015", display_name: "Class of 2015", division_record: @old_division)
    @old_game = @completed_tournament.games.create!(
      home_team: @old_team_a,
      away_team: @old_team_b,
      division_record: @old_division,
      phase: "pool",
      start_time: Time.zone.local(2026, 6, 26, 19, 0),
      status: "scheduled"
    )
  end

  test "scorekeeper least-privilege deny matrix allows only tournament/game reads and score endpoint" do
    # Allowed endpoints
    get "/api/v1/admin/tournaments", headers: headers_for(@scorekeeper)
    assert_response :success

    get "/api/v1/admin/tournaments/#{@live_tournament.id}", headers: headers_for(@scorekeeper)
    assert_response :success

    get "/api/v1/admin/games", params: { tournamentId: @live_tournament.id }, headers: headers_for(@scorekeeper)
    assert_response :success

    get "/api/v1/admin/games/#{@pool_game.id}", headers: headers_for(@scorekeeper)
    assert_response :success

    # Denied endpoints (comprehensive deny matrix)
    denied_requests = [
      [ :get, "/api/v1/admin/dashboard" ],
      [ :post, "/api/v1/admin/tournaments" ],
      [ :patch, "/api/v1/admin/tournaments/#{@live_tournament.id}" ],
      [ :post, "/api/v1/admin/tournaments/setup" ],
      [ :post, "/api/v1/admin/tournaments/#{@live_tournament.id}/recompute-standings" ],
      [ :post, "/api/v1/admin/tournaments/#{@live_tournament.id}/schedule-import/preview" ],
      [ :post, "/api/v1/admin/tournaments/#{@live_tournament.id}/schedule-import/commit" ],
      [ :post, "/api/v1/admin/tournaments/#{@live_tournament.id}/roster-import/preview" ],
      [ :post, "/api/v1/admin/tournaments/#{@live_tournament.id}/roster-import/commit" ],
      [ :post, "/api/v1/admin/games" ],
      [ :patch, "/api/v1/admin/games/#{@pool_game.id}" ],
      [ :get, "/api/v1/admin/divisions" ],
      [ :get, "/api/v1/admin/teams" ],
      [ :get, "/api/v1/admin/class-cohorts" ],
      [ :get, "/api/v1/admin/game-day-notes" ],
      [ :get, "/api/v1/admin/alerts" ],
      [ :post, "/api/v1/admin/alerts" ],
      [ :get, "/api/v1/admin/prediction-polls" ],
      [ :get, "/api/v1/admin/articles" ],
      [ :get, "/api/v1/admin/media-assets" ],
      [ :get, "/api/v1/admin/sponsors" ],
      [ :get, "/api/v1/admin/links" ],
      [ :get, "/api/v1/admin/missing-links" ],
      [ :patch, "/api/v1/admin/links/bulk" ],
      [ :get, "/api/v1/admin/standings" ],
      [ :post, "/api/v1/admin/standings/recompute" ],
      [ :get, "/api/v1/admin/campaigns" ],
      [ :get, "/api/v1/admin/whitelists" ],
      [ :get, "/api/v1/admin/content-ingest-items" ]
    ]

    denied_requests.each do |verb, path|
      send(verb, path, headers: headers_for(@scorekeeper), as: :json)
      assert_response :forbidden, "Expected 403 Forbidden for scorekeeper on #{verb.upcase} #{path}, got #{response.status}"
    end

    # Viewer cannot call score endpoint
    patch "/api/v1/admin/games/#{@pool_game.id}/score",
      params: { homeScore: 10, awayScore: 8, status: "live" },
      headers: headers_for(@viewer),
      as: :json
    assert_response :forbidden
  end

  test "score endpoint enforces live-only recompute skip, final recompute, digest idempotency, conflict detection, and scorekeeper guardrails" do
    # 1. Live score update: succeeds, records score_updated_by, does NOT recompute standings
    live_mutation = "mut_live_0001"
    patch "/api/v1/admin/games/#{@pool_game.id}/score",
      params: {
        homeScore: 24,
        awayScore: 20,
        status: "live",
        lockVersion: @pool_game.lock_version,
        clientMutationId: live_mutation
      },
      headers: headers_for(@scorekeeper),
      as: :json
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal false, body["idempotentReplay"]
    assert_nil body["recompute"]
    assert_equal "Court Keeper", body.dig("game", "scoreUpdatedByName")
    assert_equal 0, Standing.where(tournament: @live_tournament).count

    # 2. Exact idempotent replay with stale lockVersion returns 200 idempotentReplay: true
    patch "/api/v1/admin/games/#{@pool_game.id}/score",
      params: {
        homeScore: 24,
        awayScore: 20,
        status: "live",
        lockVersion: 0,
        clientMutationId: live_mutation
      },
      headers: headers_for(@scorekeeper),
      as: :json
    assert_response :success
    assert_equal true, JSON.parse(response.body)["idempotentReplay"]

    # 3. Reusing the same mutation ID with a different payload returns 409 Conflict
    patch "/api/v1/admin/games/#{@pool_game.id}/score",
      params: {
        homeScore: 26,
        awayScore: 20,
        status: "live",
        lockVersion: @pool_game.reload.lock_version,
        clientMutationId: live_mutation
      },
      headers: headers_for(@scorekeeper),
      as: :json
    assert_response :conflict
    assert_includes JSON.parse(response.body)["error"], "different score payload"

    # 4. Stale lockVersion with a new mutation ID returns 409 Conflict with currentGame
    patch "/api/v1/admin/games/#{@pool_game.id}/score",
      params: {
        homeScore: 30,
        awayScore: 22,
        status: "live",
        lockVersion: 0,
        clientMutationId: "mut_stale_0002"
      },
      headers: headers_for(@scorekeeper),
      as: :json
    assert_response :conflict
    assert_equal 24, JSON.parse(response.body).dig("currentGame", "homeScore")

    # 5. Finalizing without scores fails 422
    patch "/api/v1/admin/games/#{@pool_game.id}/score",
      params: {
        homeScore: nil,
        awayScore: nil,
        status: "final",
        lockVersion: @pool_game.reload.lock_version,
        clientMutationId: "mut_bad_final"
      },
      headers: headers_for(@scorekeeper),
      as: :json
    assert_response :unprocessable_entity

    # 6. Finalizing pool game succeeds and triggers Standings::Recompute
    final_mutation = "mut_final_0003"
    patch "/api/v1/admin/games/#{@pool_game.id}/score",
      params: {
        homeScore: 78,
        awayScore: 69,
        status: "final",
        lockVersion: @pool_game.reload.lock_version,
        clientMutationId: final_mutation
      },
      headers: headers_for(@scorekeeper),
      as: :json
    assert_response :success
    final_body = JSON.parse(response.body)
    assert_equal 1, final_body.dig("recompute", "games")

    # 7. Exact idempotent replay of the finalize mutation STILL returns 200 OK for scorekeeper
    patch "/api/v1/admin/games/#{@pool_game.id}/score",
      params: {
        homeScore: 78,
        awayScore: 69,
        status: "final",
        lockVersion: 0,
        clientMutationId: final_mutation
      },
      headers: headers_for(@scorekeeper),
      as: :json
    assert_response :success
    assert_equal true, JSON.parse(response.body)["idempotentReplay"]

    # 8. Scorekeeper CANNOT reopen or overwrite an already-finalized game (even with forceOverwrite)
    patch "/api/v1/admin/games/#{@pool_game.id}/score",
      params: {
        homeScore: 80,
        awayScore: 69,
        status: "live",
        forceOverwrite: true,
        clientMutationId: "mut_reopen_0004"
      },
      headers: headers_for(@scorekeeper),
      as: :json
    assert_response :forbidden

    # 9. Staff CAN correct an already-finalized game with forceOverwrite
    patch "/api/v1/admin/games/#{@pool_game.id}/score",
      params: {
        homeScore: 80,
        awayScore: 69,
        status: "final",
        forceOverwrite: true,
        clientMutationId: "mut_staff_fix_0005"
      },
      headers: headers_for(@staff),
      as: :json
    assert_response :success
    assert_equal 80, @pool_game.reload.home_score

    # 10. Scorekeeper CANNOT score games in completed tournaments
    patch "/api/v1/admin/games/#{@old_game.id}/score",
      params: {
        homeScore: 50,
        awayScore: 45,
        status: "live",
        lockVersion: @old_game.lock_version,
        clientMutationId: "mut_old_tourn_0006"
      },
      headers: headers_for(@scorekeeper),
      as: :json
    assert_response :forbidden

    # 11. Finalizing playoff game via /score advances winner in bracket
    patch "/api/v1/admin/games/#{@playoff_game.id}/score",
      params: {
        homeScore: 84,
        awayScore: 79,
        status: "final",
        lockVersion: @playoff_game.lock_version,
        clientMutationId: "mut_playoff_0007"
      },
      headers: headers_for(@scorekeeper),
      as: :json
    assert_response :success
    assert_equal true, JSON.parse(response.body).dig("bracketAdvancement", "advanced")
    assert_equal @team_a.id, @semifinal.reload.home_team_id
  end

  test "score endpoint recovers StaleObjectError as 200 idempotentReplay when concurrent duplicate committed" do
    mutation_id = "mut_race_0008"
    digest = Digest::SHA256.hexdigest({ awayScore: 15, homeScore: 18, status: "live", statusNote: nil }.to_json)

    # Simulate a concurrent commit that already saved the exact same mutation right before save!
    original_save = Game.instance_method(:save)
    Game.define_method(:save) do |*args, **kwargs|
      Game.where(id: id).update_all(
        home_score: 18,
        away_score: 15,
        status: "live",
        last_score_mutation_id: mutation_id,
        last_score_mutation_digest: digest,
        lock_version: lock_version + 1
      )
      raise ActiveRecord::StaleObjectError.new(self, "update")
    end

    begin
      patch "/api/v1/admin/games/#{@pool_game.id}/score",
        params: {
          homeScore: 18,
          awayScore: 15,
          status: "live",
          lockVersion: @pool_game.lock_version,
          clientMutationId: mutation_id
        },
        headers: headers_for(@scorekeeper),
        as: :json
      assert_response :success
      body = JSON.parse(response.body)
      assert_equal true, body["idempotentReplay"]
      assert_equal 18, body.dig("game", "homeScore")
    ensure
      Game.define_method(:save, original_save)
    end
  end

  test "admin whitelist allows creating and syncing scorekeeper users" do
    post "/api/v1/admin/whitelists",
      params: { whitelist: { email: "new-keeper@example.com", role: "scorekeeper", notes: "Court 1" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :created
    assert_equal "scorekeeper", JSON.parse(response.body).dig("whitelist", "role")
  end

  private

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
