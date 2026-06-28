require "test_helper"

class AdminTeamsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "admin@example.com", clerk_id: "test_clerk_admin", role: "admin")
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
    @maroon = Division.create!(name: "Maroon", position: 1)
    @future_division = Division.create!(name: "Platinum", starts_year: 2027, position: 2)
    @team = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
  end

  test "division id stores configured division name" do
    patch "/api/v1/admin/teams/#{@team.id}",
      params: { team: { divisionId: @maroon.id } },
      headers: auth_headers,
      as: :json

    assert_response :success
    assert_equal @maroon.id, @team.reload.division_id
    assert_equal "Maroon", @team.division

    body = JSON.parse(response.body)
    assert_equal @maroon.id.to_s, body.dig("team", "divisionId")
    assert_equal "Maroon", body.dig("team", "division")
  end

  test "division id must be available for tournament year" do
    patch "/api/v1/admin/teams/#{@team.id}",
      params: { team: { divisionId: @future_division.id } },
      headers: auth_headers,
      as: :json

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body)["errors"].join, "Division is not available for this tournament year"
  end

  test "explicit null division clears a team division" do
    patch "/api/v1/admin/teams/#{@team.id}",
      params: { team: { division: nil } },
      headers: auth_headers,
      as: :json

    assert_response :success
    assert_nil @team.reload.division

    body = JSON.parse(response.body)
    assert_nil body.dig("team", "division")
  end

  test "manual represented classes can be assigned to a team entry" do
    patch "/api/v1/admin/teams/#{@team.id}",
      params: { team: { displayName: "Pack 12", classCohortKeys: %w[12 17], classCohortKeysChanged: true } },
      headers: auth_headers,
      as: :json

    assert_response :success
    assert_equal [ 2012, 2017 ], @team.reload.class_cohorts.order(:graduation_year).map(&:graduation_year)
    assert_equal [ "manual", "manual" ], @team.team_class_memberships.order(:position).pluck(:source)

    body = JSON.parse(response.body)
    assert_equal [ "Class of 2012", "Class of 2017" ], body.dig("team", "classCohorts").map { |cohort| cohort["displayName"] }

    patch "/api/v1/admin/teams/#{@team.id}",
      params: { team: { classCohortKeys: [] } },
      headers: auth_headers,
      as: :json

    assert_response :success
    assert_equal [ 2012, 2017 ], @team.reload.class_cohorts.order(:graduation_year).map(&:graduation_year)

    @team.update!(display_name: "Class of 2019")
    assert_equal [ 2012, 2017 ], @team.reload.class_cohorts.order(:graduation_year).map(&:graduation_year)
  end

  test "unchanged class cohort keys do not manualize auto memberships" do
    assert_equal [ "auto" ], @team.team_class_memberships.pluck(:source)

    patch "/api/v1/admin/teams/#{@team.id}",
      params: { team: { division: "Gold", classCohortKeys: %w[16] } },
      headers: auth_headers,
      as: :json

    assert_response :success
    assert_equal [ 2016 ], @team.reload.class_cohorts.map(&:graduation_year)
    assert_equal [ "auto" ], @team.team_class_memberships.pluck(:source)
  end

  test "explicit class cohort change can clear memberships" do
    patch "/api/v1/admin/teams/#{@team.id}",
      params: { team: { classCohortKeys: [], classCohortKeysChanged: true } },
      headers: auth_headers,
      as: :json

    assert_response :success
    assert_empty @team.reload.class_cohorts
  end

  test "class cohort master list is available to admins" do
    ClassArchive::Resolver.resolve_cohorts("AD7")

    get "/api/v1/admin/class-cohorts",
      headers: auth_headers,
      as: :json

    assert_response :success
    body = JSON.parse(response.body)
    assert_includes body.fetch("classCohorts").map { |cohort| cohort["displayName"] }, "Class of 1987"
  end

  test "team can be deleted when it has no games" do
    removable = @tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018", division: "Gold")

    delete "/api/v1/admin/teams/#{removable.id}",
      params: { tournamentId: @tournament.id },
      headers: auth_headers,
      as: :json

    assert_response :no_content
    assert_not Team.exists?(removable.id)
  end

  test "team with games cannot be deleted" do
    opponent = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")
    @tournament.games.create!(home_team: @team, away_team: opponent, start_time: Time.zone.local(2026, 7, 3, 18, 30), status: "scheduled")

    delete "/api/v1/admin/teams/#{@team.id}",
      params: { tournamentId: @tournament.id },
      headers: auth_headers,
      as: :json

    assert_response :unprocessable_entity
    assert Team.exists?(@team.id)
    assert_includes JSON.parse(response.body)["errors"].join, "Cannot delete record"
  end

  test "missing team returns JSON 404" do
    patch "/api/v1/admin/teams/999999",
      params: { team: { division: "Gold" } },
      headers: auth_headers,
      as: :json

    assert_response :not_found
    assert_equal({ "error" => "Not found" }, JSON.parse(response.body))
    assert_equal "application/json", response.media_type
  end

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
