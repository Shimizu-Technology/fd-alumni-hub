require "test_helper"

class AdminTournamentChampionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = User.create!(email: "champion-admin@example.com", role: "admin")
    @editor = User.create!(email: "champion-editor@example.com", role: "viewer")
    @reader = User.create!(email: "champion-reader@example.com", role: "viewer")
    @confirmer = User.create!(email: "champion-confirmer@example.com", role: "viewer")
    @season = tournament("FD Alumni", 2087)
    @other = tournament("Other event", 2087)
    @first_class = cohort(2017)
    @second_class = cohort(2018)
    grant(@editor, @season, %w[view confirm_champions publish_recap])
    grant(@reader, @season, %w[view])
    grant(@confirmer, @season, %w[confirm_champions])
  end

  test "scoped confirmation creates, edits and removes records, syncing credits and scoped audit events" do
    post path, params: { champion: {
      bracket: "maroon", editionLabel: "Summer", championLabel: @first_class.display_name,
      runner_up_label: @second_class.display_name, score: "75–68", primary: false,
      position: 3, notes: "Verified final", tournament_id: @other.id, year: 1900
    } }, headers: headers(@editor), as: :json
    assert_response :created
    champion = response.parsed_body.fetch("champion")
    id = champion.fetch("id")
    assert_equal @season.id.to_s, champion["tournamentId"]
    assert_equal @season.year, champion["year"]
    assert_equal "Summer", champion["editionLabel"]
    assert_equal "completed", champion["status"]
    assert_equal "admin_confirmed", champion["source"]
    assert_equal false, champion["primary"]
    assert_equal 3, champion["position"]
    assert_equal [ @first_class.id ], TournamentChampion.find(id).class_cohort_ids

    get path, headers: headers(@reader)
    assert_response :ok
    assert_equal [ id ], response.parsed_body.fetch("champions").pluck("id")

    patch "#{path}/#{id}", params: { champion_label: @second_class.display_name, runnerUpLabel: nil },
      headers: headers(@editor), as: :json
    assert_response :ok
    assert_nil response.parsed_body.dig("champion", "runnerUpKey")
    assert_equal [ @second_class.id ], TournamentChampion.find(id).class_cohort_ids

    delete "#{path}/#{id}", headers: headers(@editor)
    assert_response :no_content
    assert_not TournamentChampion.exists?(id)
    assert_not TournamentChampionCredit.exists?(tournament_champion_id: id)

    events = AuditEvent.where(record_type: "TournamentChampion", record_id: id).order(:id)
    assert_equal %w[create update delete], events.pluck(:action)
    assert_equal [ @editor.id ], events.reorder(nil).distinct.pluck(:actor_id)
    assert_equal [ @season.id ], events.reorder(nil).distinct.pluck(:tournament_id)
  end

  test "view alone cannot confirm and record mutations enforce the tournament path" do
    foreign = TournamentChampion.create!(tournament: @other, year: @other.year, champion_label: @second_class.display_name)
    get path, headers: headers(@reader)
    assert_response :ok
    assert_empty response.parsed_body.fetch("champions")

    get path, headers: headers(@confirmer)
    assert_response :ok
    get path(@other), headers: headers(@editor)
    assert_response :forbidden

    post path, params: { championLabel: "Class of 2017" }, headers: headers(@reader), as: :json
    assert_response :forbidden
    post path, params: { championLabel: "Class of 2017", bracket: "typo" }, headers: headers(@confirmer), as: :json
    assert_response :unprocessable_entity
    post path, params: { championLabel: "Class of 2017", primary: nil, position: nil }, headers: headers(@confirmer), as: :json
    assert_response :unprocessable_entity
    post path, params: { championLabel: "Class of 2017" }, headers: headers(@confirmer), as: :json
    assert_response :created

    [ @editor, @admin ].each do |actor|
      patch "#{path}/#{foreign.id}", params: { score: "Other score" }, headers: headers(actor), as: :json
      assert_response :not_found
      delete "#{path}/#{foreign.id}", headers: headers(actor)
      assert_response :not_found
    end
    assert_nil foreign.reload.score
  end

  test "team suggestions belong to the selected season, and history privileges do not publish Site Mode" do
    @season.teams.create!(display_name: "Class of 2017", class_year_label: "2017")
    @other.teams.create!(display_name: "Class of 2018", class_year_label: "2018")
    get "#{path}/team-options", headers: headers(@editor)
    assert_response :ok
    assert_equal [ "Class of 2017" ], response.parsed_body.fetch("teams")
    get "#{path}/team-options", headers: headers(@reader)
    assert_response :forbidden

    [ [ "tournament_recap", @season ], [ "tournament_recap", @other ], [ "fundraising", @season ] ].each do |mode, season|
      assert_no_difference "SitePublication.count" do
        post "/api/v1/admin/site-mode/publish", params: { mode: mode, tournamentId: season.id }, headers: headers(@editor), as: :json
        assert_response :forbidden
      end
    end

    TournamentChampion.create!(tournament: @other, year: @other.year, champion_label: "Class of 2018")
    post "/api/v1/admin/site-mode/publish", params: { mode: "tournament_recap", tournamentId: @season.id }, headers: headers(@admin), as: :json
    assert_response :created
    assert_empty SiteMode::Resolver.new.champion_records
  end

  private

  def tournament(name, year)
    Tournament.create!(name: name, year: year, start_date: Date.new(year, 7, 1), end_date: Date.new(year, 7, 16))
  end

  def cohort(year)
    ClassCohort.find_or_create_by!(graduation_year: year) do |record|
      record.key = year.to_s.last(2)
      record.display_name = "Class of #{year}"
      record.short_label = "'#{record.key}"
    end
  end

  def grant(user, season, actions)
    PermissionGrant.create!(user: user, email: user.email, scope_type: "tournament", scope_id: season.id,
      capability: "history_and_media", actions: actions, granted_by: @admin, accepted_at: Time.current)
  end

  def path(season = @season)
    "/api/v1/admin/tournaments/#{season.id}/champions"
  end

  def headers(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
