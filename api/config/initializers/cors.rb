# frozen_string_literal: true

# CORS is intentionally configured for the React/Vite frontend. Production has
# no fallback origins, so deployed frontend origins must be listed explicitly.
default_local_origins = %w[
  http://localhost:3000
  http://127.0.0.1:3000
  http://localhost:5173
  http://127.0.0.1:5173
  http://localhost:4173
  http://127.0.0.1:4173
].join(",")

# Production should fail closed unless deploy config explicitly declares the
# frontend origins. This avoids accidentally allowing localhost origins with
# credentialed CORS on a real API deployment.
default_origins = Rails.env.production? ? "" : default_local_origins
allowed_origins = ENV.fetch("ALLOWED_ORIGINS", default_origins).split(",").map(&:strip).reject(&:blank?)

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
