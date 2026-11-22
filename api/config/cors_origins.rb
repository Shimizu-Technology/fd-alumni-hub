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
    return [] if production

    DEFAULT_LOCAL_ORIGINS
  end

  def parse_list(raw)
    raw.to_s.split(",").filter_map { |value| normalize_origin(value) }.uniq
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
end
