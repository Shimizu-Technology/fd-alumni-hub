module Imports
  class SchedulePreview
    def self.call(tournament:, rows: nil, content: nil, format: "auto", default_venue: "The Jungle")
      new(tournament: tournament, rows: rows, content: content, format: format, default_venue: default_venue).call
    end

    def initialize(tournament:, rows: nil, content: nil, format: "auto", default_venue: "The Jungle")
      @tournament = tournament
      @raw_rows = rows
      @content = content
      @format = format
      @default_venue = default_venue.to_s.strip.presence || "The Jungle"
    end

    # Strictly read-only: NEVER writes to teams, games, class_cohorts, or divisions.
    def call
      skipped_lines = []
      if @raw_rows.is_a?(Array)
        detected_format = "structured"
        parsed_rows = normalize_structured_rows(@raw_rows)
      else
        parsed = Imports::ScheduleParser.call(
          content: @content,
          format: @format,
          default_venue: @default_venue,
          fallback_year: @tournament.year
        )
        detected_format = parsed.detected_format
        parsed_rows = parsed.rows
        skipped_lines = parsed.skipped_lines || []
      end

      divisions_by_key = index_divisions
      existing_teams = @tournament.teams.includes(:division_record).to_a
      teams_by_key = index_teams(existing_teams)
      existing_games = @tournament.games.includes(:division_record, :home_team, :away_team).ordered.to_a
      games_by_number = existing_games.each_with_object({}) do |g, map|
        map[g.game_number.downcase] = g if g.game_number.present?
      end

      seen_game_numbers = {}
      seen_matchup_slots = {}
      matched_game_row_index = {}
      matched_game_ids = Set.new
      new_teams = {}

      evaluated_rows = parsed_rows.map.with_index(1) do |row, seq|
        evaluate_row(
          row: row,
          seq: seq,
          divisions_by_key: divisions_by_key,
          teams_by_key: teams_by_key,
          existing_games: existing_games,
          games_by_number: games_by_number,
          seen_game_numbers: seen_game_numbers,
          seen_matchup_slots: seen_matchup_slots,
          matched_game_row_index: matched_game_row_index,
          matched_game_ids: matched_game_ids,
          new_teams: new_teams
        )
      end

      unmatched_existing = existing_games
        .reject { |g| g.status == "cancelled" || matched_game_ids.include?(g.id) }
        .map { |g| unmatched_game_json(g) }

      summary = {
        totalRows: evaluated_rows.length,
        createCount: evaluated_rows.count { |r| r[:action] == "create" },
        updateCount: evaluated_rows.count { |r| r[:action] == "update" },
        unchangedCount: evaluated_rows.count { |r| r[:action] == "unchanged" },
        errorCount: evaluated_rows.count { |r| r[:action] == "error" },
        newTeamsCount: new_teams.length,
        unmatchedExistingCount: unmatched_existing.length,
        skippedLinesCount: skipped_lines.length
      }

      {
        tournamentId: @tournament.id.to_s,
        detectedFormat: detected_format,
        summary: summary,
        newTeams: new_teams.values,
        rows: evaluated_rows,
        unmatchedExistingGames: unmatched_existing,
        skippedLines: skipped_lines
      }
    end

    private

    def normalize_structured_rows(raw_rows)
      raise Imports::ScheduleParser::ParseError, "Import exceeds maximum of #{Imports::ScheduleParser::MAX_ROWS} rows" if raw_rows.length > Imports::ScheduleParser::MAX_ROWS

      raw_rows.map.with_index(1) do |item, idx|
        h = item.respond_to?(:to_h) ? item.to_h.symbolize_keys : {}
        start_time = h[:startTime].presence || h[:start_time].presence
        start_time_err = nil
        if start_time.present?
          begin
            start_time = Time.iso8601(start_time.to_s).iso8601
          rescue ArgumentError
            start_time_err = "Invalid ISO startTime '#{start_time}'"
            start_time = nil
          end
        else
          start_time_err = "startTime is required"
        end

        {
          rowIndex: h[:rowIndex] || idx,
          gameNumber: (h[:gameNumber] || h[:game_number]).to_s.strip.presence,
          bracketCode: (h[:bracketCode] || h[:bracket_code]).to_s.strip.presence,
          bracketRound: (h[:bracketRound] || h[:bracket_round]).to_s.strip.downcase.presence,
          bracketSlot: parse_int(h[:bracketSlot] || h[:bracket_slot]),
          phase: (h[:phase].to_s.strip.downcase.presence || "pool"),
          startTime: start_time,
          startTimeError: start_time_err,
          awayTeam: (h[:awayTeam] || h[:away_team]).to_s.strip.first(120).presence,
          homeTeam: (h[:homeTeam] || h[:home_team]).to_s.strip.first(120).presence,
          division: h[:division].to_s.strip.first(80).presence,
          venue: h[:venue].to_s.strip.first(160).presence,
          notes: h[:notes].to_s.strip.first(500).presence,
          status: h[:status].to_s.strip.downcase.presence,
          homeScore: parse_int(h[:homeScore] || h[:home_score]),
          awayScore: parse_int(h[:awayScore] || h[:away_score])
        }
      end
    end

    def evaluate_row(row:, seq:, divisions_by_key:, teams_by_key:, existing_games:, games_by_number:, seen_game_numbers:, seen_matchup_slots:, matched_game_row_index:, matched_game_ids:, new_teams:)
      errors = []
      warnings = []

      errors << row[:startTimeError] if row[:startTimeError].present?
      errors << "Away team is required" if row[:awayTeam].blank?
      errors << "Home team is required" if row[:homeTeam].blank?

      away_canonical = row[:awayTeam].present? ? ClassArchive::TeamEntryLabels.canonical_label(row[:awayTeam]) : nil
      home_canonical = row[:homeTeam].present? ? ClassArchive::TeamEntryLabels.canonical_label(row[:homeTeam]) : nil

      if away_canonical.present? && home_canonical.present? && away_canonical.casecmp?(home_canonical)
        errors << "Home team and away team must be different"
      end

      if row[:startTime].present? && away_canonical.present? && home_canonical.present?
        slot_key = [ row[:startTime], home_canonical.downcase, away_canonical.downcase ]
        if seen_matchup_slots[slot_key]
          errors << "Duplicate matchup at #{row[:startTime]} (first seen on row #{seen_matchup_slots[slot_key]})"
        else
          seen_matchup_slots[slot_key] = row[:rowIndex] || seq
        end
      end

      phase = row[:phase].to_s.strip.downcase.presence || "pool"
      unless Game::PHASES.include?(phase)
        errors << "Invalid phase '#{phase}' (allowed: #{Game::PHASES.join(', ')})"
      end

      if row[:bracketRound].present? && !Game::BRACKET_ROUNDS.include?(row[:bracketRound])
        errors << "Invalid bracketRound '#{row[:bracketRound]}'"
      end

      if row[:bracketSlot].present? && row[:bracketSlot] <= 0
        errors << "bracketSlot must be positive"
      end

      if row[:status].present? && !Game::STATUSES.include?(row[:status])
        errors << "Invalid status '#{row[:status]}'"
      end

      if row[:gameNumber].present?
        if row[:gameNumber].length > 32
          errors << "gameNumber must be 32 characters or fewer"
        else
          key = row[:gameNumber].downcase
          if seen_game_numbers[key]
            errors << "Duplicate gameNumber '#{row[:gameNumber]}' in import (first seen on row #{seen_game_numbers[key]})"
          else
            seen_game_numbers[key] = row[:rowIndex] || seq
          end
        end
      end

      division_record = nil
      if row[:division].present?
        division_record = divisions_by_key[row[:division].downcase]
        if division_record.nil?
          errors << "Unknown division '#{row[:division]}' for this tournament"
        elsif !division_record.active?
          errors << "Division '#{division_record.name}' is inactive for this tournament"
        end
      else
        warnings << "No division specified (standings require teams to have a division)"
      end

      away_team = away_canonical ? teams_by_key[away_canonical.downcase] : nil
      home_team = home_canonical ? teams_by_key[home_canonical.downcase] : nil

      if away_canonical.present? && away_team.nil? && errors.empty?
        register_new_team(new_teams, away_canonical, division_record)
      end
      if home_canonical.present? && home_team.nil? && errors.empty?
        register_new_team(new_teams, home_canonical, division_record)
      end

      existing_game = match_existing_game(
        row: row,
        games_by_number: games_by_number,
        existing_games: existing_games,
        home_team: home_team,
        away_team: away_team
      )

      if existing_game
        if matched_game_row_index[existing_game.id]
          errors << "Matches the same existing game (##{existing_game.game_number || existing_game.id}) as row #{matched_game_row_index[existing_game.id]}"
        else
          matched_game_row_index[existing_game.id] = row[:rowIndex] || seq
        end
      end

      action = if errors.any?
        "error"
      elsif existing_game
        matched_game_ids.add(existing_game.id)
        if existing_game.home_score.present? || existing_game.away_score.present?
          warnings << "Existing game already has recorded scores (#{existing_game.away_score}-#{existing_game.home_score}); preserved unless Overwrite Scores is checked"
        end
        game_changed?(existing_game, row, home_team, away_team, division_record, phase) ? "update" : "unchanged"
      else
        "create"
      end

      {
        rowIndex: row[:rowIndex] || seq,
        action: action,
        matchedGameId: existing_game&.id&.to_s,
        gameNumber: row[:gameNumber],
        bracketCode: row[:bracketCode] || row[:gameNumber],
        bracketRound: row[:bracketRound],
        bracketSlot: row[:bracketSlot],
        phase: phase,
        startTime: row[:startTime],
        awayTeam: away_canonical || row[:awayTeam],
        awayTeamId: away_team&.id&.to_s,
        homeTeam: home_canonical || row[:homeTeam],
        homeTeamId: home_team&.id&.to_s,
        division: division_record&.name || row[:division],
        divisionId: division_record&.id&.to_s,
        venue: row[:venue],
        notes: row[:notes],
        status: row[:status],
        homeScore: row[:homeScore],
        awayScore: row[:awayScore],
        errors: errors,
        warnings: warnings
      }
    end

    def match_existing_game(row:, games_by_number:, existing_games:, home_team:, away_team:)
      if row[:gameNumber].present?
        by_num = games_by_number[row[:gameNumber].downcase]
        return by_num if by_num
      end

      return nil unless row[:startTime].present? && home_team && away_team

      target_time = Time.iso8601(row[:startTime])
      existing_games.find do |g|
        g.start_time.to_i == target_time.to_i &&
          g.home_team_id == home_team.id &&
          g.away_team_id == away_team.id
      end
    rescue ArgumentError
      nil
    end

    def game_changed?(existing, row, home_team, away_team, division_record, phase)
      return true if home_team.nil? || away_team.nil?
      return true if existing.home_team_id != home_team.id || existing.away_team_id != away_team.id
      return true if row[:startTime].present? && existing.start_time.to_i != Time.iso8601(row[:startTime]).to_i
      return true if existing.phase != phase
      return true if row[:venue].present? && existing.venue != row[:venue]
      return true if row[:gameNumber].present? && existing.game_number != row[:gameNumber]
      return true if division_record && existing.division_id != division_record.id
      return true if row[:bracketRound].present? && existing.bracket_round != row[:bracketRound]
      return true if row[:bracketSlot].present? && existing.bracket_slot != row[:bracketSlot]
      return true if row[:notes].present? && existing.notes != row[:notes]

      false
    rescue ArgumentError
      true
    end

    def register_new_team(new_teams, canonical_label, division_record)
      key = canonical_label.downcase
      return if new_teams.key?(key)

      new_teams[key] = {
        displayName: canonical_label,
        division: division_record&.name,
        inferredClassKeys: ClassArchive::Resolver.class_keys(canonical_label)
      }
    end

    def index_divisions
      @tournament.divisions.each_with_object({}) do |division, map|
        map[division.name.downcase] = division
        map[division.slug.downcase] = division
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

    def unmatched_game_json(game)
      {
        id: game.id.to_s,
        gameNumber: game.game_number,
        startTime: game.start_time&.iso8601,
        awayTeam: game.away_team&.display_name,
        homeTeam: game.home_team&.display_name,
        division: game.resolved_division,
        phase: game.phase,
        status: game.status,
        hasScores: game.home_score.present? || game.away_score.present?
      }
    end

    def parse_int(value)
      return value if value.is_a?(Integer)

      str = value.to_s.strip
      str.match?(/\A\d+\z/) ? str.to_i : nil
    end
  end
end
