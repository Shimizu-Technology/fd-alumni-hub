module Api
  module V1
    module Admin
      class TournamentsController < BaseController
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
            render json: { tournament: tournament.api_json }, status: :created
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

          render json: {
            tournament: tournament.api_json,
            recompute: { teams: result.teams, games: result.games },
            standings: tournament.standings.ranked.map(&:api_json)
          }
        end

        private

        def tournament_params
          raw = params.fetch(:tournament, params)
          permitted = raw.permit(:name, :year, :status, :start_date, :end_date, :startDate, :endDate)
          {
            name: permitted[:name],
            year: permitted[:year],
            status: permitted[:status],
            start_date: permitted[:start_date] || permitted[:startDate],
            end_date: permitted[:end_date] || permitted[:endDate]
          }.compact
        end
      end
    end
  end
end
