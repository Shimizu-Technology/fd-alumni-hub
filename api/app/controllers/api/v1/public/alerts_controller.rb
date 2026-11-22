module Api
  module V1
    module Public
      class AlertsController < BaseController
        def index
          tournament = current_tournament
          alerts = site_context.alerts(tournament)

          render json: {
            tournamentId: tournament&.id&.to_s,
            alerts: alerts.map(&:api_json)
          }
        end
      end
    end
  end
end
