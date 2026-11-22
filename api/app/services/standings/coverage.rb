module Standings
  class Coverage
    def self.for(tournament, division_id: nil)
      return empty_payload unless tournament

      games = tournament.games.pool_games
        .includes(:division_record, home_team: :division_record, away_team: :division_record)
        .to_a
        .select(&:standings_pool_eligible_schedule_game?)

      if division_id.present?
        target_id = division_id.to_i
        games = games.select { |g| g.home_team.division_id == target_id }
      end

      total = games.length
      scored = games.count { |g| g.status == "final" && g.home_score.present? && g.away_score.present? }
      percent = total.positive? ? ((scored.to_f / total) * 1000).round / 10.0 : 0

      {
        scoredPoolGames: scored,
        totalPoolGames: total,
        scoredGames: scored,
        totalGames: total,
        percent: percent
      }
    end

    def self.empty_payload
      {
        scoredPoolGames: 0,
        totalPoolGames: 0,
        scoredGames: 0,
        totalGames: 0,
        percent: 0
      }
    end
  end
end
