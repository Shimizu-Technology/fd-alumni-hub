module Api
  module V1
    module Public
      class StatLeadersController < BaseController
        def index
          metric = params[:metric].presence || "points"
          scope = params[:scope].presence
          division = params[:division].to_s.strip.presence
          unless BoxScores::Leaders::METRICS.include?(metric) && (scope.nil? || %w[official all].include?(scope))
            return render json: { errors: [ "Choose a valid stat metric and scope." ] }, status: :unprocessable_entity
          end

          render json: BoxScores::Leaders.new(current_tournament, metric: metric, division: division, scope: scope).payload
        end
      end
    end
  end
end
