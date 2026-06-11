module Api
  module V1
    module Public
      class BaseController < Api::V1::BaseController
        private

        def current_tournament
          @current_tournament ||= begin
            if params[:tournamentId].present?
              Tournament.find_by(id: params[:tournamentId])
            elsif params[:year].present?
              Tournament.find_by(year: params[:year].to_i)
            else
              Tournament.active_for_public
            end
          end
        end

        def render_not_found(message = "Not found")
          render json: { error: message }, status: :not_found
        end

        def integer_param(name, default:, maximum: 100)
          value = params[name].presence&.to_i || default
          [ [ value, 1 ].max, maximum ].min
        end
      end
    end
  end
end
