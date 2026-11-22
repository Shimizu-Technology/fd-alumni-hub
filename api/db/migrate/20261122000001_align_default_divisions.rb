class AlignDefaultDivisions < ActiveRecord::Migration[8.1]
  CANONICAL_DIVISIONS = [
    [ "Maroon", "maroon", 1 ],
    [ "Gold", "gold", 2 ],
    [ "Platinum", "platinum", 3 ],
    [ "Special", "special", 4 ]
  ].freeze

  def up
    now = quote(Time.current)

    CANONICAL_DIVISIONS.each do |name, slug, position|
      execute <<~SQL.squish
        INSERT INTO divisions (name, slug, starts_year, position, active, created_at, updated_at)
        VALUES (#{quote(name)}, #{quote(slug)}, NULL, #{position}, TRUE, #{now}, #{now})
        ON CONFLICT (slug) DO UPDATE
          SET position = EXCLUDED.position,
              active = TRUE,
              starts_year = NULL,
              updated_at = EXCLUDED.updated_at
      SQL
    end

    # Deactivate the accidental legacy "Diamond" default division only if no teams
    # or games reference it, preserving any environment where it was used manually.
    execute <<~SQL.squish
      UPDATE divisions
      SET active = FALSE, updated_at = #{now}
      WHERE slug = 'diamond'
        AND NOT EXISTS (SELECT 1 FROM teams WHERE teams.division_id = divisions.id OR LOWER(COALESCE(teams.division, '')) = 'diamond')
        AND NOT EXISTS (SELECT 1 FROM games WHERE games.division_id = divisions.id OR LOWER(COALESCE(games.division, '')) = 'diamond')
    SQL
  end

  def down
    now = quote(Time.current)
    execute <<~SQL.squish
      UPDATE divisions
      SET active = TRUE, updated_at = #{now}
      WHERE slug = 'diamond'
    SQL
  end
end
