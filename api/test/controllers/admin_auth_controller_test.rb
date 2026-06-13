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

  test "rejects allowlisted sign in when the email belongs to an inactive user" do
    User.create!(email: "host@example.com", clerk_id: "old_clerk_host", role: "staff", active: false)
    AdminWhitelist.create!(email: "host@example.com", role: "staff")

    claims = { "sub" => "new_clerk_host", "email" => "host@example.com", "first_name" => "Host" }
    with_clerk_claims(claims) do
      get "/api/v1/admin/tournaments", headers: { "Authorization" => "Bearer clerk_test" }
    end

    assert_response :unauthorized
    assert_nil User.find_by(clerk_id: "new_clerk_host")
  end

  test "recovers when concurrent sign in already stamped clerk id on email matched user" do
    user = User.create!(email: "host@example.com", role: "staff")
    claims = { "sub" => "clerk_host", "email" => "host@example.com", "first_name" => "Host" }

    with_update_race_for(user, "clerk_host") do
      with_clerk_claims(claims) do
        get "/api/v1/me", headers: { "Authorization" => "Bearer clerk_test" }
      end
    end

    assert_response :success
    assert_equal "clerk_host", user.reload.clerk_id
  end

  test "does not recover to an arbitrary nil-clerk user when clerk-matched sync fails" do
    decoy = User.create!(email: "decoy@example.com", role: "staff")
    user = User.create!(email: "host@example.com", clerk_id: "clerk_host", role: "staff")
    claims = { "sub" => "clerk_host", "email" => "renamed-host@example.com", "first_name" => "Host" }

    with_update_failure_for(user) do
      with_clerk_claims(claims) do
        get "/api/v1/me", headers: { "Authorization" => "Bearer clerk_test" }
      end
    end

    assert_response :success
    payload = JSON.parse(response.body).fetch("user")
    assert_equal user.id.to_s, payload["id"]
    assert_not_equal decoy.id.to_s, payload["id"]
  end

  test "rejects dev token bypass attempts" do
    get "/api/v1/me", headers: { "Authorization" => "Bearer dev_token_admin@example.com" }

    assert_response :unauthorized
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

  def with_update_race_for(user, clerk_id)
    failure = lambda do |record, attrs, simulated|
      if !simulated.value && record.id == user.id && attrs[:clerk_id] == clerk_id
        simulated.value = true
        User.where(id: record.id).update_all(clerk_id: clerk_id, updated_at: Time.current)
        raise ActiveRecord::RecordInvalid.new(record)
      end
    end

    stub_user_update(failure) { yield }
  end

  def with_update_failure_for(user)
    failure = lambda do |record, _attrs, simulated|
      if !simulated.value && record.id == user.id
        simulated.value = true
        raise ActiveRecord::RecordInvalid.new(record)
      end
    end

    stub_user_update(failure) { yield }
  end

  def stub_user_update(failure)
    original_update = User.instance_method(:update!)
    simulated = Struct.new(:value).new(false)

    User.define_method(:update!) do |attrs|
      failure.call(self, attrs, simulated)
      original_update.bind_call(self, attrs)
    end

    yield
  ensure
    User.define_method(:update!, original_update)
  end
end
