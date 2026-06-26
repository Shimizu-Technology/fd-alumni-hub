module Api
  module V1
    module Admin
      class TeamsController < BaseController
        def index
          teams = Team.includes(:tournament, :division_record, :roster_entries).order(:tournament_id, :division, :display_name)
          teams = teams.where(tournament_id: params[:tournamentId]) if params[:tournamentId].present?

          render json: { teams: teams.map { |team| team.api_json(include_roster: true) } }
        end

        def create
          attrs = team_params
          team = admin_tournament.teams.build(attrs.except(:tournament_id))

          if team.save
            render json: { team: team_for_response(team.id).api_json(include_roster: true) }, status: :created
          else
            render_errors(team)
          end
        end

        def update
          team = admin_tournament.teams.find(params[:id])

          if team.update(team_params.except(:tournament_id))
            render json: { team: team_for_response(team.id).api_json(include_roster: true) }
          else
            render_errors(team)
          end
        end

        def destroy
          team = admin_tournament.teams.find(params[:id])

          if team.destroy
            head :no_content
          else
            render_errors(team)
          end
        end

        private

        def team_for_response(id)
          Team.includes(:tournament, :division_record, :roster_entries).find(id)
        end

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
