require "test_helper"
require Rails.root.join("config/cors_origins").to_s

class CorsOriginsTest < ActiveSupport::TestCase
  test "fails closed in production when no origins are configured" do
    assert_equal [], CorsOrigins.allowed_origins(env: {}, production: true)
  end

  test "merges ALLOWED_ORIGINS and PUBLIC_SITE_URL in production without duplicates" do
    env = {
      "PUBLIC_SITE_URL" => "https://fd-alumni.shimizu-technology.com/",
      "ALLOWED_ORIGINS" => "https://fd-alumni-tourney.netlify.app, https://fd-alumni.shimizu-technology.com"
    }

    assert_equal(
      [ "https://fd-alumni-tourney.netlify.app", "https://fd-alumni.shimizu-technology.com" ],
      CorsOrigins.allowed_origins(env: env, production: true)
    )
  end

  test "allows PUBLIC_SITE_URL alone in production" do
    env = { "PUBLIC_SITE_URL" => "https://fd-alumni.shimizu-technology.com" }

    assert_equal [ "https://fd-alumni.shimizu-technology.com" ], CorsOrigins.allowed_origins(env: env, production: true)
  end

  test "falls back to local origins outside production" do
    origins = CorsOrigins.allowed_origins(env: {}, production: false)

    assert_includes origins, "http://localhost:5173"
    assert_includes origins, "http://127.0.0.1:5173"
  end
end
