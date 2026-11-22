require "uri"

module SafeUrlValidation
  extend ActiveSupport::Concern

  class_methods do
    def validates_https_url(*attributes, allowed_hosts_env: nil, if_changed: false, strict: false)
      attributes.each do |attribute|
        validate do
          next if if_changed && !will_save_change_to_attribute?(attribute.to_s)

          value = send(attribute)
          next if value.blank?

          uri = parse_safe_https_uri(value)
          unless uri && (!strict || uri.is_a?(URI::HTTPS))
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
    return nil unless uri.host.present? && uri.userinfo.blank?
    return uri if uri.is_a?(URI::HTTPS)
    if (Rails.env.development? || Rails.env.test?) && uri.is_a?(URI::HTTP) && %w[localhost 127.0.0.1].include?(uri.host)
      return uri
    end

    nil
  rescue URI::InvalidURIError
    nil
  end
end
