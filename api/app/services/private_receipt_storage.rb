require "base64"
require "openssl"
require "securerandom"
require "uri"

class PrivateReceiptStorage
  DEFAULT_REGION = "ap-southeast-2".freeze
  DEFAULT_MAX_BYTES = 15.megabytes
  POST_EXPIRES_IN = 60.seconds
  GET_EXPIRES_IN = 120.seconds
  ALLOWED_CONTENT_TYPES = %w[
    image/jpeg
    image/png
    image/webp
    image/heic
    application/pdf
  ].freeze

  class ConfigurationError < StandardError; end
  class VerificationError < StandardError; end

  class << self
    def presign_post(campaign_id:, filename:, content_type:, byte_size:)
      new.presign_post(campaign_id: campaign_id, filename: filename, content_type: content_type, byte_size: byte_size)
    end

    def verify_object(key:, expected_content_type:, campaign_id: nil, http_head: nil)
      new.verify_object(key: key, expected_content_type: expected_content_type, campaign_id: campaign_id, http_head: http_head)
    end

    def presign_get(key:, filename:, content_type:, campaign_id: nil)
      new.presign_get(key: key, filename: filename, content_type: content_type, campaign_id: campaign_id)
    end

    def sanitize_download_filename(raw)
      base = File.basename(raw.to_s.gsub("\\", "/"))
      cleaned = base.gsub(/[\x00-\x1F\x7F"';\/\\]/, " ").gsub(/\s+/, " ").strip
      cleaned = "receipt" if cleaned.blank?
      cleaned.first(120)
    end
  end

  def presign_post(campaign_id:, filename:, content_type:, byte_size:)
    ensure_configured!
    raise ArgumentError, "campaign_id is required" if campaign_id.blank?

    clean_filename = self.class.sanitize_download_filename(filename)
    normalized_type = normalize_content_type(content_type)
    unless ALLOWED_CONTENT_TYPES.include?(normalized_type)
      raise ArgumentError, "Receipt must be a JPEG, PNG, WebP, HEIC, or PDF file"
    end

    size = parse_positive_int(byte_size)
    raise ArgumentError, "Receipt byte size is required" if size.nil?
    if size > max_bytes
      raise ArgumentError, "Receipt must be #{max_bytes / 1.megabyte}MB or smaller"
    end

    now = Time.current.utc
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    key = build_object_key(campaign_id: campaign_id, timestamp: now, filename: clean_filename)
    cred = credential(date_stamp)

    conditions = [
      [ "content-length-range", 1, max_bytes ],
      { "Content-Type" => normalized_type },
      { bucket: bucket },
      { "X-Amz-Algorithm" => "AWS4-HMAC-SHA256" },
      { "X-Amz-Credential" => cred },
      { "X-Amz-Date" => amz_date },
      { key: key }
    ]
    conditions << { "X-Amz-Security-Token" => session_token } if session_token.present?

    policy = {
      expiration: (now + POST_EXPIRES_IN).iso8601,
      conditions: conditions
    }
    encoded_policy = Base64.strict_encode64(policy.to_json)
    sig = OpenSSL::HMAC.hexdigest("sha256", signing_key(date_stamp), encoded_policy)

    fields = {
      "Content-Type" => normalized_type,
      "bucket" => bucket,
      "X-Amz-Algorithm" => "AWS4-HMAC-SHA256",
      "X-Amz-Credential" => cred,
      "X-Amz-Date" => amz_date,
      "key" => key,
      "Policy" => encoded_policy,
      "X-Amz-Signature" => sig
    }
    fields["X-Amz-Security-Token"] = session_token if session_token.present?

    {
      key: key,
      sanitizedFilename: clean_filename,
      contentType: normalized_type,
      maxBytes: max_bytes,
      expiresIn: POST_EXPIRES_IN.to_i,
      upload: {
        url: "#{s3_origin}/",
        fields: fields
      }
    }
  end

  def verify_object(key:, expected_content_type:, campaign_id: nil, http_head: nil)
    ensure_configured!
    raise VerificationError, "Invalid receipt key" unless valid_receipt_key?(key, campaign_id: campaign_id)

    now = Time.current.utc
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    canonical_uri = encode_s3_path(key)
    payload_hash = "UNSIGNED-PAYLOAD"

    headers_to_sign = {
      "host" => s3_host,
      "x-amz-content-sha256" => payload_hash,
      "x-amz-date" => amz_date
    }
    headers_to_sign["x-amz-security-token"] = session_token if session_token.present?

    signed_header_names = headers_to_sign.keys.sort
    canonical_headers = signed_header_names.map { |k| "#{k}:#{headers_to_sign[k]}\n" }.join
    signed_headers = signed_header_names.join(";")

    canonical_request = [
      "HEAD",
      canonical_uri,
      "",
      canonical_headers,
      signed_headers,
      payload_hash
    ].join("\n")

    scope = "#{date_stamp}/#{region}/s3/aws4_request"
    string_to_sign = [
      "AWS4-HMAC-SHA256",
      amz_date,
      scope,
      OpenSSL::Digest::SHA256.hexdigest(canonical_request)
    ].join("\n")
    sig = OpenSSL::HMAC.hexdigest("sha256", signing_key(date_stamp), string_to_sign)

    request_headers = {
      "X-Amz-Date" => amz_date,
      "X-Amz-Content-Sha256" => payload_hash,
      "Authorization" => "AWS4-HMAC-SHA256 Credential=#{credential(date_stamp)}, SignedHeaders=#{signed_headers}, Signature=#{sig}"
    }
    request_headers["X-Amz-Security-Token"] = session_token if session_token.present?

    requester = http_head || HTTParty.method(:head)
    response = requester.call(
      "#{s3_origin}#{canonical_uri}",
      headers: request_headers,
      open_timeout: 2,
      read_timeout: 3,
      follow_redirects: false
    )

    unless response.respond_to?(:code) && response.code.to_i == 200
      raise VerificationError, "Uploaded receipt could not be verified in private storage (HTTP #{response.respond_to?(:code) ? response.code : 'error'})"
    end

    res_headers = response.respond_to?(:headers) ? response.headers : {}
    actual_size = parse_positive_int(header_value(res_headers, "content-length"))
    actual_type = normalize_content_type(header_value(res_headers, "content-type"))

    if actual_size.nil? || actual_size > max_bytes
      raise VerificationError, "Uploaded receipt size is invalid or exceeds #{max_bytes / 1.megabyte}MB"
    end

    unless ALLOWED_CONTENT_TYPES.include?(actual_type) && actual_type == normalize_content_type(expected_content_type)
      raise VerificationError, "Uploaded receipt content type (#{actual_type.presence || 'unknown'}) does not match expected type"
    end

    {
      contentType: actual_type,
      byteSize: actual_size
    }
  rescue VerificationError, ConfigurationError
    raise
  rescue StandardError => e
    Rails.logger.warn("[PrivateReceiptStorage] HEAD verify failed for #{key}: #{e.class}: #{e.message}") if defined?(Rails) && Rails.logger
    raise VerificationError, "Unable to verify uploaded receipt right now. Please retry."
  end

  def presign_get(key:, filename:, content_type:, campaign_id: nil)
    ensure_configured!
    raise ArgumentError, "Invalid receipt key" unless valid_receipt_key?(key, campaign_id: campaign_id)

    clean_filename = self.class.sanitize_download_filename(filename)
    ascii_filename = clean_filename.encode("ASCII", invalid: :replace, undef: :replace, replace: "_").gsub(/["\\;]/, "_")
    encoded_utf8 = rfc3986_encode(clean_filename)
    normalized_type = normalize_content_type(content_type)
    safe_inline = ALLOWED_CONTENT_TYPES.include?(normalized_type)
    disposition_kind = safe_inline ? "inline" : "attachment"
    disposition = "#{disposition_kind}; filename=\"#{ascii_filename}\"; filename*=UTF-8''#{encoded_utf8}"

    now = Time.current.utc
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    canonical_uri = encode_s3_path(key)
    scope = "#{date_stamp}/#{region}/s3/aws4_request"

    query_params = {
      "X-Amz-Algorithm" => "AWS4-HMAC-SHA256",
      "X-Amz-Credential" => credential(date_stamp),
      "X-Amz-Date" => amz_date,
      "X-Amz-Expires" => GET_EXPIRES_IN.to_i.to_s,
      "X-Amz-SignedHeaders" => "host",
      "response-content-disposition" => disposition,
      "response-content-type" => safe_inline ? normalized_type : "application/octet-stream"
    }
    query_params["X-Amz-Security-Token"] = session_token if session_token.present?

    canonical_query = query_params
      .sort_by { |k, _| k }
      .map { |k, v| "#{rfc3986_encode(k)}=#{rfc3986_encode(v)}" }
      .join("&")

    canonical_request = [
      "GET",
      canonical_uri,
      canonical_query,
      "host:#{s3_host}\n",
      "host",
      "UNSIGNED-PAYLOAD"
    ].join("\n")

    string_to_sign = [
      "AWS4-HMAC-SHA256",
      amz_date,
      scope,
      OpenSSL::Digest::SHA256.hexdigest(canonical_request)
    ].join("\n")
    sig = OpenSSL::HMAC.hexdigest("sha256", signing_key(date_stamp), string_to_sign)

    {
      url: "#{s3_origin}#{canonical_uri}?#{canonical_query}&X-Amz-Signature=#{sig}",
      expiresIn: GET_EXPIRES_IN.to_i,
      filename: clean_filename,
      contentType: normalize_content_type(content_type)
    }
  end

  private

  def ensure_configured!
    bucket
    access_key_id
    secret_access_key
  end

  def bucket
    @bucket ||= begin
      # Intentionally NEVER falls back to public S3_BUCKET (fail-closed)
      value = ENV["S3_PRIVATE_BUCKET"].to_s.strip
      raise ConfigurationError, "Private receipt storage is not configured (missing S3_PRIVATE_BUCKET)" if value.empty?

      value
    end
  end

  def region
    @region ||= env_value("S3_PRIVATE_REGION", "S3_REGION", "AWS_REGION").presence || DEFAULT_REGION
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

  def max_bytes
    @max_bytes ||= begin
      configured = parse_positive_int(ENV["S3_RECEIPT_UPLOAD_MAX_BYTES"])
      configured || DEFAULT_MAX_BYTES
    end
  end

  def s3_host
    "#{bucket}.s3.#{region}.amazonaws.com"
  end

  def s3_origin
    "https://#{s3_host}"
  end

  def credential(date_stamp)
    "#{access_key_id}/#{date_stamp}/#{region}/s3/aws4_request"
  end

  def signing_key(date_stamp)
    date_key = hmac("AWS4#{secret_access_key}", date_stamp)
    date_region_key = hmac(date_key, region)
    date_region_service_key = hmac(date_region_key, "s3")
    hmac(date_region_service_key, "aws4_request")
  end

  def hmac(key, value)
    OpenSSL::HMAC.digest("sha256", key, value)
  end

  def build_object_key(campaign_id:, timestamp:, filename:)
    slug = filename.downcase
      .gsub(/[^a-z0-9._-]+/, "-")
      .gsub(/\.{2,}/, ".")
      .gsub(/-+/, "-")
      .gsub(/\A[-.]+|[-.]+\z/, "")
    slug = "receipt" if slug.blank?
    "receipts/#{campaign_id}/#{timestamp.to_i}-#{SecureRandom.hex(8)}-#{slug.last(100)}"
  end

  def valid_receipt_key?(key, campaign_id: nil)
    return false unless key.is_a?(String) && !key.empty?

    segments = key.split("/", -1)
    return false unless segments.length == 3 && segments[0] == "receipts"
    return false if campaign_id.present? && segments[1] != campaign_id.to_s

    segments.none? { |seg| seg.empty? || seg == "." || seg == ".." }
  end

  def encode_s3_path(key)
    "/" + key.split("/").map { |seg| rfc3986_encode(seg) }.join("/")
  end

  def rfc3986_encode(str)
    str.to_s.b.gsub(/[^A-Za-z0-9\-_.~]/) { |ch| format("%%%02X", ch.ord) }
  end

  def header_value(headers, target_name)
    return nil unless headers.respond_to?(:each)

    down = target_name.downcase
    headers.each do |k, v|
      return Array(v).first if k.to_s.downcase == down
    end
    nil
  end

  def parse_positive_int(value)
    if value.is_a?(Integer)
      return value.positive? ? value : nil
    end
    return nil unless value.is_a?(String)

    parsed = Integer(value.strip, 10, exception: false)
    parsed&.positive? ? parsed : nil
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
    normalized = value.to_s.split(";").first.to_s.strip.downcase
    normalized == "image/heif" ? "image/heic" : normalized
  end
end
