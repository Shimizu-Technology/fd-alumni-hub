module Api
  module V1
    module Admin
      class StandingsController < BaseController
        def index
          tournament = admin_tournament
          standings = tournament ? standings_scope(tournament) : Standing.none

          render json: {
            tournament: tournament&.api_json,
            standings: standings.map(&:api_json),
            scoreCoverage: score_coverage(tournament)
          }
        end

        def recompute
          tournament = admin_tournament
          return render json: { error: "No tournament found" }, status: :not_found unless tournament

          result = Standings::Recompute.call(tournament)
          tournament.standings.reset

          render json: {
            tournament: tournament.api_json,
            recompute: { teams: result.teams, games: result.games },
            standings: standings_scope(tournament).map(&:api_json),
            scoreCoverage: score_coverage(tournament)
          }
        end

        private

        def standings_scope(tournament)
          scope = tournament.standings.ranked
          if params[:division].present?
            scope = scope.where(team_id: tournament.teams.where(division: params[:division]).select(:id))
          end
          scope
        end

        def score_coverage(tournament)
          return { scoredGames: 0, totalGames: 0, percent: 0 } unless tournament

          total = tournament.games.count
          scored = tournament.games.scored.count
          percent = total.positive? ? ((scored.to_f / total) * 1000).round / 10.0 : 0

          { scoredGames: scored, totalGames: total, percent: percent }
        end
      end
    end
  end
end
