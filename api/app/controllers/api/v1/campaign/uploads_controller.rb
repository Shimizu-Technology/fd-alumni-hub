module Api
  module V1
    module Campaign
      class UploadsController < BaseController
        PRESIGN_LIMIT_PER_MINUTE = 30

        before_action -> { require_campaign_access!("fundraisers_and_sponsors", "edit", "chair") }, only: :presign
        before_action :require_campaign_writable!

        def presign
          return render json: { error: "Upload rate limit exceeded. Please wait a minute." }, status: :too_many_requests if rate_limited?

          upload = upload_params
          result = PublicImageUploadPresigner.call(
            scope_id: @campaign.id,
            filename: upload[:filename],
            content_type: upload[:content_type],
            byte_size: upload[:byte_size],
            purpose: "campaign"
          )

          Audit::EventRecorder.record!(area: "content", action: "image_upload_presigned",
            record: @campaign, summary: "Issued an image upload authorization",
            metadata: { expiresIn: result[:expiresIn], maxBytes: result[:maxBytes] })
          render json: result
        rescue PublicImageUploadPresigner::ConfigurationError => e
          render json: { error: e.message }, status: :service_unavailable
        rescue ArgumentError => e
          render json: { error: e.message }, status: :bad_request
        end

        private

        def rate_limited?
          cache_key = "campaign_upload_presign:#{current_user.id}:#{Time.current.to_i / 60}"
          count = Rails.cache.increment(cache_key, 1, expires_in: 90.seconds)
          if count.nil?
            Rails.cache.write(cache_key, 1, expires_in: 90.seconds, unless_exist: true)
            count = Rails.cache.read(cache_key).to_i
          end
          count > PRESIGN_LIMIT_PER_MINUTE
        end

        def upload_params
          raw = params.fetch(:upload, params)
          permitted = raw.permit(:filename, :content_type, :contentType, :byte_size, :byteSize)

          {
            filename: permitted[:filename],
            content_type: permitted[:content_type] || permitted[:contentType],
            byte_size: permitted[:byte_size] || permitted[:byteSize]
          }
        end
      end
    end
  end
end
