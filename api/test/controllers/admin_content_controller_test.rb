require "test_helper"

class AdminContentControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "admin-content@example.com", clerk_id: "test_clerk_content", role: "admin")
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "live"
    )
    @team_a = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
    @team_b = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")
    @game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      start_time: Time.zone.local(2026, 7, 3, 18, 0),
      status: "scheduled"
    )
  end

  test "admin dashboard returns operational counts" do
    get "/api/v1/admin/dashboard", headers: auth_headers

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal @tournament.id.to_s, body.dig("tournament", "id")
    assert_equal 2, body.dig("counts", "teams")
    assert_equal 1, body.dig("counts", "games")
  end

  test "admin creates and updates an article link" do
    post "/api/v1/admin/articles",
      params: { article: { tournamentId: @tournament.id.to_s, title: "Opening night", source: "GSPN", url: "https://example.com/opening", publishedAt: "2026-07-03" } },
      headers: auth_headers,
      as: :json

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal "Opening night", body.dig("article", "title")

    article = ArticleLink.find(body.dig("article", "id"))
    patch "/api/v1/admin/articles/#{article.id}",
      params: { article: { imageUrl: "https://example.com/photo.jpg", excerpt: nil } },
      headers: auth_headers,
      as: :json

    assert_response :success
    assert_equal "https://example.com/photo.jpg", JSON.parse(response.body).dig("article", "imageUrl")
    assert_nil ArticleLink.find(article.id).excerpt
  end

  test "bulk links update ticket and stream urls" do
    patch "/api/v1/admin/links/bulk",
      params: { updates: [ { id: @game.id.to_s, ticketUrl: "https://guamtime.test/tickets", streamUrl: "https://clutch.test/live" } ] },
      headers: auth_headers,
      as: :json

    assert_response :success
    assert_equal 1, JSON.parse(response.body)["updated"]
    @game.reload
    assert_equal "https://guamtime.test/tickets", @game.ticket_url
    assert_equal "https://clutch.test/live", @game.stream_url
  end

  test "missing links endpoint reports operational gaps" do
    @game.update!(status: "final", home_score: nil, away_score: nil)

    get "/api/v1/admin/missing-links", headers: auth_headers

    assert_response :success
    summary = JSON.parse(response.body)["summary"]
    assert_equal 1, summary["missingTickets"]
    assert_equal 1, summary["missingStreams"]
    assert_equal 1, summary["missingScores"]
  end

  test "approving article ingest item imports article link" do
    item = @tournament.content_ingest_items.create!(
      kind: "article",
      status: "pending",
      source: "GSPN",
      title: "Playoff preview",
      url: "https://example.com/playoff-preview"
    )

    post "/api/v1/admin/content-ingest-items/#{item.id}/approve", headers: auth_headers

    assert_response :success
    item.reload
    assert_equal "approved", item.status
    assert ArticleLink.exists?(tournament: @tournament, url: "https://example.com/playoff-preview")
  end

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
