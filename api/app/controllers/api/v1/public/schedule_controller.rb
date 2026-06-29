module Api
  module V1
    module Public
      class ScheduleController < BaseController
        def index
          tournament = current_tournament
          return render json: { tournament: nil, games: [], teams: [], divisions: [], phases: [] } unless tournament

          games = tournament.games.includes(:division_record, { home_team: [ :division_record, { team_class_memberships: :class_cohort } ] }, { away_team: [ :division_record, { team_class_memberships: :class_cohort } ] }).ordered.to_a
          teams = tournament.teams.includes(:division_record, team_class_memberships: :class_cohort).order(:display_name, :id).to_a
          divisions = games.filter_map(&:resolved_division).uniq.sort
          phases = collect_phases(games)

          games = apply_division_filter(games, params[:division]) if params[:division].present?
          games = apply_phase_filter(games, params[:phase]) if params[:phase].present?
          games = apply_team_filter(games, params[:teamId]) if params[:teamId].present?

          render json: {
            tournament: tournament.api_json,
            games: games.first(500).map(&:api_json),
            teams: teams.map(&:api_json),
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

        def apply_team_filter(games, team_id)
          games.select { |game| game.home_team_id.to_s == team_id.to_s || game.away_team_id.to_s == team_id.to_s }
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
