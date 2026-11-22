module BoxScores
  class Discrepancies
    def self.call(game, coverage: game.box_score_coverage, stats: game.player_game_stats)
      points = stats.group_by(&:team_id).transform_values { |rows| rows.sum { |row| row.points.to_i } }
      home = points.fetch(game.home_team_id, 0)
      away = points.fetch(game.away_team_id, 0)
      warnings = [
        warning("Home", home, game.home_score, coverage),
        warning("Away", away, game.away_score, coverage)
      ].compact

      {
        homePointsSum: home, awayPointsSum: away, homeOfficialScore: game.home_score,
        awayOfficialScore: game.away_score, hasDiscrepancy: warnings.any?, warnings: warnings
      }
    end

    def self.warning(side, points, official, coverage)
      if coverage == "full_box_score" && points != official
        "#{side} player points must match the official score for a full box score."
      elsif coverage == "selected_scorers" && official.nil? && points.positive?
        "#{side} player points cannot be published on a game without an official score."
      elsif coverage == "selected_scorers" && official && points > official
        "#{side} player points exceed the official score."
      end
    end
    private_class_method :warning
  end
end
