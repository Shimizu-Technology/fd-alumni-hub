require "test_helper"

class AdminDivisionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "admin@example.com", clerk_id: "test_clerk_admin", role: "admin")
    @tournament_2026 = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
    @tournament_2027 = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2027,
      start_date: Date.new(2027, 7, 2),
      end_date: Date.new(2027, 7, 23),
      status: "upcoming"
    )
    @maroon = Division.create!(name: "Maroon", position: 1)
    @diamond = Division.create!(name: "Diamond", position: 2)
    @platinum = Division.create!(name: "Platinum", starts_year: 2027, position: 3)
  end

  test "lists only divisions available for selected tournament year" do
    get "/api/v1/admin/divisions",
      params: { tournamentId: @tournament_2026.id },
      headers: auth_headers

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [ "Maroon", "Diamond" ], body["divisions"].map { |division| division["name"] }
    assert_equal [ "Maroon", "Diamond", "Platinum" ], body["allDivisions"].map { |division| division["name"] }
    assert_equal false, body["allDivisions"].find { |division| division["name"] == "Platinum" }["available"]

    get "/api/v1/admin/divisions",
      params: { tournamentId: @tournament_2027.id },
      headers: auth_headers

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [ "Maroon", "Diamond", "Platinum" ], body["divisions"].map { |division| division["name"] }
  end

  test "creating division from selected tournament makes it available from that year onward" do
    post "/api/v1/admin/divisions",
      params: { division: { name: "Legends", position: 4 }, tournamentId: @tournament_2027.id },
      headers: auth_headers,
      as: :json

    assert_response :created
    division = Division.find_by!(name: "Legends")
    assert_equal 2027, division.starts_year

    get "/api/v1/admin/divisions",
      params: { tournamentId: @tournament_2026.id },
      headers: auth_headers
    refute_includes JSON.parse(response.body)["divisions"].map { |entry| entry["name"] }, "Legends"

    get "/api/v1/admin/divisions",
      params: { tournamentId: @tournament_2027.id },
      headers: auth_headers
    assert_includes JSON.parse(response.body)["divisions"].map { |entry| entry["name"] }, "Legends"
  end

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
