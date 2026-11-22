require "test_helper"

class MediaAssetTest < ActiveSupport::TestCase
  setup do
    @tournament = Tournament.create!(name: "FD Alumni", year: 2026, start_date: "2026-07-03", end_date: "2026-07-30", status: "completed")
  end

  test "YouTube videos get a thumbnail and a privacy-enhanced embed URL" do
    asset = youtube_video
    asset.save!

    assert_equal "https://i.ytimg.com/vi/n2lw-cEOlRU/hqdefault.jpg", asset.image_url
    assert_equal "https://www.youtube-nocookie.com/embed/n2lw-cEOlRU", asset.api_json[:embedUrl]
    assert_equal "video", asset.api_json[:mediaType]

    assert_no_changes -> { asset.reload.image_url } do
      asset.update!(title: "Updated title")
    end
    asset.update!(image_url: "https://example.com/custom.jpg")
    assert_equal "https://example.com/custom.jpg", asset.image_url
  end

  test "malformed or missing IDs cannot produce embeds" do
    [ nil, "", "abcdefghijk\n", "short", "abcdefghijkl", "a/bcdefghij" ].each do |value|
      asset = youtube_video(external_video_id: value)
      assert_not asset.valid?
      assert asset.errors[:external_video_id].present?
      assert_nil asset.api_json[:embedUrl]
      assert_nil asset.image_url
    end
  end

  test "a video ID can only appear once per tournament" do
    youtube_video.save!
    duplicate = youtube_video
    assert_not duplicate.valid?
    assert duplicate.errors.of_kind?(:external_video_id, :taken)

    other = Tournament.create!(name: "FD Alumni", year: 2016, start_date: "2016-06-24", end_date: "2016-07-16", status: "completed")
    duplicate.tournament = other
    assert duplicate.valid?
  end

  test "video and article links enforce safe HTTPS" do
    [ "javascript:alert(1)", "http://localhost/watch", "http://www.youtube.com/watch", "https://user@evil.test/" ].each do |unsafe|
      asset = youtube_video(video_url: unsafe, article_url: unsafe)
      assert_not asset.valid?
      assert asset.errors[:video_url].present?
      assert asset.errors[:article_url].present?
    end

    champion = TournamentChampion.new(source_url: "https://example.com@evil.test/")
    assert_not champion.valid?
    assert champion.errors[:source_url].present?
  end

  test "photo and gallery need images while video needs a watch URL" do
    asset = @tournament.media_assets.build(title: "Tournament media", source: "GSPN")
    assert_equal "photo", asset.media_type
    assert_not asset.valid?
    assert asset.errors[:image_url].present?
    asset.media_type = "gallery"
    assert_not asset.valid?
    assert asset.errors[:image_url].present?
    asset.media_type = "video"
    assert_not asset.valid?
    assert asset.errors[:video_url].present?
    asset.video_url = "https://example.com/watch"
    asset.save!
    assert_nil asset.image_url
    assert_nil asset.api_json[:embedUrl]
  end

  private

  def youtube_video(**overrides)
    @tournament.media_assets.build({
      title: "Class of 2006 wins", source: "kuamnews", media_type: "video", video_provider: "youtube",
      external_video_id: "n2lw-cEOlRU", video_url: "https://www.youtube.com/watch?v=n2lw-cEOlRU"
    }.merge(overrides))
  end
end
