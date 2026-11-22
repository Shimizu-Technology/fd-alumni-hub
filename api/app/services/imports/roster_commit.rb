module Imports
  class RosterCommit
    class ValidationError < StandardError
      attr_reader :preview

      def initialize(message, preview:)
        super(message)
        @preview = preview
      end
    end

    def self.call(tournament:, rows:)
      new(tournament: tournament, rows: rows).call
    end

    def initialize(tournament:, rows:)
      @tournament = tournament
      @rows = rows
    end

    def call
      raise Imports::RosterParser::ParseError, "At least one roster row is required to commit" unless @rows.is_a?(Array) && @rows.any?

      created = 0
      updated = 0
      unchanged = 0

      @tournament.with_lock do
        preview = Imports::RosterPreview.call(tournament: @tournament, rows: @rows)
        if preview.dig(:summary, :errorCount).to_i.positive?
          raise ValidationError.new("Resolve all roster errors before committing the import.", preview: preview)
        end

        teams_by_id = @tournament.teams.includes(:roster_entries).index_by { |t| t.id.to_s }
        sort_counters = teams_by_id.transform_values { |team| team.roster_entries.map(&:sort_order).compact.max.to_i }

        preview[:rows].each do |row|
          team = teams_by_id.fetch(row[:teamId])
          if row[:matchedEntryId].present?
            if row[:action] == "unchanged"
              unchanged += 1
              next
            end

            entry = team.roster_entries.find(row[:matchedEntryId])
            attrs = { name: row[:name], active: true }
            attrs[:jersey_number] = row[:jerseyNumber] if row[:jerseyNumber].present?
            attrs[:position] = row[:position] if row[:position].present?
            attrs[:nickname] = row[:nickname] if row[:nickname].present?
            entry.update!(attrs)
            updated += 1
          else
            sort_counters[row[:teamId]] += 1
            team.roster_entries.create!(
              name: row[:name],
              jersey_number: row[:jerseyNumber],
              position: row[:position],
              nickname: row[:nickname],
              sort_order: sort_counters[row[:teamId]],
              active: true
            )
            created += 1
          end
        end
      end

      {
        tournamentId: @tournament.id.to_s,
        created: created,
        updated: updated,
        unchanged: unchanged
      }
    end
  end
end
