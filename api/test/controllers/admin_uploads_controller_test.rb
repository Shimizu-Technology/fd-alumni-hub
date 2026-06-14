require "test_helper"
require "base64"

class AdminUploadsControllerTest < ActionDispatch::IntegrationTest
  ENV_KEYS = %w[
    S3_BUCKET
    AWS_S3_BUCKET
    S3_REGION
    AWS_REGION
    S3_ACCESS_KEY_ID
    AWS_ACCESS_KEY_ID
    S3_SECRET_ACCESS_KEY
    AWS_SECRET_ACCESS_KEY
    S3_PUBLIC_BASE_URL
    AWS_S3_PUBLIC_BASE_URL
    S3_IMAGE_UPLOAD_MAX_BYTES
  ].freeze

  setup do
    @env_backup = ENV_KEYS.to_h { |key| [ key, ENV.fetch(key, nil) ] }
    ENV_KEYS.each { |key| ENV.delete(key) }

    ENV["S3_BUCKET"] = "fd-bucket"
    ENV["S3_REGION"] = "ap-southeast-2"
    ENV["S3_ACCESS_KEY_ID"] = "AKIATESTKEY"
    ENV["S3_SECRET_ACCESS_KEY"] = "test-secret"
    ENV["S3_PUBLIC_BASE_URL"] = "https://cdn.example.com/fd"
    ENV["S3_IMAGE_UPLOAD_MAX_BYTES"] = "10485760"

    @user = User.create!(email: "admin-uploads@example.com", clerk_id: "test_clerk_uploads", role: "admin")
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
  end

  teardown do
    @env_backup.each do |key, value|
      if value.nil?
        ENV.delete(key)
      else
        ENV[key] = value
      end
    end
  end

  test "presigns public image uploads for a tournament" do
    post "/api/v1/admin/uploads/presign",
      params: {
        upload: {
          tournamentId: @tournament.id,
          filename: "Sponsor Logo Final.PNG",
          contentType: "image/png",
          byteSize: 123_456,
          purpose: "sponsor-logo"
        }
      },
      headers: auth_headers,
      as: :json

    assert_response :success
    body = JSON.parse(response.body)
    fields = body.fetch("fields")

    assert_equal "https://fd-bucket.s3.ap-southeast-2.amazonaws.com/", body.fetch("uploadUrl")
    assert_match %r{\Asponsors/#{@tournament.id}/\d+-[a-f0-9]{12}-sponsor-logo-final.png\z}, body.fetch("key")
    assert_equal "https://cdn.example.com/fd/#{body.fetch("key")}", body.fetch("publicUrl")
    assert_equal "image/png", fields.fetch("Content-Type")
    assert_equal "fd-bucket", fields.fetch("bucket")
    assert_equal body.fetch("key"), fields.fetch("key")
    assert_equal "AWS4-HMAC-SHA256", fields.fetch("X-Amz-Algorithm")
    assert fields.fetch("X-Amz-Signature").present?

    policy = JSON.parse(Base64.decode64(fields.fetch("Policy")))
    assert_includes policy.fetch("conditions"), [ "content-length-range", 1, 10.megabytes ]
    assert_includes policy.fetch("conditions"), [ "starts-with", "$Content-Type", "image/" ]
    assert_includes policy.fetch("conditions"), { "Content-Type" => "image/png" }
  end

  test "requires staff auth" do
    post "/api/v1/admin/uploads/presign",
      params: { upload: { tournamentId: @tournament.id, filename: "logo.png", contentType: "image/png" } },
      as: :json

    assert_response :unauthorized
  end

  test "rejects non image uploads" do
    post "/api/v1/admin/uploads/presign",
      params: { upload: { tournamentId: @tournament.id, filename: "packet.pdf", contentType: "application/pdf" } },
      headers: auth_headers,
      as: :json

    assert_response :bad_request
    assert_equal "Only image uploads are allowed", JSON.parse(response.body).fetch("error")
  end

  test "rejects oversized images before signing" do
    post "/api/v1/admin/uploads/presign",
      params: {
        upload: {
          tournamentId: @tournament.id,
          filename: "huge.jpg",
          contentType: "image/jpeg",
          byteSize: 10.megabytes + 1
        }
      },
      headers: auth_headers,
      as: :json

    assert_response :bad_request
    assert_equal "Image must be 10MB or smaller", JSON.parse(response.body).fetch("error")
  end

  test "reports upload configuration problems without signing" do
    ENV.delete("S3_BUCKET")

    post "/api/v1/admin/uploads/presign",
      params: { upload: { tournamentId: @tournament.id, filename: "logo.png", contentType: "image/png" } },
      headers: auth_headers,
      as: :json

    assert_response :service_unavailable
    assert_equal "Missing env var: S3_BUCKET", JSON.parse(response.body).fetch("error")
  end

  private

  def auth_headers
    { "Authorization" => "Bearer test_token_#{@user.id}" }
  end
end
