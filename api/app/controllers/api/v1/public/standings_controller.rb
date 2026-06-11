module Api
  module V1
    module Public
      class StandingsController < BaseController
        def index
          tournament = current_tournament
          unless tournament
            return render json: {
              tournament: nil,
              standings: [],
              divisions: [],
              scoreCoverage: { scoredGames: 0, totalGames: 0, percent: 0 }
            }
          end

          teams = tournament.teams
          divisions = teams.distinct.order(:division).pluck(:division).compact
          team_scope = params[:division].present? ? teams.where(division: params[:division]) : teams
          standings = tournament.standings.ranked.where(team_id: team_scope.select(:id))
          total_games = tournament.games.count
          scored_games = tournament.games.scored.count
          percent = total_games.positive? ? ((scored_games.to_f / total_games) * 1000).round / 10.0 : 0

          render json: {
            tournament: tournament.api_json,
            standings: standings.map(&:api_json),
            divisions: divisions,
            scoreCoverage: {
              scoredGames: scored_games,
              totalGames: total_games,
              percent: percent
            }
          }
        end
      end
    end
  end
end
