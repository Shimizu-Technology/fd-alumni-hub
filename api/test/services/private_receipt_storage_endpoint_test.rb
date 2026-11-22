require "test_helper"

class PrivateReceiptStorageEndpointTest < ActiveSupport::TestCase
  ENV_KEYS = %w[
    S3_PRIVATE_BUCKET
    S3_PRIVATE_ENDPOINT
    S3_ACCESS_KEY_ID
    S3_SECRET_ACCESS_KEY
    S3_REGION
  ].freeze

  setup do
    @env_backup = ENV_KEYS.to_h { |k| [ k, ENV.fetch(k, nil) ] }
    ENV["S3_PRIVATE_BUCKET"] = "fd-qa-private-receipts"
    ENV["S3_ACCESS_KEY_ID"] = "qa-key"
    ENV["S3_SECRET_ACCESS_KEY"] = "qa-secret"
    ENV["S3_REGION"] = "ap-southeast-2"
    ENV.delete("S3_PRIVATE_ENDPOINT")
  end

  teardown do
    @env_backup.each do |k, v|
      v.nil? ? ENV.delete(k) : ENV[k] = v
    end
  end

  test "defaults to AWS S3 HTTPS origin when S3_PRIVATE_ENDPOINT is unset" do
    presign = PrivateReceiptStorage.presign_post(
      campaign_id: 1,
      filename: "receipt.png",
      content_type: "image/png",
      byte_size: 1024
    )
    assert_equal "https://fd-qa-private-receipts.s3.ap-southeast-2.amazonaws.com/", presign.dig(:upload, :url)
  end

  test "allows localhost S3_PRIVATE_ENDPOINT in local test/development env and rejects non-localhost hosts" do
    ENV["S3_PRIVATE_ENDPOINT"] = "http://127.0.0.1:9199"
    presign = PrivateReceiptStorage.presign_post(
      campaign_id: 1,
      filename: "receipt.png",
      content_type: "image/png",
      byte_size: 1024
    )
    assert_equal "http://127.0.0.1:9199/", presign.dig(:upload, :url)

    ENV["S3_PRIVATE_ENDPOINT"] = "https://evil.example.com"
    assert_raises(PrivateReceiptStorage::ConfigurationError) do
      PrivateReceiptStorage.presign_post(
        campaign_id: 1,
        filename: "receipt.png",
        content_type: "image/png",
        byte_size: 1024
      )
    end
  end
end
