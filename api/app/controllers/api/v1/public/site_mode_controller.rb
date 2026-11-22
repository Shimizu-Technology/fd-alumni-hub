module Api
  module V1
    module Public
      class SiteModeController < BaseController
        def show
          render json: { siteMode: site_context.as_json, alerts: site_context.alerts.map(&:api_json) }
        end
      end
    end
  end
end
