module Api
  module V1
    module Admin
      class UploadsController < BaseController
        def presign
          upload = upload_params
          tournament = Tournament.find(upload[:tournament_id])
          result = PublicImageUploadPresigner.call(
            tournament: tournament,
            filename: upload[:filename],
            content_type: upload[:content_type],
            byte_size: upload[:byte_size],
            purpose: upload[:purpose]
          )

          render json: result
        rescue ActiveRecord::RecordNotFound
          render json: { error: "invalid tournamentId" }, status: :bad_request
        rescue PublicImageUploadPresigner::ConfigurationError => e
          render json: { error: e.message }, status: :service_unavailable
        rescue ArgumentError => e
          render json: { error: e.message }, status: :bad_request
        end

        private

        def upload_params
          raw = params.fetch(:upload, params)
          permitted = raw.permit(
            :tournament_id,
            :tournamentId,
            :filename,
            :content_type,
            :contentType,
            :byte_size,
            :byteSize,
            :purpose
          )

          {
            tournament_id: permitted[:tournament_id] || permitted[:tournamentId],
            filename: permitted[:filename],
            content_type: permitted[:content_type] || permitted[:contentType],
            byte_size: permitted[:byte_size] || permitted[:byteSize],
            purpose: permitted[:purpose]
          }
        end
      end
    end
  end
end
