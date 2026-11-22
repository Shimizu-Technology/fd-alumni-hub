module Api
  module V1
    module Public
      class BaseController < Api::V1::BaseController
        private

        def site_context
          @site_context ||= SiteMode::Resolver.new
        end

        def public_schedule_tournament
          tournament = current_tournament
          tournament if tournament&.publicly_visible_schedule?
        end

        def current_tournament
          @current_tournament ||= begin
            if params[:tournamentId].present?
              Tournament.find_by(id: params[:tournamentId])
            elsif params[:year].present?
              Tournament.find_by(year: params[:year].to_i)
            else
              site_context.tournament
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
