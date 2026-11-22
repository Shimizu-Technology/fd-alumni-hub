class AddUniqueIndexToRosterEntries < ActiveRecord::Migration[8.1]
  def up
    # Deduplicate existing (team_id, lower(btrim(name))) rows, keeping the most recently updated entry (highest id tie-break)
    execute <<~SQL
      DELETE FROM roster_entries
      WHERE id IN (
        SELECT id
        FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY team_id, lower(btrim(name))
                   ORDER BY updated_at DESC, id DESC
                 ) AS rn
          FROM roster_entries
        ) ranked
        WHERE ranked.rn > 1
      );
    SQL

    add_index :roster_entries,
      "team_id, lower(btrim((name)::text))",
      unique: true,
      name: "index_roster_entries_on_team_and_lower_name"
  end

  def down
    remove_index :roster_entries, name: "index_roster_entries_on_team_and_lower_name" if index_exists?(:roster_entries, name: "index_roster_entries_on_team_and_lower_name")
  end
end
