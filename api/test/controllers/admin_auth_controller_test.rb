require "test_helper"

class AdminAuthControllerTest < ActionDispatch::IntegrationTest
  test "allows staff users with test token to access admin endpoints" do
    user = User.create!(email: "admin@example.com", clerk_id: "test_clerk_admin", role: "admin")
    Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )

    get "/api/v1/admin/tournaments", headers: { "Authorization" => "Bearer test_token_#{user.id}" }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 1, body["tournaments"].length
  end

  test "returns camel case current user auth flags" do
    user = User.create!(email: "admin@example.com", clerk_id: "test_clerk_admin", role: "admin")

    get "/api/v1/me", headers: { "Authorization" => "Bearer test_token_#{user.id}" }

    assert_response :success
    payload = JSON.parse(response.body).fetch("user")
    assert_equal true, payload["isAdmin"]
    assert_equal true, payload["isStaff"]
    assert_not payload.key?("is_admin")
    assert_not payload.key?("is_staff")
  end

  test "creates an allowlisted user on first Clerk sign in" do
    AdminWhitelist.create!(email: "host@example.com", role: "staff")
    Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )

    claims = { "sub" => "clerk_host", "email" => "host@example.com", "first_name" => "Host" }
    with_clerk_claims(claims) do
      get "/api/v1/admin/tournaments", headers: { "Authorization" => "Bearer clerk_test" }
    end

    assert_response :success
    user = User.find_by!(clerk_id: "clerk_host")
    assert_equal "host@example.com", user.email
    assert_equal "staff", user.role
  end

  test "rejects admin endpoints without auth" do
    get "/api/v1/admin/tournaments"

    assert_response :unauthorized
  end

  private

  def with_clerk_claims(claims)
    original_verify = ClerkAuth.method(:verify)
    ClerkAuth.define_singleton_method(:verify) { |_token| claims }
    yield
  ensure
    ClerkAuth.define_singleton_method(:verify) { |token| original_verify.call(token) }
  end
end
