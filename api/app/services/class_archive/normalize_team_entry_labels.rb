module ClassArchive
  class NormalizeTeamEntryLabels
    def self.call
      new.call
    end

    def call
      return skipped_result unless ready?

      updated = 0
      Team.find_each do |team|
        updated += 1 if normalize_team(team)
      end

      { normalizedTeamLabels: updated, skipped: false }
    end

    def self.canonical_label(value)
      new.canonical_label(value)
    end

    def canonical_label(value)
      ClassArchive::TeamEntryLabels.canonical_label(value)
    end

    private

    def ready?
      Team.table_exists?
    end

    def skipped_result
      { normalizedTeamLabels: 0, skipped: true }
    end

    def normalize_team(team)
      changed = normalize_label_fields(team)
      changed = normalize_legacy_id(team) || changed
      return false unless changed

      team.save!
      true
    end

    def normalize_label_fields(team)
      changed = false
      %i[class_year_label display_name].each do |field|
        current = team.public_send(field)
        canonical = canonical_label(current)
        next if canonical == current
        next if field == :display_name && display_name_taken?(team, canonical)

        team.public_send("#{field}=", canonical)
        changed = true
      end
      changed
    end

    def display_name_taken?(team, display_name)
      Team.where(tournament_id: team.tournament_id, display_name: display_name).where.not(id: team.id).exists?
    end

    def normalize_legacy_id(team)
      legacy_id = team.legacy_id.to_s
      return false if legacy_id.blank?

      replacement = ClassArchive::TeamEntryLabels.canonical_legacy_id(legacy_id)
      return false if replacement == legacy_id
      return false if Team.where.not(id: team.id).exists?(legacy_id: replacement)

      team.legacy_id = replacement
      true
    end
  end
end
