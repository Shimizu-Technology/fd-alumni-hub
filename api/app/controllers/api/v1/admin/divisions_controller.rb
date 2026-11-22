module Api
  module V1
    module Admin
      class DivisionsController < BaseController
        before_action :require_admin!, only: [ :create, :update ]

        def index
          tournament = resolved_tournament
          divisions = tournament ? tournament.divisions.active.ordered : Division.none
          all_divisions = tournament ? tournament.divisions.ordered : Division.none

          render json: {
            tournament: tournament&.api_json,
            divisions: divisions.map { |division| division.api_json(tournament: tournament) },
            allDivisions: all_divisions.map { |division| division.api_json(tournament: tournament) }
          }
        end

        def create
          tournament = resolved_tournament
          return render json: { errors: [ "Tournament is required" ] }, status: :unprocessable_entity unless tournament

          division = tournament.divisions.build(division_params)

          if division.save
            render json: { division: division.api_json(tournament: tournament) }, status: :created
          else
            render_errors(division)
          end
        end

        def update
          tournament = resolved_tournament
          return render json: { errors: [ "Tournament is required" ] }, status: :unprocessable_entity unless tournament

          division = tournament.divisions.find(params[:id])

          if division.update(division_params)
            render json: { division: division.api_json(tournament: tournament) }
          else
            render_errors(division)
          end
        end

        private

        def resolved_tournament
          body = params[:division]
          body_tournament_id = body.is_a?(ActionController::Parameters) ? (body[:tournamentId].presence || body[:tournament_id].presence) : nil
          explicit_id = params[:tournamentId].presence || params[:tournament_id].presence || body_tournament_id

          if explicit_id.present?
            Tournament.find(explicit_id)
          else
            admin_tournament
          end
        end

        def division_params
          raw = params.fetch(:division, params)
          permitted = raw.permit(:name, :slug, :position, :active, :counts_for_standings, :countsForStandings)

          attrs = {}
          assign_param(attrs, permitted, :name, :name)
          assign_param(attrs, permitted, :slug, :slug)
          assign_param(attrs, permitted, :position, :position)
          assign_param(attrs, permitted, :active, :active)
          assign_param(attrs, permitted, :counts_for_standings, :counts_for_standings, :countsForStandings)
          attrs
        end
      end
    end
  end
end
