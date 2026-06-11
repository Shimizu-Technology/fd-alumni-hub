module Api
  module V1
    module Public
      class TournamentsController < BaseController
        def index
          tournaments = Tournament.order(year: :desc, start_date: :desc)
          render json: {
            tournaments: tournaments.map(&:api_json),
            activeTournament: Tournament.active_for_public&.api_json
          }
        end

        def show
          tournament = Tournament.find_by(id: params[:id]) || Tournament.find_by(year: params[:id].to_i)
          return render_not_found("Tournament not found") unless tournament

          render json: { tournament: tournament.api_json }
        end
      end
    end
  end
end
