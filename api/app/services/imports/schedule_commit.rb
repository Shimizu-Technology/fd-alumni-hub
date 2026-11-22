module Imports
  class ScheduleCommit
    class ValidationError < StandardError
      attr_reader :preview

      def initialize(message, preview:)
        super(message)
        @preview = preview
      end
    end

    def self.call(tournament:, rows:, overwrite_scores: false, default_venue: "The Jungle", actor: nil)
      new(tournament: tournament, rows: rows, overwrite_scores: overwrite_scores, default_venue: default_venue, actor: actor).call
    end

    def initialize(tournament:, rows:, overwrite_scores: false, default_venue: "The Jungle", actor: nil)
      @tournament = tournament
      @rows = rows
      @actor = actor
      @overwrite_scores = overwrite_scores == true
      @default_venue = default_venue.to_s.strip.presence || "The Jungle"
    end

    def call
      Audit::Context.with { perform }
    end

    private def perform
      raise Imports::ScheduleParser::ParseError, "At least one row is required to commit" unless @rows.is_a?(Array) && @rows.any?

      created_games = 0
      updated_games = 0
      unchanged_games = 0
      created_teams = 0

      @tournament.with_lock do
        Audit::Context.apply_to_transaction!(Tournament.connection)
        preview = Imports::SchedulePreview.call(
          tournament: @tournament,
          rows: @rows,
          default_venue: @default_venue
        )

        if preview.dig(:summary, :errorCount).to_i.positive?
          raise ValidationError.new("Resolve all row errors before committing the import.", preview: preview)
        end

        divisions_by_id = @tournament.divisions.index_by { |d| d.id.to_s }
        teams_by_key = index_teams(@tournament.teams.includes(:division_record).to_a)

        preview[:rows].each do |row|
          division = row[:divisionId].present? ? divisions_by_id[row[:divisionId]] : nil
          away_team, away_created = find_or_create_team!(teams_by_key, row[:awayTeam], division)
          home_team, home_created = find_or_create_team!(teams_by_key, row[:homeTeam], division)
          created_teams += 1 if away_created
          created_teams += 1 if home_created

          if row[:matchedGameId].present?
            game = @tournament.games.find(row[:matchedGameId])
            if row[:action] == "unchanged" && !(@overwrite_scores && (row[:homeScore].present? || row[:awayScore].present? || row[:status].present?))
              unchanged_games += 1
              next
            end

            assign_game_attributes!(game, row, away_team, home_team, division, is_new: false)
            updated_games += 1
          else
            game = @tournament.games.build
            assign_game_attributes!(game, row, away_team, home_team, division, is_new: true)
            created_games += 1
          end
        end
      end

      standings = Games::RecordResult.refresh_standings([ @tournament ])

      {
        tournamentId: @tournament.id.to_s,
        createdTeams: created_teams,
        createdGames: created_games,
        updatedGames: updated_games,
        unchangedGames: unchanged_games
      }.merge(standings)
    end

    private

    def find_or_create_team!(teams_by_key, label, division)
      canonical = ClassArchive::TeamEntryLabels.canonical_label(label)
      existing = teams_by_key[canonical.downcase]
      if existing
        if existing.division_id.blank? && division&.active?
          existing.update!(division_record: division)
        end
        return [ existing, false ]
      end

      team = @tournament.teams.create!(
        class_year_label: canonical,
        display_name: canonical,
        division_record: division
      )
      teams_by_key[canonical.downcase] = team
      [ team, true ]
    end

    def assign_game_attributes!(game, row, away_team, home_team, division, is_new:)
      schedule = { away_team: away_team, home_team: home_team, start_time: Time.iso8601(row[:startTime]), phase: row[:phase] }
      schedule[:venue] = row[:venue].presence || @default_venue if is_new || row[:venue].present?
      { game_number: :gameNumber, bracket_code: :bracketCode, bracket_round: :bracketRound,
        bracket_slot: :bracketSlot, notes: :notes }.each do |field, key|
        schedule[field] = row[key] if row[key].present?
      end
      schedule[:division_record] = division if division

      attrs = {}
      attrs[:status] = row[:status] if (is_new || @overwrite_scores) && row[:status].present?
      if @overwrite_scores || (is_new && row[:homeScore].present? && row[:awayScore].present?)
        attrs[:home_score] = row[:homeScore] unless row[:homeScore].nil?
        attrs[:away_score] = row[:awayScore] unless row[:awayScore].nil?
      end
      if attrs.empty?
        game.update!(schedule)
      else
        reason = is_new ? "Schedule import" : "Schedule import overwrite"
        result = Games::RecordResult.call(game, attrs.merge(reason: reason),
          actor: @actor, interactive: false, defer_recompute: true, schedule_attributes: schedule)
        unless result.ok?
          Array(result.body[:errors] || result.body[:error]).each { |error| game.errors.add(:base, error) }
          raise ActiveRecord::RecordInvalid, game
        end
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
  end
end
