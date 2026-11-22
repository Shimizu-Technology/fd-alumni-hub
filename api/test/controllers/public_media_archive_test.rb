require "test_helper"

class PublicMediaArchiveTest < ActionDispatch::IntegrationTest
  test "cross-year filters include completed media and keep unpublished game attachments private" do
    archive = tournament(2008, "completed")
    other = tournament(2026, "live")
    photo = archive.media_assets.create!(title: "Opening night", source: "GSPN", image_url: "https://example.test/photo.jpg")
    video = archive.media_assets.create!(title: "Championship", source: "PNC", media_type: "video",
      video_url: "https://www.youtube.com/watch?v=LIIbnqa9k5E", video_provider: "youtube", external_video_id: "LIIbnqa9k5E")
    home = other.teams.create!(display_name: "Home", class_year_label: "Home")
    away = other.teams.create!(display_name: "Away", class_year_label: "Away")
    game = other.games.create!(home_team: home, away_team: away, start_time: other.start_date.in_time_zone)
    other.media_assets.create!(game: game, title: "Upcoming matchup", source: "GSPN", image_url: "https://example.test/schedule.jpg")

    assert_equal [ video.id, photo.id ].sort, ids_for(archive: "true").sort
    assert_equal [ video.id ], ids_for(archive: "true", mediaType: "video")
    assert_equal [ photo.id ], ids_for(archive: "true", mediaType: "photo")
    assert_empty ids_for(archive: "true", year: 2026)
    assert_equal [ video.id, photo.id ].sort, ids_for(year: 2008).sort
  end

  private

  def ids_for(params)
    get "/api/v1/public/media-assets", params: params
    assert_response :success
    response.parsed_body.fetch("mediaAssets").pluck("id").map(&:to_i)
  end

  def tournament(year, status)
    Tournament.create!(year: year, status: status, name: "FD Alumni", start_date: Date.new(year, 7, 1), end_date: Date.new(year, 7, 31))
  end
end
