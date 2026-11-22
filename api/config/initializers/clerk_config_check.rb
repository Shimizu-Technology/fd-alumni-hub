# frozen_string_literal: true

Rails.application.config.after_initialize do
  next unless Rails.env.production?

  if ClerkAuth.test_instance?
    Rails.logger.warn(
      "ClerkAuth is configured with a Clerk test instance in production. " \
      "Switch to the production Clerk instance for fd-alumni.shimizu-technology.com (see docs/DOMAIN-AND-CLERK-SETUP.md)."
    )
  end

  if ClerkAuth.authorized_parties.empty?
    Rails.logger.warn(
      "ClerkAuth has no authorized parties configured in production. " \
      "Set CLERK_AUTHORIZED_PARTIES (or ALLOWED_ORIGINS / PUBLIC_SITE_URL) to restrict JWT azp origins."
    )
  end
end
