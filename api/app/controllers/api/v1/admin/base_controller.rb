module Api
  module V1
    module Admin
      class BaseController < Api::V1::BaseController
        before_action :require_staff!

        private

        def render_record(record, key:, status: :ok)
          render json: { key => record.api_json }, status: status
        end

        def render_errors(record)
          render json: { errors: record.errors.full_messages }, status: :unprocessable_entity
        end

        def admin_tournament
          @admin_tournament ||= begin
            if params[:tournamentId].present?
              Tournament.find(params[:tournamentId])
            elsif params[:tournament_id].present?
              Tournament.find(params[:tournament_id])
            elsif params[:year].present?
              Tournament.find_by!(year: params[:year].to_i)
            else
              Tournament.active_for_public || Tournament.order(year: :desc, start_date: :desc).first
            end
          end
        end

        def assign_param(attrs, permitted, target_key, *source_keys)
          source_keys.each do |source_key|
            next unless permitted.key?(source_key)

            attrs[target_key] = permitted[source_key]
            return
          end
        end
      end
    end
  end
end
