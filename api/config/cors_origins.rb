# frozen_string_literal: true

require "uri"

module CorsOrigins
  DEFAULT_LOCAL_ORIGINS = %w[
    http://localhost:3000
    http://127.0.0.1:3000
    http://localhost:5173
    http://127.0.0.1:5173
    http://localhost:4173
    http://127.0.0.1:4173
  ].freeze

  module_function

  def allowed_origins(env: ENV, production: Rails.env.production?)
    configured = parse_list(env["ALLOWED_ORIGINS"])
    site_origin = normalize_origin(env["PUBLIC_SITE_URL"].presence || env["SITE_URL"].presence)
    origins = (configured + [ site_origin ].compact).uniq

    return origins if origins.any?

    if production
      log_warn("CorsOrigins: no valid CORS origins configured in production; set ALLOWED_ORIGINS or PUBLIC_SITE_URL.")
      return []
    end

    DEFAULT_LOCAL_ORIGINS
  end

  def parse_list(raw)
    raw.to_s.split(",").filter_map do |value|
      trimmed = value.to_s.strip
      next if trimmed.empty?

      normalized = normalize_origin(trimmed)
      log_warn("CorsOrigins: ignoring invalid CORS origin entry #{trimmed.inspect}") if normalized.nil?
      normalized
    end.uniq
  end

  def normalize_origin(raw)
    value = raw.to_s.strip
    return nil if value.empty?

    uri = URI.parse(value)
    return nil unless %w[http https].include?(uri.scheme) && uri.host.present?

    origin = +"#{uri.scheme}://#{uri.host}"
    origin << ":#{uri.port}" unless uri.port == uri.default_port
    origin
  rescue URI::InvalidURIError
    nil
  end

  def log_warn(message)
    Rails.logger&.warn(message) if defined?(Rails)
  end
end
