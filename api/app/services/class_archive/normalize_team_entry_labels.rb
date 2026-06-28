module ClassArchive
  class NormalizeTeamEntryLabels
    CANONICAL_LABELS = {
      "435" => "430-5",
      "815" => "08/15",
      "8/15" => "08/15"
    }.freeze

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
      label = value.to_s.strip
      CANONICAL_LABELS.fetch(normalize(label), label)
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

      replacement = canonical_legacy_id(legacy_id)
      return false if replacement == legacy_id
      return false if Team.where.not(id: team.id).exists?(legacy_id: replacement)

      team.legacy_id = replacement
      true
    end

    def canonical_legacy_id(legacy_id)
      CANONICAL_LABELS.reduce(legacy_id) do |value, (source_label, canonical)|
        value.gsub("-#{stable_slug(source_label)}", "-#{stable_slug(canonical)}")
      end
    end

    def normalize(value)
      value.to_s.downcase.strip.gsub(/\Aclass\s+/, "").gsub(/\s+/, " ")
    end

    def stable_slug(value)
      value.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|\-\z/, "")
    end
  end
end
