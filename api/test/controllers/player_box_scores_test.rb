require "test_helper"

class PlayerBoxScoresTest < ActionDispatch::IntegrationTest
  setup do
    @tournament = Tournament.create!(name: "Stats", year: 2034, status: "live", start_date: "2034-07-01",
      end_date: "2034-07-14", enable_player_stats: true, schedule_published_at: Time.current)
    @division = @tournament.divisions.create!(name: "Maroon")
    @home = team(@tournament, "Home")
    @away = team(@tournament, "Away")
    @home_player = @home.roster_entries.create!(name: "Home Player", jersey_number: "7")
    @away_player = @away.roster_entries.create!(name: "Away Player")
    @inactive = @away.roster_entries.create!(name: "Inactive", active: false)
    @game = create_game
    @keeper = user("keeper")
    @publisher = user("publisher")
    @staff = user("staff", role: "staff")
    grant(@keeper, @tournament, "edit")
    grant(@publisher, @tournament, "publish_stats")
  end

  test "admin drafts preserve deliberate zeros and blank values and write an attributed audit event without changing scores" do
    Standings::Recompute.call(@tournament)
    standings = @tournament.standings.reload.map(&:attributes)
    save_box(entries: [ line(@home_player, points: "0", rebounds: "", assists: nil, threePointersMade: "0", notes: "Staff only") ],
      homeScore: 67, awayScore: 42)
    assert_response :success
    assert_equal "draft", body["boxScoreStatus"]
    row = body.fetch("stats").sole
    assert_equal [ 0, nil, nil, 0, "Staff only" ], row.values_at("points", "rebounds", "assists", "threePointersMade", "notes")
    assert_equal [ 20, 15, "final", @keeper.id ], @game.reload.attributes.values_at("home_score", "away_score", "status", "box_score_updated_by_id")
    assert_equal standings, @tournament.standings.reload.map(&:attributes)
    audit = AuditEvent.where(record_type: "PlayerGameStat", record_id: @game.player_game_stats.sole.id.to_s).sole
    assert_equal [ @keeper.id, @tournament.id, "results", "create" ], [ audit.actor_id, audit.tournament_id, audit.area, audit.action ]

    get public_path
    assert_response :not_found
    get "/api/v1/public/schedule", params: { tournamentId: @tournament.id }
    game = body.fetch("games").sole
    assert_equal false, game["hasPublishedBoxScore"]
    refute game.key?("boxScoreStatus")
    refute game.key?("boxScoreCoverage")

    save_box(entries: [ line(@home_player, points: "", notes: "  ") ])
    assert_response :success
    assert_empty @game.player_game_stats
    save_box(entries: [ line(@away_player, remove: true) ])
    assert_response :success
    assert_empty @game.player_game_stats
  end

  test "published box scores expose snapshots, omit notes, and retain inactive players with stats" do
    save_box(user: @publisher, status: "published", entries: [ line(@home_player, points: 3, notes: "Private coaching note") ])
    assert_response :success
    assert body["boxScorePublishedAt"]
    @home_player.update!(name: "Updated player", jersey_number: "8")
    delete "/api/v1/admin/roster-entries/#{@home_player.id}", params: { tournamentId: @tournament.id }, headers: headers(@staff)
    assert_response :success
    assert_equal true, body["deactivated"]
    assert_equal "Player has recorded box score stats and was deactivated to preserve history.", body["message"]
    assert_not @home_player.reload.active?

    get admin_path, headers: headers(@keeper)
    assert_response :success
    assert_equal false, body.fetch("homeRoster").sole["active"]
    assert_equal [ @away_player.id.to_s ], body.fetch("awayRoster").pluck("id")

    save_box(user: @publisher, status: "published", entries: [ line(@home_player, points: 4, notes: "Still private") ])
    assert_response :success
    get public_path
    assert_response :success
    assert_equal "selected_scorers", body["coverage"]
    assert_equal false, body["underReview"]
    row = body.fetch("homeStats").sole
    assert_equal [ "Home Player", "7", 4 ], row.values_at("playerName", "jerseyNumber", "points")
    assert_nil row["rebounds"]
    refute row.key?("notes")
    refute_includes response.body, "Still private"
    assert_equal true, body.dig("game", "hasPublishedBoxScore")

    save_box(user: @publisher, status: "draft", entries: [ line(@home_player, remove: true) ])
    assert_response :success
    assert_empty @game.player_game_stats
    assert_empty body["homeRoster"]
    save_box(user: @publisher, entries: [ line(@home_player, remove: true) ])
    assert_response :success
    assert_empty @game.player_game_stats
  end

  test "eligibility and invalid entry validation roll back the entire write" do
    same_tournament_other_player = team(@tournament, "Other").roster_entries.create!(name: "Other player")
    other_tournament = Tournament.create!(@tournament.attributes.slice("start_date", "end_date").merge(name: "Other", year: 2035))
    foreign_team = team(other_tournament, "Foreign")
    foreign_player = foreign_team.roster_entries.create!(name: "Foreign player")

    [ @inactive, same_tournament_other_player, foreign_player ].each do |ineligible|
      save_box(entries: [ line(@home_player, points: 1), line(ineligible, points: 1) ])
      assert_response :unprocessable_entity
      assert_empty @game.player_game_stats
      assert_equal "none", @game.reload.box_score_status
    end
    [ "abc", "3.1", 1.5, -1, 201, true, [ 2 ] ].each do |invalid|
      save_box(entries: [ line(@home_player, points: invalid) ])
      assert_response :unprocessable_entity
    end
    save_box(entries: [ line(@home_player, fouls: 11, minutes: 121, notes: "x" * 501) ])
    assert_response :unprocessable_entity
    assert_equal 3, body["errors"].size

    mismatched = @game.player_game_stats.build(team: @away, roster_entry: @home_player)
    assert_not mismatched.valid?
    assert_includes mismatched.errors[:roster_entry], "must belong to the selected team"
    cross_tournament = @game.player_game_stats.build(team: foreign_team, roster_entry: foreign_player)
    assert_not cross_tournament.valid?
    assert_includes cross_tournament.errors[:team], "must belong to the game's tournament"
  end

  test "draft editing and publishing use the game tournament and distinct actions" do
    other = Tournament.create!(@tournament.attributes.slice("start_date", "end_date").merge(name: "Other", year: 2035))
    outsider = user("outsider")
    grant(outsider, other, "edit", "publish_stats")

    get admin_path, headers: headers(outsider)
    assert_response :forbidden
    save_box(user: outsider, entries: [ line(@home_player, points: 5) ], tournamentId: other.id)
    assert_response :forbidden
    save_box(entries: [ line(@home_player, points: 5) ])
    assert_response :success
    save_box(status: "published")
    assert_response :forbidden
    save_box(user: @publisher, status: "published")
    assert_response :success

    %w[draft published].each do |status|
      save_box(status: status, entries: [ line(@home_player, points: 6) ])
      assert_response :forbidden
    end
    @game.reload.update!(box_score_status: "needs_review")
    save_box
    assert_response :forbidden
    save_box(user: @publisher)
    assert_response :success
    assert_nil body["boxScorePublishedAt"]
  end

  test "the feature flag and public schedule visibility gate stats independently" do
    @tournament.update!(enable_player_stats: false)
    save_box(entries: [ line(@home_player, points: 0) ])
    assert_response :unprocessable_entity
    get admin_path, headers: headers(@keeper)
    assert_response :success
    assert_equal false, body["enablePlayerStats"]

    @tournament.update!(enable_player_stats: true, schedule_published_at: nil)
    save_box(user: @publisher, status: "published", entries: [ line(@home_player, points: 1) ])
    assert_response :success
    get public_path
    assert_response :not_found
    get_leaders
    assert_equal false, body["enabled"]
    assert_empty body["leaders"]
    assert_equal 0, body["totalFinalGames"]
    assert_equal false, @game.reload.api_json[:hasPublishedBoxScore]

    @tournament.update!(schedule_published_at: Time.current, enable_player_stats: false)
    get public_path
    assert_response :not_found
    get_leaders
    assert_equal false, body["enabled"]
    @tournament.update!(enable_player_stats: true)
    @game.update!(status: "live")
    save_box(user: @publisher)
    assert_response :unprocessable_entity
    @game.update!(status: "final", placeholder: true)
    save_box(user: @publisher)
    assert_response :unprocessable_entity
  end

  test "full box score discrepancies block publication and score corrections flag prior publications" do
    save_box(user: @publisher, status: "published", coverage: "full_box_score",
      entries: [ line(@home_player, points: 20), line(@away_player, points: 14) ])
    assert_response :unprocessable_entity
    assert_empty @game.player_game_stats

    save_box(coverage: "full_box_score", entries: [ line(@home_player, points: 20), line(@away_player, points: 15) ])
    assert_response :success
    assert_equal [ 20, 15, 20, 15, false ], body.fetch("discrepancies")
      .values_at("homePointsSum", "awayPointsSum", "homeOfficialScore", "awayOfficialScore", "hasDiscrepancy")
    save_box(user: @publisher, status: "published", coverage: "full_box_score")
    assert_response :success
    corrected = Games::RecordResult.call(@game.reload, { home_score: 21, lock_version: @game.lock_version, reason: "Official score correction" }, actor: @staff)
    assert corrected.ok?
    assert_equal "needs_review", corrected.body.dig(:game, :boxScoreStatus)
    assert_equal 21, @game.reload.home_score
    assert_equal 20, @game.player_game_stats.find_by!(team: @home).points
    get public_path
    assert_response :success
    assert_equal true, body["underReview"]
    get_leaders
    assert_empty body["leaders"]
  end

  test "selected scorers remain published below the official total but go under review if exceeded or reopened" do
    save_box(user: @publisher, status: "published", entries: [ line(@home_player, points: 9) ])
    assert_response :success
    correct(home_score: 10)
    assert_equal "published", @game.reload.box_score_status
    correct(home_score: 8)
    assert_equal "needs_review", @game.reload.box_score_status
    save_box(user: @publisher, status: "published", entries: [ line(@home_player, points: 8) ])
    assert_response :success
    correct(status: "scheduled")
    assert_equal "needs_review", @game.reload.box_score_status
    assert_equal "scheduled", @game.status
    refute @game.publicly_visible_box_score?
    get public_path
    assert_response :not_found

    %w[postponed cancelled].each do |outcome|
      correct(status: "final", home_score: 8, away_score: 15)
      save_box(user: @publisher, status: "published")
      assert_response :success
      correct(result_outcome: outcome)
      assert_equal [ outcome, "needs_review", nil, nil ],
        @game.reload.attributes.values_at("status", "box_score_status", "home_score", "away_score")
      get public_path
      assert_response :not_found
    end

    # Scoreless forfeit flags published selected-scorers stats for review
    correct(status: "final", home_score: 20, away_score: 15)
    save_box(user: @publisher, status: "published", entries: [ line(@home_player, points: 9) ])
    assert_response :success
    correct(status: "final", result_outcome: "forfeit", official_winner_team_id: @home.id, home_score: nil, away_score: nil)
    assert_equal "needs_review", @game.reload.box_score_status
  end

  test "changing teams on a final game flags its published box score and allows removing orphaned player rows" do
    replacement_team = team(@tournament, "Class of 2019")
    replacement_player = replacement_team.roster_entries.create!(name: "Replacement Scorer", jersey_number: "99")
    save_box(user: @publisher, status: "published", entries: [ line(@home_player, points: 10), line(@away_player, points: 8) ])
    assert_response :success

    # Schedule-only update changing home team flags needs_review
    patch "/api/v1/admin/games/#{@game.id}", params: { game: { homeTeamId: replacement_team.id } }, headers: headers(@staff), as: :json
    assert_response :success
    assert_equal "needs_review", @game.reload.box_score_status
    get_leaders
    assert_empty body["leaders"]

    # Publishing fails while orphaned home_player stat remains, succeeds once removed and replaced
    save_box(user: @publisher, status: "published", entries: [ line(replacement_player, points: 10) ])
    assert_response :unprocessable_entity
    assert_match(/non-participating teams/, body.fetch("errors").join)

    save_box(user: @publisher, status: "published", entries: [
      { rosterEntryId: @home_player.id, remove: true },
      line(replacement_player, points: 10)
    ])
    assert_response :success
    assert_equal "published", @game.reload.box_score_status

    # Result-path team change also flags needs_review
    second_replacement = team(@tournament, "Class of 2020")
    res = Games::RecordResult.call(@game.reload, { home_score: 20, away_score: 15, status: "final", lock_version: @game.lock_version, reason: "Team fix" },
      actor: @staff, schedule_attributes: { home_team_id: second_replacement.id })
    assert res.ok?
    assert_equal "needs_review", @game.reload.box_score_status
  end

  test "notes-only player lines cannot be published without numeric metrics" do
    save_box(user: @publisher, status: "published", entries: [ line(@home_player, notes: "Did not play") ])
    assert_response :unprocessable_entity
    assert_match(/at least one player stat line/, body.fetch("errors").join)
  end

  test "leaders default to full box scores when available and compare coverage for the chosen metric and scope" do
    save_box(user: @publisher, status: "published", entries: [ line(@home_player, points: 10, rebounds: 0) ])
    assert_response :success
    get_leaders
    assert_equal "all", body["scope"]

    full_game = create_game
    save_box(game: full_game, user: @publisher, status: "published", coverage: "full_box_score",
      entries: [ line(@home_player, points: 20), line(@away_player, points: 15) ])
    assert_response :success
    draft_game = create_game
    save_box(game: draft_game, entries: [ line(@away_player, points: 12, rebounds: 10) ])
    review_game = create_game
    save_box(game: review_game, user: @publisher, status: "published", entries: [ line(@away_player, points: 12, rebounds: 10) ])
    review_game.reload.update!(box_score_status: "needs_review")

    get_leaders
    assert_equal [ "official", 4, 2, 1, 1, true ], body.values_at("scope", "totalFinalGames", "gamesWithBoxScores",
      "fullBoxScoreGames", "metricRecordedGames", "isPartialCoverage")
    assert_equal "Partial coverage — based on 1 of 4 final games", body["coverageLabel"]
    assert_equal [ 20, 15 ], body.fetch("leaders").pluck("total")

    get "/api/v1/public/stat-leaders", params: { year: @tournament.year, division: "maroon", scope: "all" }
    assert_equal [ 1, @home_player.id.to_s, 2, 30, 15.0 ], body.fetch("leaders").first.values_at(
      "rank", "rosterEntryId", "gamesRecorded", "total", "average")
    assert_equal 2, body["metricRecordedGames"]
    get_leaders(scope: "all", metric: "rebounds")
    assert_equal [ 1, 0 ], body.fetch("leaders").sole.values_at("gamesRecorded", "total")
    assert_equal 1, body["metricRecordedGames"]
    get_leaders(division: "other")
    assert_equal 0, body["totalFinalGames"]
    get_leaders(metric: "notes")
    assert_response :unprocessable_entity
  end

  test "tournaments accept the opt-in flag on create and update" do
    admin = user("admin", role: "admin")
    post "/api/v1/admin/tournaments", params: { tournament: {
      name: "New stats", year: 2036, startDate: "2036-07-01", endDate: "2036-07-14", enablePlayerStats: true
    } }, headers: headers(admin), as: :json
    assert_response :created
    id = body.dig("tournament", "id")
    assert_equal true, body.dig("tournament", "enablePlayerStats")
    patch "/api/v1/admin/tournaments/#{id}", params: { tournament: { enable_player_stats: false } }, headers: headers(admin), as: :json
    assert_response :success
    assert_equal false, body.dig("tournament", "enablePlayerStats")
  end

  private

  def create_game
    @tournament.games.create!(home_team: @home, away_team: @away, division_record: @division,
      start_time: Time.zone.local(2034, 7, 3, 18), status: "final", home_score: 20, away_score: 15)
  end

  def team(tournament, name)
    tournament.teams.create!(display_name: name, class_year_label: name, division_record: (@division if tournament == @tournament))
  end

  def user(name, role: "viewer")
    User.create!(email: "#{name}@stats.example.test", clerk_id: "stats-#{name}", role: role)
  end

  def grant(user, tournament, *actions)
    user.permission_grants.create!(email: user.email, scope_type: "tournament", scope_id: tournament.id,
      capability: "scores_and_stats", actions: actions)
  end

  def headers(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end

  def line(player, **stats)
    { rosterEntryId: player.id }.merge(stats)
  end

  def admin_path(game = @game)
    "/api/v1/admin/games/#{game.id}/box-score"
  end

  def public_path
    "/api/v1/public/games/#{@game.id}/box-score"
  end

  def save_box(user: @keeper, game: @game, status: "draft", coverage: "selected_scorers", entries: [], **extra)
    put admin_path(game), params: { status: status, coverage: coverage, entries: entries }.merge(extra),
      headers: headers(user), as: :json
  end

  def get_leaders(**params)
    get "/api/v1/public/stat-leaders", params: { tournamentId: @tournament.id }.merge(params)
  end

  def correct(**attrs)
    result = Games::RecordResult.call(@game.reload, attrs.merge(lock_version: @game.lock_version, reason: "Official correction"), actor: @staff)
    assert result.ok?, result.body.inspect
  end

  def body
    response.parsed_body
  end
end
