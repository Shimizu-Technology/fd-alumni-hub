class EnrichHistoricalArchive < ActiveRecord::Migration[8.1]
  def up
    add_column :media_assets, :media_type, :string, null: false, default: "photo"
    add_column :media_assets, :video_url, :string
    add_column :media_assets, :video_provider, :string
    add_column :media_assets, :external_video_id, :string
    add_column :media_assets, :duration_seconds, :integer
    add_column :media_assets, :division_slug, :string
    change_column_null :media_assets, :image_url, true
    add_check_constraint :media_assets, "media_type IN ('photo', 'video', 'gallery')", name: "media_assets_media_type"
    add_index :media_assets, [ :tournament_id, :external_video_id ], unique: true, where: "external_video_id IS NOT NULL",
      name: "index_media_assets_on_tournament_and_external_video_id"

    add_column :tournament_champions, :mvp_name, :string
    add_column :tournament_champions, :mvp_note, :string
    add_column :tournament_champions, :source_url, :string
    add_reference :tournament_champions, :recap_article, foreign_key: { to_table: :article_links, on_delete: :nullify }
    add_reference :tournament_champions, :highlight_video, foreign_key: { to_table: :media_assets, on_delete: :nullify }

    add_column :tournaments, :host_class_label, :string
    add_reference :tournaments, :host_class_cohort, foreign_key: { to_table: :class_cohorts, on_delete: :nullify }
    add_column :tournaments, :edition_number, :integer
    add_column :tournaments, :theme, :string

    add_column :article_links, :kind, :string, null: false, default: "recap"
    add_column :article_links, :division_slug, :string
    add_column :article_links, :photo_count, :integer
    add_check_constraint :article_links, "kind IN ('preview', 'recap', 'playoffs', 'championship', 'history', 'event_page')",
      name: "article_links_kind"

    add_column :games, :top_performers_json, :jsonb, null: false, default: []
  end

  def down
    remove_column :games, :top_performers_json

    remove_check_constraint :article_links, name: "article_links_kind"
    remove_columns :article_links, :kind, :division_slug, :photo_count

    remove_reference :tournaments, :host_class_cohort, foreign_key: { to_table: :class_cohorts }
    remove_columns :tournaments, :host_class_label, :edition_number, :theme

    remove_reference :tournament_champions, :recap_article, foreign_key: { to_table: :article_links }
    remove_reference :tournament_champions, :highlight_video, foreign_key: { to_table: :media_assets }
    remove_columns :tournament_champions, :mvp_name, :mvp_note, :source_url

    remove_index :media_assets, name: "index_media_assets_on_tournament_and_external_video_id"
    remove_check_constraint :media_assets, name: "media_assets_media_type"
    change_column_null :media_assets, :image_url, false, "/brand/fd-crest.png"
    remove_columns :media_assets, :media_type, :video_url, :video_provider, :external_video_id, :duration_seconds, :division_slug
  end
end
