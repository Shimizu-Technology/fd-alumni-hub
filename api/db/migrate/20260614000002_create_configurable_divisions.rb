class CreateConfigurableDivisions < ActiveRecord::Migration[8.1]
  DEFAULT_DIVISIONS = [
    [ "Maroon", "maroon", 1 ],
    [ "Gold", "gold", 2 ],
    [ "Diamond", "diamond", 3 ]
  ].freeze

  def up
    create_table :divisions do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.integer :starts_year
      t.integer :position, default: 0, null: false
      t.boolean :active, default: true, null: false
      t.timestamps
    end

    add_index :divisions, :slug, unique: true
    add_index :divisions, [ :active, :starts_year, :position ]

    add_reference :teams, :division, null: true, foreign_key: { to_table: :divisions, on_delete: :nullify }
    add_reference :games, :division, null: true, foreign_key: { to_table: :divisions, on_delete: :nullify }

    seed_default_divisions
  end

  def down
    remove_reference :games, :division, foreign_key: { to_table: :divisions }
    remove_reference :teams, :division, foreign_key: { to_table: :divisions }
    drop_table :divisions
  end

  private

  def seed_default_divisions
    now = quote(Time.current)
    values = DEFAULT_DIVISIONS.map do |name, slug, position|
      "(#{quote(name)}, #{quote(slug)}, NULL, #{position}, TRUE, #{now}, #{now})"
    end.join(", ")

    execute <<~SQL.squish
      INSERT INTO divisions (name, slug, starts_year, position, active, created_at, updated_at)
      VALUES #{values}
      ON CONFLICT (slug) DO NOTHING
    SQL
  end
end
