require "test_helper"

class PublicArticlesControllerTest < ActionDispatch::IntegrationTest
  test "archive=true returns articles across publicly visible tournaments and includes availableYears" do
    t_2025 = Tournament.create!(name: "2025 Alumni", year: 2025, start_date: Date.new(2025, 6, 20), end_date: Date.new(2025, 7, 12), status: "completed", schedule_published_at: Time.current, schedule_revision: 1)
    t_2026 = Tournament.create!(name: "2026 Alumni", year: 2026, start_date: Date.new(2026, 6, 20), end_date: Date.new(2026, 7, 12), status: "completed", schedule_published_at: Time.current, schedule_revision: 1)
    t_2027 = Tournament.create!(name: "2027 Alumni", year: 2027, start_date: Date.new(2027, 6, 25), end_date: Date.new(2027, 7, 16), status: "upcoming")

    SitePublication.create!(mode: "fundraising", tournament: t_2027, version_number: 1, current: true, published_at: Time.current)

    t_2025.article_links.create!(title: "2025 Finals", source: "GSPN", url: "https://example.com/2025-finals", kind: "recap", published_at: Time.utc(2025, 7, 12))
    t_2026.article_links.create!(title: "2026 Finals", source: "GSPN", url: "https://example.com/2026-finals", kind: "recap", published_at: Time.utc(2026, 7, 12))
    t_2027.article_links.create!(title: "2027 Host Announcement", source: "FDAA", url: "https://example.com/2027-host", kind: "preview", published_at: Time.utc(2026, 11, 20))

    get "/api/v1/public/articles", params: { archive: "true" }
    assert_response :success
    body = response.parsed_body

    assert_equal [ 2027, 2026, 2025 ], body["availableYears"]
    assert_equal [ "2027 Host Announcement", "2026 Finals", "2025 Finals" ], body["articles"].pluck("title")
    assert_equal [ 2027, 2026, 2025 ], body["articles"].pluck("tournamentYear")

    get "/api/v1/public/articles", params: { year: 2025 }
    assert_response :success
    year_body = response.parsed_body
    assert_equal [ "2025 Finals" ], year_body["articles"].pluck("title")
    assert_equal [ 2027, 2026, 2025 ], year_body["availableYears"]
  end
end
