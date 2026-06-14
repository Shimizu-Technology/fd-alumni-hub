require "base64"
require "openssl"
require "securerandom"

class PublicImageUploadPresigner
  DEFAULT_REGION = "ap-southeast-2"
  DEFAULT_MAX_BYTES = 10.megabytes
  DEFAULT_EXPIRES_IN = 60.seconds
  PURPOSE_FOLDERS = {
    "article" => "articles",
    "article-image" => "articles",
    "ingest" => "ingest",
    "ingest-image" => "ingest",
    "media" => "media",
    "media-asset" => "media",
    "sponsor" => "sponsors",
    "sponsor-logo" => "sponsors",
    "admin" => "admin"
  }.freeze

  class ConfigurationError < StandardError; end

  def self.call(...)
    new(...).call
  end

  def initialize(tournament:, filename:, content_type:, byte_size: nil, purpose: nil)
    @tournament = tournament
    @filename = filename.to_s
    @content_type = normalize_content_type(content_type)
    @byte_size = byte_size.presence&.to_i
    @purpose = purpose.to_s
  end

  def call
    validate!

    {
      uploadUrl: upload_url,
      fields: upload_fields,
      key: key,
      publicUrl: public_url,
      maxBytes: max_bytes,
      expiresIn: expires_in.to_i
    }
  end

  private

  attr_reader :tournament, :filename, :content_type, :byte_size, :purpose

  def validate!
    raise ArgumentError, "filename is required" if filename.blank?
    raise ArgumentError, "contentType is required" if content_type.blank?
    raise ArgumentError, "Only image uploads are allowed" unless content_type.start_with?("image/")

    if byte_size.present?
      raise ArgumentError, "Upload cannot be empty" if byte_size <= 0
      raise ArgumentError, "Image must be #{max_bytes / 1.megabyte}MB or smaller" if byte_size > max_bytes
    end

    bucket
    access_key_id
    secret_access_key
  end

  def upload_fields
    @upload_fields ||= begin
      base_fields = {
        "Content-Type" => content_type,
        "bucket" => bucket,
        "X-Amz-Algorithm" => algorithm,
        "X-Amz-Credential" => credential,
        "X-Amz-Date" => amz_date,
        "key" => key,
        "Policy" => encoded_policy,
        "X-Amz-Signature" => signature
      }

      if session_token.present?
        base_fields["X-Amz-Security-Token"] = session_token
      end

      base_fields
    end
  end

  def encoded_policy
    @encoded_policy ||= Base64.strict_encode64(policy.to_json)
  end

  def policy
    {
      expiration: expires_at.iso8601,
      conditions: policy_conditions
    }
  end

  def policy_conditions
    conditions = [
      [ "content-length-range", 1, max_bytes ],
      [ "starts-with", "$Content-Type", "image/" ],
      { "Content-Type" => content_type },
      { bucket: bucket },
      { "X-Amz-Algorithm" => algorithm },
      { "X-Amz-Credential" => credential },
      { "X-Amz-Date" => amz_date },
      { key: key }
    ]

    conditions << { "X-Amz-Security-Token" => session_token } if session_token.present?
    conditions
  end

  def signature
    OpenSSL::HMAC.hexdigest("sha256", signing_key, encoded_policy)
  end

  def signing_key
    date_key = hmac("AWS4#{secret_access_key}", date_stamp)
    date_region_key = hmac(date_key, region)
    date_region_service_key = hmac(date_region_key, "s3")
    hmac(date_region_service_key, "aws4_request")
  end

  def hmac(key, value)
    OpenSSL::HMAC.digest("sha256", key, value)
  end

  def credential
    "#{access_key_id}/#{date_stamp}/#{region}/s3/aws4_request"
  end

  def algorithm
    "AWS4-HMAC-SHA256"
  end

  def amz_date
    timestamp.strftime("%Y%m%dT%H%M%SZ")
  end

  def date_stamp
    timestamp.strftime("%Y%m%d")
  end

  def timestamp
    @timestamp ||= Time.current.utc
  end

  def expires_at
    timestamp + expires_in
  end

  def expires_in
    DEFAULT_EXPIRES_IN
  end

  def key
    @key ||= [ folder, tournament.id, "#{timestamp.to_i}-#{SecureRandom.hex(6)}-#{safe_filename}" ].join("/")
  end

  def folder
    PURPOSE_FOLDERS[purpose.presence || "admin"] || PURPOSE_FOLDERS.fetch("admin")
  end

  def safe_filename
    @safe_filename ||= begin
      safe = filename.downcase
        .gsub(/[^a-z0-9._-]+/, "-")
        .gsub(/-+/, "-")
        .gsub(/\A[-.]+|[-.]+\z/, "")

      safe = "upload" if safe.blank?
      safe.last(140)
    end
  end

  def upload_url
    "#{s3_origin}/"
  end

  def public_url
    if public_base_url.present?
      "#{public_base_url.delete_suffix("/")}/#{key}"
    else
      "#{s3_origin}/#{key}"
    end
  end

  def s3_origin
    "https://#{bucket}.s3.#{region}.amazonaws.com"
  end

  def max_bytes
    @max_bytes ||= ENV.fetch("S3_IMAGE_UPLOAD_MAX_BYTES", DEFAULT_MAX_BYTES).to_i
  end

  def bucket
    @bucket ||= required_env("S3_BUCKET", "AWS_S3_BUCKET")
  end

  def region
    @region ||= env_value("S3_REGION", "AWS_REGION").presence || DEFAULT_REGION
  end

  def access_key_id
    @access_key_id ||= required_env("S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID")
  end

  def secret_access_key
    @secret_access_key ||= required_env("S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY")
  end

  def session_token
    @session_token ||= env_value("S3_SESSION_TOKEN", "AWS_SESSION_TOKEN")
  end

  def public_base_url
    @public_base_url ||= env_value("S3_PUBLIC_BASE_URL", "AWS_S3_PUBLIC_BASE_URL")
  end

  def required_env(*names)
    value = env_value(*names)
    return value if value.present?

    raise ConfigurationError, "Missing env var: #{names.first}"
  end

  def env_value(*names)
    names.filter_map { |name| ENV.fetch(name, nil).presence }.first
  end

  def normalize_content_type(value)
    value.to_s.split(";").first.to_s.strip.downcase
  end
end
