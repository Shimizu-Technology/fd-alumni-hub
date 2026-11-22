module Api
  module V1
    module Campaign
      class ReceiptsController < BaseController
        PRESIGN_LIMIT_PER_MINUTE = 30

        before_action -> { require_campaign_access!("finance_and_reimbursements", "record", "treasurer") }, only: :presign
        before_action :require_campaign_writable!

        def presign
          if rate_limited?
            return render json: { error: "Receipt upload rate limit exceeded. Please wait a minute." }, status: :too_many_requests
          end

          raw = extract_object_params(:upload)
          return if performed?

          upload = upload_params(raw)
          presigned = PrivateReceiptStorage.presign_post(
            campaign_id: @campaign.id,
            filename: upload[:filename],
            content_type: upload[:content_type],
            byte_size: upload[:byte_size]
          )

          pending = @campaign.pending_receipt_uploads.create!(
            uploaded_by: current_user,
            s3_key: presigned[:key],
            original_filename: presigned[:sanitizedFilename],
            expected_content_type: presigned[:contentType]
          )

          render json: {
            uploadToken: pending.upload_token,
            maxBytes: presigned[:maxBytes],
            expiresIn: presigned[:expiresIn],
            upload: presigned[:upload]
          }
        rescue PrivateReceiptStorage::ConfigurationError => e
          render json: { error: e.message }, status: :service_unavailable
        rescue ArgumentError => e
          render json: { error: e.message }, status: :bad_request
        end

        private

        def rate_limited?
          cache_key = "campaign_receipt_presign:#{current_user.id}:#{Time.current.to_i / 60}"
          count = Rails.cache.increment(cache_key, 1, expires_in: 90.seconds)
          if count.nil?
            Rails.cache.write(cache_key, 1, expires_in: 90.seconds, unless_exist: true)
            count = Rails.cache.read(cache_key).to_i
          end
          count > PRESIGN_LIMIT_PER_MINUTE
        end

        def upload_params(raw)
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
