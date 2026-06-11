module Api
  module V1
    module Public
      class ScheduleController < BaseController
        def index
          tournament = current_tournament
          return render json: { tournament: nil, games: [], divisions: [], phases: [] } unless tournament

          games = tournament.games.includes(:home_team, :away_team).ordered.to_a
          divisions = games.filter_map(&:resolved_division).uniq.sort
          phases = collect_phases(games)

          games = apply_division_filter(games, params[:division]) if params[:division].present?
          games = apply_phase_filter(games, params[:phase]) if params[:phase].present?

          render json: {
            tournament: tournament.api_json,
            games: games.first(500).map(&:api_json),
            divisions: divisions,
            phases: phases
          }
        end

        private

        def apply_division_filter(games, division)
          games.select { |game| game.resolved_division == division }
        end

        def apply_phase_filter(games, phase)
          case phase
          when "pool"
            games.select(&:pool_phase?)
          when "playoff"
            games.select(&:playoff_phase?)
          when "fatherson"
            games.select(&:fatherson_phase?)
          else
            games
          end
        end

        def collect_phases(games)
          phases = []
          phases << "pool" if games.any?(&:pool_phase?)
          phases << "playoff" if games.any?(&:playoff_phase?)
          phases << "fatherson" if games.any?(&:fatherson_phase?)
          phases
        end
      end
    end
  end
end
