class AddGameRefsToArticleLinksAndMediaAssets < ActiveRecord::Migration[8.1]
  def change
    add_reference :article_links, :game, foreign_key: { to_table: :games, on_delete: :nullify }
    add_reference :media_assets, :game, foreign_key: { to_table: :games, on_delete: :nullify }
  end
end
