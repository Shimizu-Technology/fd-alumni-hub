class ScopeDivisionsToTournaments < ActiveRecord::Migration[8.1]
  class MigrationTournament < ActiveRecord::Base
    self.table_name = "tournaments"
  end

  class MigrationDivision < ActiveRecord::Base
    self.table_name = "divisions"
  end

  class MigrationTeam < ActiveRecord::Base
    self.table_name = "teams"
  end

  class MigrationGame < ActiveRecord::Base
    self.table_name = "games"
  end

  def up
    add_reference :divisions, :tournament, foreign_key: { on_delete: :cascade }, null: true
    add_column :divisions, :counts_for_standings, :boolean, default: true, null: false

    remove_index :divisions, :slug if index_exists?(:divisions, :slug)

    MigrationDivision.reset_column_information
    MigrationTeam.reset_column_information
    MigrationGame.reset_column_information

    global_divisions = MigrationDivision.where(tournament_id: nil).order(:position, :id).to_a

    MigrationTournament.order(:id).find_each do |tournament|
      teams = MigrationTeam.where(tournament_id: tournament.id).to_a
      games = MigrationGame.where(tournament_id: tournament.id).to_a

      referenced_ids = (teams.filter_map(&:division_id) + games.filter_map(&:division_id)).uniq
      referenced_names_down = (teams.filter_map(&:division) + games.filter_map(&:division))
        .map { |n| n.to_s.strip.downcase }
        .reject(&:blank?)
        .uniq

      created_by_old_id = {}
      created_by_lower_name = {}
      used_slugs = {}
      max_pos = 0

      global_divisions.each do |gdiv|
        is_referenced = referenced_ids.include?(gdiv.id) || referenced_names_down.include?(gdiv.name.to_s.strip.downcase)
        is_available = gdiv.active && (gdiv.starts_year.nil? || gdiv.starts_year <= tournament.year)
        next unless is_referenced || is_available

        slug = unique_slug_for(gdiv.slug.presence || gdiv.name.to_s.parameterize, used_slugs)
        used_slugs[slug] = true
        pos = gdiv.position.to_i
        max_pos = pos if pos > max_pos

        cloned = MigrationDivision.create!(
          tournament_id: tournament.id,
          name: gdiv.name.to_s.strip,
          slug: slug,
          starts_year: gdiv.starts_year,
          position: pos,
          # Keep referenced historical divisions active for that tournament so historical standings stay intact
          active: is_referenced ? true : gdiv.active,
          counts_for_standings: !gdiv.name.to_s.strip.casecmp?("Special")
        )
        created_by_old_id[gdiv.id] = cloned
        created_by_lower_name[cloned.name.downcase] = cloned
      end

      # Preserve any legacy division strings that did not match a global division row
      (teams.filter_map(&:division) + games.filter_map(&:division)).each do |raw_name|
        clean = raw_name.to_s.strip
        next if clean.blank? || created_by_lower_name.key?(clean.downcase)

        max_pos += 1
        slug = unique_slug_for(clean.parameterize.presence || "division-#{max_pos}", used_slugs)
        used_slugs[slug] = true
        extra = MigrationDivision.create!(
          tournament_id: tournament.id,
          name: clean,
          slug: slug,
          starts_year: tournament.year,
          position: max_pos,
          active: true,
          counts_for_standings: !clean.casecmp?("Special")
        )
        created_by_lower_name[clean.downcase] = extra
      end

      teams.each do |team|
        target = created_by_old_id[team.division_id] || created_by_lower_name[team.division.to_s.strip.downcase]
        next unless target

        MigrationTeam.where(id: team.id).update_all(division_id: target.id, division: target.name)
      end

      games.each do |game|
        target = created_by_old_id[game.division_id] || created_by_lower_name[game.division.to_s.strip.downcase]
        next unless target

        MigrationGame.where(id: game.id).update_all(division_id: target.id, division: target.name)
      end
    end

    # Safety assertion before deleting legacy global rows
    global_ids = MigrationDivision.where(tournament_id: nil).pluck(:id)
    if global_ids.any?
      orphan_teams = MigrationTeam.where(division_id: global_ids).count
      orphan_games = MigrationGame.where(division_id: global_ids).count
      if orphan_teams.positive? || orphan_games.positive?
        raise "Cannot remove global divisions: #{orphan_teams} teams and #{orphan_games} games still reference them"
      end

      MigrationDivision.where(id: global_ids).delete_all
    end

    change_column_null :divisions, :tournament_id, false

    add_index :divisions, [ :tournament_id, :slug ], unique: true, name: "index_divisions_on_tournament_and_slug"
    add_index :divisions, "tournament_id, lower((name)::text)", unique: true, name: "index_divisions_on_tournament_and_lower_name"
    add_index :divisions, [ :tournament_id, :active, :position ], name: "index_divisions_on_tournament_active_position"
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Scoping divisions per tournament cannot be reversed automatically"
  end

  private

  def unique_slug_for(base_slug, used)
    candidate = base_slug.presence || "division"
    return candidate unless used[candidate]

    suffix = 2
    loop do
      attempt = "#{candidate}-#{suffix}"
      return attempt unless used[attempt]

      suffix += 1
    end
  end
end
