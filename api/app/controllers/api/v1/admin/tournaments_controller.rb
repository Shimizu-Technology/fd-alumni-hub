module Api
  module V1
    module Admin
      class TournamentsController < BaseController
        before_action :require_admin!, only: [ :create, :update ]

        def index
          tournaments = Tournament.order(year: :desc, start_date: :desc)
          render json: { tournaments: tournaments.map(&:api_json) }
        end

        def show
          tournament = Tournament.find(params[:id])
          render json: { tournament: tournament.api_json }
        end

        def create
          tournament = Tournament.new(tournament_params)

          if tournament.save
            tournament.ensure_default_divisions! if seed_default_divisions?
            render json: {
              tournament: tournament.api_json,
              divisions: tournament.divisions.ordered.map { |division| division.api_json(tournament: tournament) }
            }, status: :created
          else
            render_errors(tournament)
          end
        end

        def update
          tournament = Tournament.find(params[:id])

          if tournament.update(tournament_params)
            render json: { tournament: tournament.api_json }
          else
            render_errors(tournament)
          end
        end

        def recompute_standings
          tournament = Tournament.find(params[:id])
          result = Standings::Recompute.call(tournament)
          tournament.standings.reset

          render json: {
            tournament: tournament.api_json,
            recompute: { teams: result.teams, games: result.games },
            standings: tournament.standings.ranked.map(&:api_json),
            scoreCoverage: Standings::Coverage.for(tournament)
          }
        end

        private

        def seed_default_divisions?
          raw = params.fetch(:tournament, params)
          flag = raw[:seedDefaultDivisions]
          flag = raw[:seed_default_divisions] if flag.nil?
          flag = params[:seedDefaultDivisions] if flag.nil?
          flag = params[:seed_default_divisions] if flag.nil?
          return false if flag.nil?

          ActiveModel::Type::Boolean.new.cast(flag)
        end

        def tournament_params
          raw = params.fetch(:tournament, params)
          permitted = raw.permit(:name, :year, :status, :start_date, :end_date, :startDate, :endDate)

          attrs = {}
          assign_param(attrs, permitted, :name, :name)
          assign_param(attrs, permitted, :year, :year)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :start_date, :start_date, :startDate)
          assign_param(attrs, permitted, :end_date, :end_date, :endDate)
          attrs
        end
      end
    end
  end
end
