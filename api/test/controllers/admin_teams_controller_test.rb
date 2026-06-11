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
    @team = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
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

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
