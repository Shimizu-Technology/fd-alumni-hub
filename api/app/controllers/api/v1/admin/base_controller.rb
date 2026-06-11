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
      end
    end
  end
end
