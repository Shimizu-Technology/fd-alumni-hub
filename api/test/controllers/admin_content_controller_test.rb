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

  test "bulk links update only ticket and stream urls" do
    patch "/api/v1/admin/links/bulk",
      params: {
        updates: [ {
          id: @game.id.to_s,
          ticketUrl: "https://guamtime.test/tickets",
          streamUrl: "https://clutch.test/live",
          status: "final",
          homeScore: 99
        } ]
      },
      headers: auth_headers,
      as: :json

    assert_response :success
    assert_equal 1, JSON.parse(response.body)["updated"]
    @game.reload
    assert_equal "https://guamtime.test/tickets", @game.ticket_url
    assert_equal "https://clutch.test/live", @game.stream_url
    assert_equal "scheduled", @game.status
    assert_nil @game.home_score
  end

  test "bulk links reject malformed updates" do
    patch "/api/v1/admin/links/bulk",
      params: { updates: { id: @game.id.to_s, ticketUrl: "https://guamtime.test/tickets" } },
      headers: auth_headers,
      as: :json

    assert_response :bad_request
    assert_equal [ "updates must be an array" ], JSON.parse(response.body)["errors"]
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

  test "creating ingest item ignores status and imported record overrides" do
    post "/api/v1/admin/content-ingest-items",
      params: {
        ingestItem: {
          tournamentId: @tournament.id.to_s,
          kind: "article",
          status: "approved",
          source: "GSPN",
          title: "Bypass attempt",
          url: "https://example.com/bypass-create",
          importedToId: "12345"
        }
      },
      headers: auth_headers,
      as: :json

    assert_response :created
    item = ContentIngestItem.find(JSON.parse(response.body).dig("ingestItem", "id"))
    assert_equal "pending", item.status
    assert_nil item.imported_to_id
  end

  test "updating ingest item ignores status and imported record overrides" do
    item = @tournament.content_ingest_items.create!(
      kind: "article",
      status: "pending",
      source: "GSPN",
      title: "Pending candidate",
      url: "https://example.com/pending-candidate"
    )

    patch "/api/v1/admin/content-ingest-items/#{item.id}",
      params: { ingestItem: { title: "Updated candidate", status: "approved", importedToId: "12345" } },
      headers: auth_headers,
      as: :json

    assert_response :success
    item.reload
    assert_equal "Updated candidate", item.title
    assert_equal "pending", item.status
    assert_nil item.imported_to_id
    assert_not ArticleLink.exists?(tournament: @tournament, url: item.url)
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

  test "approving an already approved ingest item is idempotent" do
    article = @tournament.article_links.create!(
      title: "Already imported",
      source: "GSPN",
      url: "https://example.com/already-imported"
    )
    item = @tournament.content_ingest_items.create!(
      kind: "article",
      status: "approved",
      source: "GSPN",
      title: "Already imported",
      url: article.url,
      imported_to_id: article.id.to_s
    )

    assert_no_difference -> { ArticleLink.count } do
      post "/api/v1/admin/content-ingest-items/#{item.id}/approve", headers: auth_headers
    end

    assert_response :success
    item.reload
    assert_equal "approved", item.status
    assert_equal article.id.to_s, item.imported_to_id
    assert_equal article.id.to_s, JSON.parse(response.body).dig("imported", "id")
  end

  test "approved ingest item cannot be rejected" do
    article = @tournament.article_links.create!(
      title: "Approved import",
      source: "GSPN",
      url: "https://example.com/approved-import"
    )
    item = @tournament.content_ingest_items.create!(
      kind: "article",
      status: "approved",
      source: "GSPN",
      title: "Approved import",
      url: article.url,
      imported_to_id: article.id.to_s
    )

    post "/api/v1/admin/content-ingest-items/#{item.id}/reject", headers: auth_headers

    assert_response :conflict
    item.reload
    assert_equal "approved", item.status
    assert_equal article.id.to_s, item.imported_to_id
  end

  test "approved ingest item with stale import reference returns conflict" do
    item = @tournament.content_ingest_items.create!(
      kind: "article",
      status: "approved",
      source: "GSPN",
      title: "Stale import",
      url: "https://example.com/stale-import",
      imported_to_id: "999999"
    )

    post "/api/v1/admin/content-ingest-items/#{item.id}/approve", headers: auth_headers

    assert_response :conflict
    item.reload
    assert_equal "999999", item.imported_to_id
  end

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
