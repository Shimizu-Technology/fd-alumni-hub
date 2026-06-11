module Api
  module V1
    module Public
      class SponsorsController < BaseController
        def index
          tournament = current_tournament
          return render json: { tournament: nil, sponsors: [] } unless tournament

          sponsors = tournament.sponsors.active.ordered

          render json: {
            tournament: tournament.api_json,
            sponsors: sponsors.map(&:api_json)
          }
        end
      end
    end
  end
end
