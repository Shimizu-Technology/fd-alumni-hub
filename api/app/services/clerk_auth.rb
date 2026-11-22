require "base64"
require "uri"

class ClerkAuth
  JWKS_CACHE_KEY = "clerk_jwks"
  JWKS_CACHE_TTL = 1.hour
  TOKEN_CLOCK_SKEW_LEEWAY_SECONDS = 30

  class << self
    def verify(token)
      return nil if token.blank?

      if Rails.env.test? && token.start_with?("test_token_")
        return handle_test_token(token)
      end

      payload = decode_with_jwks(token)
      return nil unless payload
      return nil unless valid_authorized_party?(payload)

      payload
    rescue JWT::ExpiredSignature
      Rails.logger.debug("JWT token expired")
      nil
    rescue JWT::DecodeError => e
      Rails.logger.warn("JWT decode error: #{e.message}")
      nil
    end

    def fetch_user_email(clerk_user_id)
      secret_key = ENV.fetch("CLERK_SECRET_KEY", nil)
      return nil if secret_key.blank? || clerk_user_id.blank?

      response = HTTParty.get(
        "https://api.clerk.com/v1/users/#{clerk_user_id}",
        headers: { "Authorization" => "Bearer #{secret_key}" },
        timeout: 5
      )

      return nil unless response.success?

      data = response.parsed_response
      primary_id = data["primary_email_address_id"]
      addresses = data["email_addresses"] || []
      primary = addresses.find { |address| address["id"] == primary_id } || addresses.first
      primary&.dig("email_address")
    rescue HTTParty::Error, Timeout::Error => e
      Rails.logger.warn("Clerk API email fetch failed for #{clerk_user_id}: #{e.message}")
      nil
    end

    def fetch_verified_user_email(clerk_user_id)
      secret_key = ENV.fetch("CLERK_SECRET_KEY", nil)
      return nil if secret_key.blank? || clerk_user_id.blank?

      response = HTTParty.get(
        "https://api.clerk.com/v1/users/#{clerk_user_id}",
        headers: { "Authorization" => "Bearer #{secret_key}" },
        timeout: 5
      )

      return nil unless response.success?

      data = response.parsed_response
      primary_id = data["primary_email_address_id"]
      addresses = Array(data["email_addresses"]).select do |address|
        address.is_a?(Hash) && address.dig("verification", "status") == "verified"
      end
      primary = addresses.find { |address| address["id"] == primary_id } || addresses.first
      primary&.dig("email_address")
    rescue HTTParty::Error, Timeout::Error => e
      Rails.logger.warn("Clerk API verified email fetch failed for #{clerk_user_id}: #{e.message}")
      nil
    end

    def expected_issuer
      configured_issuer || issuer_from_jwks_url || issuer_from_publishable_key
    end

    def jwks_url
      explicit = ENV.fetch("CLERK_JWKS_URL", nil).presence
      return explicit if explicit

      issuer = configured_issuer || issuer_from_publishable_key
      issuer.present? ? "#{issuer}/.well-known/jwks.json" : nil
    end

    def authorized_parties
      raw = ENV.fetch("CLERK_AUTHORIZED_PARTIES", nil).presence
      if raw
        return raw.split(",").filter_map { |origin| normalize_origin(origin) }.uniq
      end

      if Rails.env.production? && defined?(CorsOrigins)
        return CorsOrigins.allowed_origins(production: true)
      end

      []
    end

    def test_instance?
      publishable_key = ENV.fetch("CLERK_PUBLISHABLE_KEY", "").strip
      secret_key = ENV.fetch("CLERK_SECRET_KEY", "").strip
      issuer = expected_issuer.to_s

      publishable_key.start_with?("pk_test_") ||
        secret_key.start_with?("sk_test_") ||
        issuer.include?(".clerk.accounts.dev")
    end

    def valid_authorized_party?(payload)
      configured_raw = ENV.fetch("CLERK_AUTHORIZED_PARTIES", nil).presence
      parties = authorized_parties
      if configured_raw && parties.empty?
        Rails.logger.error("ClerkAuth: CLERK_AUTHORIZED_PARTIES is set but contains no valid origins; rejecting token.")
        return false
      end
      return true if parties.empty?
      return true unless payload.key?("azp")

      azp = normalize_origin(payload["azp"])
      azp.present? && parties.include?(azp)
    end

    private

    def decode_with_jwks(token)
      jwks = fetch_jwks
      return nil if jwks.nil?

      decode_token_with_jwks(token, jwks)
    rescue JWT::ExpiredSignature
      raise
    rescue JWT::DecodeError => e
      raise unless e.message.to_s.include?("Could not find public key for kid")

      refreshed_jwks = fetch_jwks(force_refresh: true)
      return nil if refreshed_jwks.nil?

      decode_token_with_jwks(token, refreshed_jwks)
    end

    def decode_token_with_jwks(token, jwks)
      decode_options = {
        algorithms: [ "RS256" ],
        jwks: jwks,
        verify_iat: true,
        leeway: TOKEN_CLOCK_SKEW_LEEWAY_SECONDS
      }

      if expected_issuer.present?
        decode_options[:iss] = expected_issuer
        decode_options[:verify_iss] = true
      end

      if expected_audience.present?
        decode_options[:aud] = expected_audience
        decode_options[:verify_aud] = true
      end

      JWT.decode(token, nil, true, decode_options).first
    end

    def fetch_jwks(force_refresh: false)
      jwks_uri = jwks_url
      return nil unless jwks_uri

      cache_key = "#{JWKS_CACHE_KEY}:#{jwks_uri}"
      unless force_refresh
        cached = Rails.cache.read(cache_key)
        return cached if cached.present?
      end

      response = HTTParty.get(jwks_uri, timeout: 5)

      if response.success?
        jwks = response.parsed_response
        Rails.cache.write(cache_key, jwks, expires_in: JWKS_CACHE_TTL)
        jwks
      else
        Rails.logger.error("Failed to fetch Clerk JWKS: #{response.code}")
        nil
      end
    rescue HTTParty::Error, Timeout::Error => e
      Rails.logger.error("Error fetching Clerk JWKS: #{e.message}")
      nil
    end

    def configured_issuer
      normalize_origin(ENV.fetch("CLERK_ISSUER", nil))
    end

    def issuer_from_jwks_url
      raw_url = ENV.fetch("CLERK_JWKS_URL", nil).presence
      return nil unless raw_url

      normalize_origin(raw_url)
    end

    def issuer_from_publishable_key
      key = ENV.fetch("CLERK_PUBLISHABLE_KEY", "").strip
      return nil unless key.match?(/\Apk_(?:test|live)_/)

      encoded = key.split("_", 3).last.to_s
      return nil if encoded.blank?

      padded = encoded + ("=" * ((4 - encoded.length % 4) % 4))
      domain = Base64.strict_decode64(padded).delete_suffix("$")
      return nil unless domain.match?(/\A[a-zA-Z0-9.-]+\z/)

      "https://#{domain}"
    rescue ArgumentError
      nil
    end

    def normalize_origin(raw_value)
      value = raw_value.to_s.strip
      return nil if value.blank?

      uri = URI.parse(value)
      return nil if uri.scheme.blank? || uri.host.blank?

      origin = +"#{uri.scheme}://#{uri.host}"
      origin << ":#{uri.port}" unless uri.port == uri.default_port
      origin
    rescue URI::InvalidURIError => e
      Rails.logger.warn("Invalid Clerk URL: #{e.message}")
      nil
    end

    def expected_audience
      raw = ENV.fetch("CLERK_AUDIENCE", nil).presence
      return nil unless raw

      values = raw.split(",").map(&:strip).reject(&:blank?)
      values.one? ? values.first : values
    end

    def handle_test_token(token)
      if token.start_with?("test_token_clerk_")
        parts = token.delete_prefix("test_token_clerk_").split(":", 3)
        clerk_id, email, verification = parts
        return nil if clerk_id.blank? || email.blank?

        return {
          "sub" => clerk_id,
          "email" => email,
          "email_verified" => verification == "verified"
        }
      end

      user_id = token.delete_prefix("test_token_")
      user = User.find_by(id: user_id)
      return nil unless user

      {
        "sub" => user.clerk_id.presence || "test_clerk_#{user.id}",
        "email" => user.email,
        "email_verified" => true,
        "first_name" => user.first_name,
        "last_name" => user.last_name
      }
    end
  end
end
