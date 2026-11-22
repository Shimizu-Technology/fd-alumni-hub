# frozen_string_literal: true

Rails.application.config.after_initialize do
  next unless Rails.env.production?

  if ClerkAuth.test_instance?
    Rails.logger.warn(
      "ClerkAuth is configured with a Clerk test instance in production. " \
      "Switch to the production Clerk instance for fd-alumni.shimizu-technology.com (see docs/DOMAIN-AND-CLERK-SETUP.md)."
    )
  end
end
