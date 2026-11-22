require "uri"

module SafeUrlValidation
  extend ActiveSupport::Concern

  class_methods do
    def validates_https_url(*attributes, allowed_hosts_env: nil)
      attributes.each do |attribute|
        validate do
          value = send(attribute)
          next if value.blank?

          uri = parse_safe_https_uri(value)
          unless uri
            errors.add(attribute, "must be a valid https:// URL")
            next
          end

          if allowed_hosts_env.present?
            allowed_hosts = ENV.fetch(allowed_hosts_env, "").split(",").map { |host| host.strip.downcase }.reject(&:blank?)
            if allowed_hosts.any? && !allowed_hosts.include?(uri.host.downcase)
              errors.add(attribute, "host is not in #{allowed_hosts_env}")
            end
          end
        end
      end
    end
  end

  MAX_URL_LENGTH = 2048

  private

  def parse_safe_https_uri(raw_value)
    value = raw_value.to_s.strip
    return nil if value.blank? || value.length > MAX_URL_LENGTH || value.match?(/[\r\n\t\0]/)

    uri = URI.parse(value)
    return nil unless uri.is_a?(URI::HTTPS) && uri.host.present? && uri.userinfo.blank?

    uri
  rescue URI::InvalidURIError
    nil
  end
end
