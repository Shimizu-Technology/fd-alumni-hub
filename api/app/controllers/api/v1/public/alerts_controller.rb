module Api
  module V1
    module Public
      class AlertsController < BaseController
        def index
          tournament = current_tournament
          alerts = TournamentAlert.for_public_tournament(tournament).active_now.ordered_for_display.limit(10)

          render json: {
            tournamentId: tournament&.id&.to_s,
            alerts: alerts.map(&:api_json)
          }
        end
      end
    end
  end
end
