class AllowDuplicateMediaAssetImages < ActiveRecord::Migration[8.1]
  def change
    remove_index :media_assets, name: "index_media_assets_on_tournament_id_and_image_url"
    add_index :media_assets, [ :tournament_id, :image_url ], name: "index_media_assets_on_tournament_id_and_image_url"
  end
end
