class AddLegacyIdsForNextMigration < ActiveRecord::Migration[8.1]
  TABLES = %i[
    tournaments
    teams
    games
    standings
    article_links
    media_assets
    sponsors
    content_ingest_items
    admin_whitelists
    users
  ].freeze

  def change
    TABLES.each do |table_name|
      add_column table_name, :legacy_id, :string
      add_index table_name, :legacy_id, unique: true, where: "legacy_id IS NOT NULL"
    end
  end
end
