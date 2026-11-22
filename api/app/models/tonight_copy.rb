module TonightCopy
  MENU = { "name" => 140, "price" => 40, "category" => 80, "available" => :boolean, "notes" => 500 }.freeze
  EVENT = { "title" => 180, "timeLabel" => 80, "description" => 1000, "campaignEventId" => 40 }.freeze
  SPOTLIGHT = { "hostClassLabel" => 80, "headline" => 180, "body" => 2000, "photoUrl" => :url, "hostCampaignId" => 40 }.freeze
  GUIDE = {
    "venueName" => 180, "venueAddress" => 280, "ticketSourceName" => 80, "ticketSourceUrl" => :url,
    "ticketSummary" => 1200, "doorInfo" => 1200, "eligibilityHighlights" => :list,
    "gameRuleHighlights" => :list, "conductHighlights" => :list, "bylawDisclaimer" => 1200
  }.freeze

  def self.valid_object?(value, fields)
    value.is_a?(Hash) && value.all? { |key, entry| fields.key?(key) && valid_value?(entry, fields.fetch(key)) }
  end

  def self.valid_value?(value, rule)
    case rule
    when :boolean then value == true || value == false
    when :list then value.is_a?(Array) && value.size <= 30 && value.all? { |entry| valid_value?(entry, 500) }
    when :url
      return false unless valid_value?(value, 2048)
      return true if value.empty?
      return false if value.match?(/[\\\s[:cntrl:]]/)

      uri = URI.parse(value)
      value.start_with?("/") && !value.start_with?("//") || uri.is_a?(URI::HTTPS) && uri.host.present? && !uri.userinfo
    else value.is_a?(String) && value.length <= rule
    end
  rescue URI::InvalidURIError
    false
  end

  def self.valid_rows?(rows, fields, required_key)
    rows.is_a?(Array) && rows.size <= 100 && rows.all? do |row|
      valid_object?(row, fields) && row[required_key].present?
    end
  end
end
