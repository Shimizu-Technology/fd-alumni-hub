module Api
  module V1
    module Admin
      class TeamsController < BaseController
        def index
          teams = Team.includes(:tournament, :division_record, :roster_entries).order(:tournament_id, :division, :display_name)
          teams = teams.where(tournament_id: params[:tournamentId]) if params[:tournamentId].present?

          render json: { teams: teams.map(&:api_json) }
        end

        def create
          team = Team.new(team_params)

          if team.save
            render json: { team: team.api_json }, status: :created
          else
            render_errors(team)
          end
        end

        def update
          team = Team.find(params[:id])

          if team.update(team_params)
            render json: { team: team.api_json }
          else
            render_errors(team)
          end
        end

        private

        def team_params
          raw = params.fetch(:team, params)
          permitted = raw.permit(:tournament_id, :tournamentId, :class_year_label, :classYearLabel, :display_name, :displayName, :division_id, :divisionId, :division)

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :class_year_label, :class_year_label, :classYearLabel)
          assign_param(attrs, permitted, :display_name, :display_name, :displayName)
          assign_param(attrs, permitted, :division_id, :division_id, :divisionId)
          assign_param(attrs, permitted, :division, :division)
          attrs
        end
      end
    end
  end
end
