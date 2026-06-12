class AddPlaceholderToGames < ActiveRecord::Migration[8.1]
  def change
    add_column :games, :placeholder, :boolean, default: false, null: false
    add_index :games, [ :tournament_id, :placeholder ]
  end
end
