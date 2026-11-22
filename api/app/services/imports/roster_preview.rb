module Imports
  class RosterPreview
    def self.call(tournament:, rows: nil, content: nil, format: "auto")
      new(tournament: tournament, rows: rows, content: content, format: format).call
    end

    def initialize(tournament:, rows: nil, content: nil, format: "auto")
      @tournament = tournament
      @raw_rows = rows
      @content = content
      @format = format
    end

    # Strictly read-only: NEVER writes to roster_entries or teams.
    def call
      if @raw_rows.is_a?(Array)
        detected_format = "structured"
        parsed_rows = normalize_structured_rows(@raw_rows)
      else
        parsed = Imports::RosterParser.call(content: @content, format: @format)
        detected_format = parsed.detected_format
        parsed_rows = parsed.rows
      end

      teams = @tournament.teams.includes(:roster_entries).to_a
      teams_by_key = index_teams(teams)
      existing_by_team_and_name = {}
      teams.each do |team|
        team.roster_entries.each do |entry|
          existing_by_team_and_name[[ team.id, entry.name.to_s.strip.downcase ]] = entry
        end
      end

      seen_in_batch = {}

      evaluated_rows = parsed_rows.map.with_index(1) do |row, seq|
        errors = []
        warnings = []

        errors << "Team is required" if row[:team].blank?
        errors << "Player name is required" if row[:name].blank?

        team = resolve_team(row[:team], teams_by_key)
        if row[:team].present? && team.nil?
          errors << "Team '#{row[:team]}' not found in this tournament"
        end

        clean_name = row[:name].to_s.strip
        if team && clean_name.present?
          batch_key = [ team.id, clean_name.downcase ]
          if seen_in_batch[batch_key]
            errors << "Duplicate player '#{clean_name}' for #{team.display_name} (first seen on row #{seen_in_batch[batch_key]})"
          else
            seen_in_batch[batch_key] = row[:rowIndex] || seq
          end
        end

        existing = (team && clean_name.present?) ? existing_by_team_and_name[[ team.id, clean_name.downcase ]] : nil

        action = if errors.any?
          "error"
        elsif existing
          warnings << "Will reactivate hidden roster entry" unless existing.active?
          entry_changed?(existing, row) ? "update" : "unchanged"
        else
          "create"
        end

        {
          rowIndex: row[:rowIndex] || seq,
          action: action,
          teamId: team&.id&.to_s,
          team: team&.display_name || row[:team],
          matchedEntryId: existing&.id&.to_s,
          name: clean_name,
          jerseyNumber: row[:jerseyNumber],
          position: row[:position],
          nickname: row[:nickname],
          errors: errors,
          warnings: warnings
        }
      end

      summary = {
        totalRows: evaluated_rows.length,
        createCount: evaluated_rows.count { |r| r[:action] == "create" },
        updateCount: evaluated_rows.count { |r| r[:action] == "update" },
        unchangedCount: evaluated_rows.count { |r| r[:action] == "unchanged" },
        errorCount: evaluated_rows.count { |r| r[:action] == "error" }
      }

      {
        tournamentId: @tournament.id.to_s,
        detectedFormat: detected_format,
        summary: summary,
        rows: evaluated_rows
      }
    end

    private

    def normalize_structured_rows(raw_rows)
      raise Imports::RosterParser::ParseError, "Roster import exceeds maximum of #{Imports::RosterParser::MAX_ROWS} rows" if raw_rows.length > Imports::RosterParser::MAX_ROWS

      raw_rows.map.with_index(1) do |item, idx|
        h = item.respond_to?(:to_h) ? item.to_h.symbolize_keys : {}
        {
          rowIndex: h[:rowIndex] || idx,
          team: h[:team].to_s.strip.presence,
          name: h[:name].to_s.strip.presence,
          jerseyNumber: (h[:jerseyNumber] || h[:jersey_number]).to_s.strip.presence,
          position: h[:position].to_s.strip.presence,
          nickname: h[:nickname].to_s.strip.presence
        }
      end
    end

    def index_teams(teams)
      teams.each_with_object({}) do |team, map|
        map[team.display_name.downcase] = team
        map[team.class_year_label.downcase] = team if team.class_year_label.present?
        canonical = ClassArchive::TeamEntryLabels.canonical_label(team.display_name).downcase
        map[canonical] ||= team
      end
    end

    def resolve_team(raw_label, teams_by_key)
      return nil if raw_label.blank?

      clean = raw_label.to_s.strip
      teams_by_key[clean.downcase] ||
        teams_by_key[ClassArchive::TeamEntryLabels.canonical_label(clean).downcase]
    end

    def entry_changed?(existing, row)
      !existing.active? ||
        (row[:jerseyNumber].present? && existing.jersey_number != row[:jerseyNumber]) ||
        (row[:position].present? && existing.position != row[:position]) ||
        (row[:nickname].present? && existing.nickname != row[:nickname]) ||
        existing.name != row[:name].to_s.strip
    end
  end
end
