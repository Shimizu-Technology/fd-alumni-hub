require "test_helper"

class AdminAuthorizationTest < ActionDispatch::IntegrationTest
  setup do
    @admin = User.create!(email: "admin-rbac@example.com", clerk_id: "clerk_rbac_admin", role: "admin")
    @staff = User.create!(email: "staff-rbac@example.com", clerk_id: "clerk_rbac_staff", role: "staff")
    @viewer = User.create!(email: "viewer-rbac@example.com", clerk_id: "clerk_rbac_viewer", role: "viewer")

    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2027,
      start_date: Date.new(2027, 6, 25),
      end_date: Date.new(2027, 7, 16),
      status: "upcoming"
    )
    @division = Division.create!(name: "Maroon", position: 1)
    @team_a = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: @division)
    @team_b = @tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018", division_record: @division)
    @removable_team = @tournament.teams.create!(class_year_label: "2019", display_name: "Class of 2019", division_record: @division)
    @game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      start_time: Time.zone.local(2027, 6, 25, 18, 0),
      status: "scheduled"
    )
    @article = @tournament.article_links.create!(title: "Preview", source: "GSPN", url: "https://example.test/preview")
    @media = @tournament.media_assets.create!(title: "Tipoff", source: "GSPN", image_url: "https://example.test/tipoff.jpg")
    @sponsor = @tournament.sponsors.create!(name: "Ambros", tier: "Diamond")
    @ingest_item = @tournament.content_ingest_items.create!(
      kind: "article",
      source: "GSPN",
      title: "Candidate story",
      url: "https://example.test/candidate"
    )
  end

  test "anonymous requests are rejected with 401 on staff and admin-only endpoints" do
    get "/api/v1/admin/dashboard"
    assert_response :unauthorized

    post "/api/v1/admin/tournaments", params: { tournament: { name: "Anon", year: 2028, startDate: "2028-06-25", endDate: "2028-07-16" } }, as: :json
    assert_response :unauthorized

    get "/api/v1/admin/content-ingest-items"
    assert_response :unauthorized
  end

  test "viewer requests are rejected with 403 on staff and admin-only endpoints" do
    get "/api/v1/admin/dashboard", headers: headers_for(@viewer)
    assert_response :forbidden

    get "/api/v1/admin/tournaments", headers: headers_for(@viewer)
    assert_response :forbidden

    get "/api/v1/admin/content-ingest-items", headers: headers_for(@viewer)
    assert_response :forbidden
  end

  test "staff can use operational tournament endpoints" do
    get "/api/v1/admin/dashboard", headers: headers_for(@staff)
    assert_response :success

    get "/api/v1/admin/tournaments", headers: headers_for(@staff)
    assert_response :success

    get "/api/v1/admin/tournaments/#{@tournament.id}", headers: headers_for(@staff)
    assert_response :success

    get "/api/v1/admin/divisions", params: { tournamentId: @tournament.id }, headers: headers_for(@staff)
    assert_response :success

    patch "/api/v1/admin/games/#{@game.id}",
      params: { game: { homeScore: 60, awayScore: 55, status: "final" } },
      headers: headers_for(@staff),
      as: :json
    assert_response :success

    post "/api/v1/admin/standings/recompute", params: { tournamentId: @tournament.id }, headers: headers_for(@staff), as: :json
    assert_response :success

    post "/api/v1/admin/tournaments/#{@tournament.id}/recompute-standings", headers: headers_for(@staff)
    assert_response :success

    patch "/api/v1/admin/links/bulk",
      params: { updates: [ { id: @game.id.to_s, ticketUrl: "https://hafapass.shimizu-technology.com/events/fd" } ] },
      headers: headers_for(@staff),
      as: :json
    assert_response :success

    post "/api/v1/admin/articles",
      params: { article: { tournamentId: @tournament.id, title: "Staff update", source: "Official", url: "https://example.test/staff-update" } },
      headers: headers_for(@staff),
      as: :json
    assert_response :created

    post "/api/v1/admin/sponsors",
      params: { sponsor: { tournamentId: @tournament.id, name: "Local Partner", tier: "Gold" } },
      headers: headers_for(@staff),
      as: :json
    assert_response :created
  end

  test "staff receives 403 on all admin-only endpoints" do
    post "/api/v1/admin/tournaments",
      params: { tournament: { name: "FD 2028", year: 2028, startDate: "2028-06-25", endDate: "2028-07-16", status: "upcoming" } },
      headers: headers_for(@staff),
      as: :json
    assert_response :forbidden

    patch "/api/v1/admin/tournaments/#{@tournament.id}",
      params: { tournament: { status: "live" } },
      headers: headers_for(@staff),
      as: :json
    assert_response :forbidden

    post "/api/v1/admin/divisions",
      params: { division: { name: "Legends", position: 9 } },
      headers: headers_for(@staff),
      as: :json
    assert_response :forbidden

    patch "/api/v1/admin/divisions/#{@division.id}",
      params: { division: { position: 5 } },
      headers: headers_for(@staff),
      as: :json
    assert_response :forbidden

    delete "/api/v1/admin/teams/#{@removable_team.id}",
      params: { tournamentId: @tournament.id },
      headers: headers_for(@staff),
      as: :json
    assert_response :forbidden
    assert Team.exists?(@removable_team.id)

    delete "/api/v1/admin/articles/#{@article.id}", headers: headers_for(@staff)
    assert_response :forbidden
    assert ArticleLink.exists?(@article.id)

    delete "/api/v1/admin/media-assets/#{@media.id}", headers: headers_for(@staff)
    assert_response :forbidden
    assert MediaAsset.exists?(@media.id)

    delete "/api/v1/admin/sponsors/#{@sponsor.id}", headers: headers_for(@staff)
    assert_response :forbidden
    assert Sponsor.exists?(@sponsor.id)

    get "/api/v1/admin/content-ingest-items", headers: headers_for(@staff)
    assert_response :forbidden

    post "/api/v1/admin/content-ingest-items/#{@ingest_item.id}/approve", headers: headers_for(@staff)
    assert_response :forbidden

    post "/api/v1/admin/content-ingest-items/#{@ingest_item.id}/reject", headers: headers_for(@staff)
    assert_response :forbidden
  end

  test "admin can perform admin-only actions" do
    post "/api/v1/admin/tournaments",
      params: { tournament: { name: "FD 2028", year: 2028, startDate: "2028-06-25", endDate: "2028-07-16", status: "upcoming" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :created

    patch "/api/v1/admin/tournaments/#{@tournament.id}",
      params: { tournament: { status: "live" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :success

    post "/api/v1/admin/divisions",
      params: { division: { name: "Legends", position: 9 } },
      headers: headers_for(@admin),
      as: :json
    assert_response :created

    get "/api/v1/admin/content-ingest-items", headers: headers_for(@admin)
    assert_response :success

    delete "/api/v1/admin/teams/#{@removable_team.id}",
      params: { tournamentId: @tournament.id },
      headers: headers_for(@admin),
      as: :json
    assert_response :no_content

    delete "/api/v1/admin/articles/#{@article.id}", headers: headers_for(@admin)
    assert_response :no_content

    delete "/api/v1/admin/media-assets/#{@media.id}", headers: headers_for(@admin)
    assert_response :no_content

    delete "/api/v1/admin/sponsors/#{@sponsor.id}", headers: headers_for(@admin)
    assert_response :no_content
  end

  private

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
