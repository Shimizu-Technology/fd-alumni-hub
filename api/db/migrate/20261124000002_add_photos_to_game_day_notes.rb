class AddPhotosToGameDayNotes < ActiveRecord::Migration[8.1]
  def change
    add_column :game_day_notes, :photos, :jsonb, default: [], null: false
  end
end
