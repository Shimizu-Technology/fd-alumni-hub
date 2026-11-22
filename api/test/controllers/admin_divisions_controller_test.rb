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
    @maroon_2026 = @tournament_2026.divisions.create!(name: "Maroon", position: 1)
    @diamond_2026 = @tournament_2026.divisions.create!(name: "Diamond", position: 2, active: false)
    @maroon_2027 = @tournament_2027.divisions.create!(name: "Maroon", position: 1)
    @platinum_2027 = @tournament_2027.divisions.create!(name: "Platinum", position: 2)
  end

  test "lists only divisions scoped to the selected tournament" do
    get "/api/v1/admin/divisions",
      params: { tournamentId: @tournament_2026.id },
      headers: auth_headers

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [ "Maroon" ], body["divisions"].map { |division| division["name"] }
    assert_equal [ "Maroon", "Diamond" ], body["allDivisions"].map { |division| division["name"] }

    get "/api/v1/admin/divisions",
      params: { tournamentId: @tournament_2027.id },
      headers: auth_headers

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [ "Maroon", "Platinum" ], body["divisions"].map { |division| division["name"] }
    assert_equal [ "Maroon", "Platinum" ], body["allDivisions"].map { |division| division["name"] }
  end

  test "creating a division scopes it strictly to the selected tournament with countsForStandings" do
    post "/api/v1/admin/divisions",
      params: { division: { name: "Legends", position: 4, countsForStandings: false }, tournamentId: @tournament_2027.id },
      headers: auth_headers,
      as: :json

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal @tournament_2027.id.to_s, body.dig("division", "tournamentId")
    assert_equal false, body.dig("division", "countsForStandings")

    get "/api/v1/admin/divisions",
      params: { tournamentId: @tournament_2026.id },
      headers: auth_headers
    refute_includes JSON.parse(response.body)["allDivisions"].map { |entry| entry["name"] }, "Legends"

    get "/api/v1/admin/divisions",
      params: { tournamentId: @tournament_2027.id },
      headers: auth_headers
    assert_includes JSON.parse(response.body)["divisions"].map { |entry| entry["name"] }, "Legends"
  end

  test "cannot update a division via another tournament scope" do
    patch "/api/v1/admin/divisions/#{@platinum_2027.id}",
      params: { tournamentId: @tournament_2026.id, division: { name: "Hijacked" } },
      headers: auth_headers,
      as: :json

    assert_response :not_found
    assert_equal "Platinum", @platinum_2027.reload.name
  end

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
