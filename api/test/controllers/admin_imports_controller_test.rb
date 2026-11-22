require "test_helper"

class AdminImportsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = User.create!(email: "import-admin@example.com", clerk_id: "clerk_import_admin", role: "admin")
    @staff = User.create!(email: "import-staff@example.com", clerk_id: "clerk_import_staff", role: "staff")
    @viewer = User.create!(email: "import-viewer@example.com", clerk_id: "clerk_import_viewer", role: "viewer")

    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2027,
      start_date: Date.new(2027, 7, 2),
      end_date: Date.new(2027, 7, 23),
      status: "upcoming"
    )
    @tournament.ensure_default_divisions!
    @maroon = @tournament.divisions.find_by!(name: "Maroon")
    @gold = @tournament.divisions.find_by!(name: "Gold")
  end

  test "schedule preview parses CSV with zero database writes and surfaces unmatched existing games" do
    existing_home = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division_record: @maroon)
    existing_away = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: @maroon)
    unmatched = @tournament.games.create!(
      home_team: existing_home,
      away_team: existing_away,
      division_record: @maroon,
      game_number: "G99",
      start_time: Time.zone.local(2027, 7, 10, 18, 0),
      status: "final",
      home_score: 65,
      away_score: 60
    )

    csv = <<~CSV
      game_number,date,time,away_team,home_team,division,phase
      G1,2027-07-02,18:00,Class of 2018,Class of 2019,Maroon,pool
      G2,2027-07-02,19:15,Class of 2008,Class of 2009,Gold,pool
    CSV

    counts_before = [ Team.count, Game.count, Division.count, ClassCohort.count ]

    post "/api/v1/admin/tournaments/#{@tournament.id}/schedule-import/preview",
      params: { format: "auto", content: csv, defaultVenue: "The Jungle" },
      headers: headers_for(@staff),
      as: :json

    assert_response :success
    assert_equal counts_before, [ Team.count, Game.count, Division.count, ClassCohort.count ], "Preview must perform zero DB writes"

    body = JSON.parse(response.body)
    assert_equal "csv", body["detectedFormat"]
    assert_equal 2, body.dig("summary", "createCount")
    assert_equal 0, body.dig("summary", "errorCount")
    assert_equal 4, body.dig("summary", "newTeamsCount")
    assert_equal 1, body.dig("summary", "unmatchedExistingCount")
    assert_equal unmatched.id.to_s, body.dig("unmatchedExistingGames", 0, "id")
    assert_equal true, body.dig("unmatchedExistingGames", 0, "hasScores")
  end

  test "schedule preview parses FDMSAA PDF text format and rejects unknown divisions" do
    text = <<~TXT
      Friday, July 2, 2027
      G1  6:00 PM  Class of 2016 vs Class of 2017  Maroon
      G2  7:15 PM  Class of 2010 vs Class of 2011  UnknownDiv
    TXT

    post "/api/v1/admin/tournaments/#{@tournament.id}/schedule-import/preview",
      params: { format: "auto", content: text },
      headers: headers_for(@staff),
      as: :json

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "fdmsaa_text", body["detectedFormat"]
    assert_equal 1, body.dig("summary", "createCount")
    assert_equal 1, body.dig("summary", "errorCount")
    assert_includes body.dig("rows", 1, "errors").join, "Unknown division 'UnknownDiv'"
  end

  test "schedule commit is atomic, idempotent, preserves scores for staff, and restricts overwriteScores to admin" do
    csv = <<~CSV
      game_number,date,time,away_team,home_team,division,phase
      G1,2027-07-02,18:00,Class of 2016,Class of 2017,Maroon,pool
    CSV

    post "/api/v1/admin/tournaments/#{@tournament.id}/schedule-import/preview",
      params: { format: "csv", content: csv },
      headers: headers_for(@staff),
      as: :json
    rows = JSON.parse(response.body).fetch("rows")

    # First commit by staff succeeds
    post "/api/v1/admin/tournaments/#{@tournament.id}/schedule-import/commit",
      params: { rows: rows },
      headers: headers_for(@staff),
      as: :json
    assert_response :success
    commit_body = JSON.parse(response.body)
    assert_equal 2, commit_body["createdTeams"]
    assert_equal 1, commit_body["createdGames"]

    # Record a final score on G1
    game = @tournament.games.find_by!(game_number: "G1")
    game.update!(status: "final", home_score: 70, away_score: 62)

    # Second commit without overwriteScores preserves final score & status
    modified_rows = rows.map { |r| r.merge("venue" => "FD Main Gym", "homeScore" => 0, "awayScore" => 0, "status" => "scheduled") }
    post "/api/v1/admin/tournaments/#{@tournament.id}/schedule-import/commit",
      params: { rows: modified_rows },
      headers: headers_for(@staff),
      as: :json
    assert_response :success
    game.reload
    assert_equal "FD Main Gym", game.venue
    assert_equal "final", game.status
    assert_equal 70, game.home_score
    assert_equal 62, game.away_score

    # Staff cannot use overwriteScores: true -> 403
    post "/api/v1/admin/tournaments/#{@tournament.id}/schedule-import/commit",
      params: { rows: modified_rows, overwriteScores: true },
      headers: headers_for(@staff),
      as: :json
    assert_response :forbidden
    assert_equal 70, game.reload.home_score

    # Admin CAN use overwriteScores: true
    admin_rows = rows.map { |r| r.merge("homeScore" => 75, "awayScore" => 68, "status" => "final") }
    post "/api/v1/admin/tournaments/#{@tournament.id}/schedule-import/commit",
      params: { rows: admin_rows, overwriteScores: true },
      headers: headers_for(@admin),
      as: :json
    assert_response :success
    assert_equal 75, game.reload.home_score
    assert_equal 68, game.away_score
  end

  test "schedule commit rolls back completely when any row has validation errors" do
    rows = [
      { rowIndex: 1, gameNumber: "G1", startTime: "2027-07-02T18:00:00+10:00", awayTeam: "Class of 2016", homeTeam: "Class of 2017", division: "Maroon", phase: "pool" },
      { rowIndex: 2, gameNumber: "G1", startTime: "2027-07-02T19:00:00+10:00", awayTeam: "Class of 2018", homeTeam: "Class of 2019", division: "Maroon", phase: "pool" }
    ]

    assert_no_difference [ -> { Team.count }, -> { Game.count } ] do
      post "/api/v1/admin/tournaments/#{@tournament.id}/schedule-import/commit",
        params: { rows: rows },
        headers: headers_for(@staff),
        as: :json
    end

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal 1, body.dig("preview", "summary", "errorCount")
  end

  test "roster preview and commit upsert idempotently and block duplicates" do
    team = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: @maroon)
    csv = <<~CSV
      team,name,jersey_number,position,nickname
      Class of 2017,John Cruz,23,G,JC
      Class of 2017,Mike Santos,12,F,
    CSV

    assert_no_difference -> { RosterEntry.count } do
      post "/api/v1/admin/tournaments/#{@tournament.id}/roster-import/preview",
        params: { content: csv },
        headers: headers_for(@staff),
        as: :json
    end
    assert_response :success
    rows = JSON.parse(response.body).fetch("rows")
    assert_equal 2, rows.length

    post "/api/v1/admin/tournaments/#{@tournament.id}/roster-import/commit",
      params: { rows: rows },
      headers: headers_for(@staff),
      as: :json
    assert_response :success
    assert_equal 2, JSON.parse(response.body)["created"]
    assert_equal 2, team.roster_entries.count

    # Second commit with updated jersey updates in place without duplicating
    updated_rows = rows.map { |r| r["name"] == "John Cruz" ? r.merge("jerseyNumber" => "24") : r }
    post "/api/v1/admin/tournaments/#{@tournament.id}/roster-import/commit",
      params: { rows: updated_rows },
      headers: headers_for(@staff),
      as: :json
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 0, body["created"]
    assert_equal 1, body["updated"]
    assert_equal 1, body["unchanged"]
    assert_equal "24", team.roster_entries.find_by!(name: "John Cruz").jersey_number
  end

  test "viewer and anonymous users are rejected from import endpoints" do
    post "/api/v1/admin/tournaments/#{@tournament.id}/schedule-import/preview",
      params: { content: "away,home\nA,B" },
      as: :json
    assert_response :unauthorized

    post "/api/v1/admin/tournaments/#{@tournament.id}/schedule-import/preview",
      params: { content: "away,home\nA,B" },
      headers: headers_for(@viewer),
      as: :json
    assert_response :forbidden
  end

  private

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
