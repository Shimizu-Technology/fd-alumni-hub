module BoxScores
  class Leaders
    METRICS = %w[points rebounds assists steals blocks three_pointers_made].freeze

    def initialize(tournament, metric:, division:, scope:)
      @tournament = tournament
      @metric = metric
      @division = division
      @scope = scope
    end

    def payload
      enabled = @tournament&.publicly_visible_schedule? && @tournament.enable_player_stats?
      finals = enabled ? final_games : []
      published = finals.select { |game| game.box_score_status == "published" }
      full = published.select { |game| game.box_score_coverage == "full_box_score" }
      scope = @scope || (full.any? ? "official" : "all")
      stats = recorded_stats(scope == "official" ? full : published, scope)
      recorded_games = stats.map(&:game_id).uniq.size
      partial = enabled && recorded_games < finals.size

      {
        tournament: @tournament&.api_json, enabled: !!enabled, metric: @metric, division: @division, scope: scope,
        totalFinalGames: finals.size, gamesWithBoxScores: published.size, fullBoxScoreGames: full.size,
        metricRecordedGames: recorded_games, isPartialCoverage: !!partial,
        coverageLabel: coverage_label(enabled, partial, recorded_games, finals.size, scope),
        leaders: ranked_players(stats)
      }
    end

    private

    def final_games
      games = @tournament.games.where(status: "final").includes(:division_record, home_team: :division_record).to_a
      return games unless @division

      games.select do |game|
        game.division_record&.slug&.casecmp?(@division) || game.resolved_division.to_s.casecmp?(@division)
      end
    end

    def recorded_stats(games, scope)
      return [] if games.empty?

      # Recheck visibility with the metric rows so a concurrent unpublish cannot expose a new draft.
      rows = PlayerGameStat.joins(game: :tournament)
        .where(games: { id: games.map(&:id), status: "final", box_score_status: "published" })
        .where(tournaments: { enable_player_stats: true })
        .merge(Tournament.with_public_schedule)
        .where.not(@metric => nil)
      rows = rows.where(games: { box_score_coverage: "full_box_score" }) if scope == "official"
      rows.includes(team: :division_record, game: [ :division_record, { home_team: :division_record } ]).order(:id).to_a
    end

    def ranked_players(stats)
      rows = stats.group_by(&:roster_entry_id).map do |id, player_stats|
        latest = player_stats.max_by { |stat| [ stat.game.start_time, stat.game_id ] }
        total = player_stats.sum { |stat| stat.public_send(@metric) }
        {
          rosterEntryId: id.to_s, playerName: latest.player_name_snapshot, jerseyNumber: latest.jersey_number_snapshot,
          teamId: latest.team_id.to_s, teamName: latest.team.display_name, division: latest.game.resolved_division,
          gamesRecorded: player_stats.size, total: total, average: (total.to_f / player_stats.size).round(2)
        }
      end
      previous_total = nil
      rank = nil
      rows.sort_by { |row| [ -row[:total], row[:playerName].downcase, row[:rosterEntryId].to_i ] }.map.with_index(1) do |row, position|
        rank = position if row[:total] != previous_total
        previous_total = row[:total]
        row.merge(rank: rank)
      end
    end

    def coverage_label(enabled, partial, recorded_games, total_games, scope)
      return "Player stats unavailable" unless enabled
      return "Partial coverage — based on #{recorded_games} of #{total_games} final games" if partial
      return "No final games recorded" if total_games.zero?

      scope == "official" ? "Full box scores" : "All published box scores"
    end
  end
end
