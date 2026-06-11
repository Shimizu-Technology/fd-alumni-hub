require "test_helper"

class AdminAuthControllerTest < ActionDispatch::IntegrationTest
  test "allows staff users with test token to access admin endpoints" do
    user = User.create!(email: "admin@example.com", clerk_id: "test_clerk_admin", role: "admin")
    Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Time.zone.local(2026, 7, 3),
      end_date: Time.zone.local(2026, 7, 24),
      status: "upcoming"
    )

    get "/api/v1/admin/tournaments", headers: { "Authorization" => "Bearer test_token_#{user.id}" }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 1, body["tournaments"].length
  end

  test "rejects admin endpoints without auth" do
    get "/api/v1/admin/tournaments"

    assert_response :unauthorized
  end
end
