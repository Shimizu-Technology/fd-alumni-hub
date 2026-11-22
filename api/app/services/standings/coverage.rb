module Standings
  class Coverage
    def self.for(tournament, division_id: nil)
      return empty_payload unless tournament

      bundle = by_division(tournament)
      if division_id.present?
        bundle[:by_division][division_id.to_i] || empty_payload
      else
        bundle[:overall]
      end
    end

    def self.by_division(tournament)
      return { overall: empty_payload, by_division: {} } unless tournament

      games = tournament.games.pool_games
        .includes(:division_record, home_team: :division_record, away_team: :division_record)
        .to_a
        .select(&:standings_pool_eligible_schedule_game?)

      grouped = games.group_by { |game| game.home_team.division_id }
      by_div = grouped.transform_values { |div_games| summarize(div_games) }

      {
        overall: summarize(games),
        by_division: by_div
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

    class << self
      alias_method :empty, :empty_payload

      private

      def summarize(games)
        total = games.length
        scored = games.count(&:final_result?)
        percent = total.positive? ? ((scored.to_f / total) * 1000).round / 10.0 : 0

        {
          scoredPoolGames: scored,
          totalPoolGames: total,
          scoredGames: scored,
          totalGames: total,
          percent: percent
        }
      end
    end
  end
end
