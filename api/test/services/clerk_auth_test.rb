require "test_helper"
require "base64"

class ClerkAuthTest < ActiveSupport::TestCase
  ENV_KEYS = %w[
    CLERK_PUBLISHABLE_KEY
    CLERK_ISSUER
    CLERK_JWKS_URL
    CLERK_AUTHORIZED_PARTIES
    CLERK_AUDIENCE
    CLERK_SECRET_KEY
  ].freeze

  setup do
    @env_backup = ENV_KEYS.to_h { |key| [ key, ENV.fetch(key, nil) ] }
    ENV_KEYS.each { |key| ENV.delete(key) }
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

  test "derives issuer and jwks url from production publishable key" do
    encoded_domain = Base64.strict_encode64("clerk.fd-alumni.shimizu-technology.com$")
    ENV["CLERK_PUBLISHABLE_KEY"] = "pk_live_#{encoded_domain}"

    assert_equal "https://clerk.fd-alumni.shimizu-technology.com", ClerkAuth.expected_issuer
    assert_equal "https://clerk.fd-alumni.shimizu-technology.com/.well-known/jwks.json", ClerkAuth.jwks_url
    assert_not ClerkAuth.test_instance?
  end

  test "explicit issuer overrides publishable key and normalizes trailing slash" do
    ENV["CLERK_PUBLISHABLE_KEY"] = "pk_test_#{Base64.strict_encode64("example.clerk.accounts.dev$")}"
    ENV["CLERK_ISSUER"] = "https://clerk.fd-alumni.shimizu-technology.com/"

    assert_equal "https://clerk.fd-alumni.shimizu-technology.com", ClerkAuth.expected_issuer
    assert_equal "https://clerk.fd-alumni.shimizu-technology.com/.well-known/jwks.json", ClerkAuth.jwks_url
    assert ClerkAuth.test_instance?
  end

  test "detects test clerk instances by key prefix or accounts.dev issuer" do
    ENV["CLERK_ISSUER"] = "https://steady-ox-12.clerk.accounts.dev"
    assert ClerkAuth.test_instance?

    ENV["CLERK_ISSUER"] = "https://clerk.fd-alumni.shimizu-technology.com"
    ENV["CLERK_SECRET_KEY"] = "sk_test_secret"
    assert ClerkAuth.test_instance?

    ENV["CLERK_SECRET_KEY"] = "sk_live_secret"
    assert_not ClerkAuth.test_instance?
  end

  test "enforces authorized parties against azp claim when configured" do
    ENV["CLERK_AUTHORIZED_PARTIES"] = "https://fd-alumni.shimizu-technology.com/, https://fd-alumni-tourney.netlify.app"

    assert_equal [ "https://fd-alumni.shimizu-technology.com", "https://fd-alumni-tourney.netlify.app" ], ClerkAuth.authorized_parties
    assert ClerkAuth.valid_authorized_party?({ "azp" => "https://fd-alumni.shimizu-technology.com" })
    assert ClerkAuth.valid_authorized_party?({ "azp" => "https://fd-alumni-tourney.netlify.app/" })
    assert ClerkAuth.valid_authorized_party?({ "sub" => "user_123" })
    assert_not ClerkAuth.valid_authorized_party?({ "azp" => "https://evil.example.com" })
  end
end
