require "test_helper"

class AdminTournamentsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "admin@example.com", clerk_id: "test_clerk_admin", role: "admin")
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
  end

  test "explicit null date is validated instead of silently ignored" do
    patch "/api/v1/admin/tournaments/#{@tournament.id}",
      params: { tournament: { startDate: nil } },
      headers: auth_headers,
      as: :json

    assert_response :unprocessable_entity
    assert_equal Date.new(2026, 7, 3), @tournament.reload.start_date
  end

  test "missing tournament returns JSON 404" do
    get "/api/v1/admin/tournaments/999999", headers: auth_headers

    assert_response :not_found
    assert_equal({ "error" => "Not found" }, JSON.parse(response.body))
    assert_equal "application/json", response.media_type
  end

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
