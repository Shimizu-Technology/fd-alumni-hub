module Imports
  class ScheduleCommit
    class ValidationError < StandardError
      attr_reader :preview

      def initialize(message, preview:)
        super(message)
        @preview = preview
      end
    end

    def self.call(tournament:, rows:, overwrite_scores: false, default_venue: "The Jungle")
      new(tournament: tournament, rows: rows, overwrite_scores: overwrite_scores, default_venue: default_venue).call
    end

    def initialize(tournament:, rows:, overwrite_scores: false, default_venue: "The Jungle")
      @tournament = tournament
      @rows = rows
      @overwrite_scores = overwrite_scores == true
      @default_venue = default_venue.to_s.strip.presence || "The Jungle"
    end

    def call
      raise Imports::ScheduleParser::ParseError, "At least one row is required to commit" unless @rows.is_a?(Array) && @rows.any?

      created_games = 0
      updated_games = 0
      unchanged_games = 0
      created_teams = 0

      @tournament.with_lock do
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

      recompute = Standings::Recompute.call(@tournament)

      {
        tournamentId: @tournament.id.to_s,
        createdTeams: created_teams,
        createdGames: created_games,
        updatedGames: updated_games,
        unchangedGames: unchanged_games,
        recompute: { teams: recompute.teams, games: recompute.games }
      }
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
      game.away_team = away_team
      game.home_team = home_team
      game.start_time = Time.iso8601(row[:startTime])
      game.phase = row[:phase]
      game.venue = row[:venue] if row[:venue].present?
      game.venue = @default_venue if is_new && game.venue.blank?
      game.game_number = row[:gameNumber] if row[:gameNumber].present?
      game.bracket_code = row[:bracketCode] if row[:bracketCode].present?
      game.bracket_round = row[:bracketRound] if row[:bracketRound].present?
      game.bracket_slot = row[:bracketSlot] if row[:bracketSlot].present?
      game.division_record = division if division
      game.notes = row[:notes] if row[:notes].present?

      if is_new
        game.status = row[:status].presence || "scheduled"
        if @overwrite_scores || (row[:homeScore].present? && row[:awayScore].present?)
          game.home_score = row[:homeScore] if row[:homeScore].present?
          game.away_score = row[:awayScore] if row[:awayScore].present?
        end
      elsif @overwrite_scores
        game.status = row[:status] if row[:status].present?
        game.home_score = row[:homeScore] unless row[:homeScore].nil?
        game.away_score = row[:awayScore] unless row[:awayScore].nil?
      end

      game.save!
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
