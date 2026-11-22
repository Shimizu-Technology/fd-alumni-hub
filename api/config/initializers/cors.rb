# frozen_string_literal: true

require Rails.root.join("config/cors_origins").to_s

# CORS is configured via ALLOWED_ORIGINS (and optionally PUBLIC_SITE_URL).
# Production fails closed unless deploy config explicitly declares allowed
# frontend origins (e.g. https://fd-alumni.shimizu-technology.com and the
# Netlify origin during cutover).
allowed_origins = CorsOrigins.allowed_origins(env: ENV, production: Rails.env.production?)

if allowed_origins.any?
  Rails.application.config.middleware.insert_before 0, Rack::Cors do
    allow do
      origins allowed_origins

      resource "*",
        headers: :any,
        methods: [ :get, :post, :put, :patch, :delete, :options, :head ],
        expose: [ "Authorization" ],
        credentials: true
    end
  end
end
