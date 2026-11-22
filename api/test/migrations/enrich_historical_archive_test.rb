require "test_helper"
require Rails.root.join("db/migrate/20261123000008_enrich_historical_archive")

class EnrichHistoricalArchiveTest < ActiveSupport::TestCase
  test "rollback restores photo constraints and up restores archive fields and defaults" do
    tournament = Tournament.create!(name: "FD Alumni", year: 2026, start_date: "2026-07-03", end_date: "2026-07-30", status: "completed")
    media = tournament.media_assets.create!(media_type: "video", title: "Archived game", source: "Public broadcaster", video_url: "https://example.com/video")
    connection = MediaAsset.connection

    connection.transaction(requires_new: true) do
      ActiveRecord::Migration.suppress_messages do
        EnrichHistoricalArchive.new.migrate(:down)
        assert_not connection.column_exists?(:media_assets, :media_type)
        assert_not connection.column_exists?(:games, :top_performers_json)
        assert_not connection.foreign_key_exists?(:tournament_champions, :media_assets, column: :highlight_video_id)
        assert_equal false, connection.columns(:media_assets).find { |column| column.name == "image_url" }.null
        assert_equal "/brand/fd-crest.png", connection.select_value("SELECT image_url FROM media_assets WHERE id = #{media.id.to_i}")

        EnrichHistoricalArchive.new.migrate(:up)
        assert connection.column_exists?(:games, :top_performers_json, :jsonb)
        assert connection.foreign_key_exists?(:tournament_champions, :media_assets, column: :highlight_video_id, on_delete: :nullify)
        assert connection.foreign_key_exists?(:tournament_champions, :article_links, column: :recap_article_id, on_delete: :nullify)
        assert connection.foreign_key_exists?(:tournaments, :class_cohorts, column: :host_class_cohort_id, on_delete: :nullify)
        assert connection.index_exists?(:media_assets, [ :tournament_id, :external_video_id ], unique: true, where: "(external_video_id IS NOT NULL)")
        assert_equal true, connection.columns(:media_assets).find { |column| column.name == "image_url" }.null
        assert_equal "photo", connection.select_value("SELECT media_type FROM media_assets WHERE id = #{media.id.to_i}")
        assert connection.check_constraint_exists?(:media_assets, name: "media_assets_media_type")
        assert connection.check_constraint_exists?(:article_links, name: "article_links_kind")
      end
      raise ActiveRecord::Rollback
    end
  ensure
    connection&.clear_cache!
  end
end
