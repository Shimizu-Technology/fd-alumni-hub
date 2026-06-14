module Api
  module V1
    module Admin
      class DivisionsController < BaseController
        def index
          tournament = tournament_from_params
          divisions = if tournament
            Division.available_for(tournament).ordered
          else
            Division.active.ordered
          end

          render json: {
            divisions: divisions.map { |division| division.api_json(tournament: tournament) },
            allDivisions: Division.ordered.map { |division| division.api_json(tournament: tournament) }
          }
        end

        def create
          division = Division.new(division_params)
          apply_selected_tournament_start_year(division)

          if division.save
            render json: { division: division.api_json }, status: :created
          else
            render_errors(division)
          end
        end

        def update
          division = Division.find(params[:id])

          if division.update(division_params)
            render json: { division: division.api_json }
          else
            render_errors(division)
          end
        end

        private

        def tournament_from_params
          return if params[:tournamentId].blank? && params[:tournament_id].blank?

          Tournament.find(params[:tournamentId].presence || params[:tournament_id])
        end

        def apply_selected_tournament_start_year(division)
          return if division.starts_year.present?

          tournament = tournament_from_params
          division.starts_year = tournament.year if tournament
        end

        def division_params
          raw = params.fetch(:division, params)
          permitted = raw.permit(:name, :slug, :starts_year, :startsYear, :position, :active)

          attrs = {}
          assign_param(attrs, permitted, :name, :name)
          assign_param(attrs, permitted, :slug, :slug)
          assign_param(attrs, permitted, :starts_year, :starts_year, :startsYear)
          assign_param(attrs, permitted, :position, :position)
          assign_param(attrs, permitted, :active, :active)
          attrs
        end
      end
    end
  end
end
