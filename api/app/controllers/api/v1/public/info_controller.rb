module Api
  module V1
    module Public
      class InfoController < BaseController
        def show
          tournament = current_tournament
          return render_not_found("Tournament not found") unless tournament

          render json: { tournament: tournament.api_json, infoGuide: Tonight::InfoGuide.for(tournament) }
        end
      end
    end
  end
end
