require "uri"

class StandardizeSponsorTiers < ActiveRecord::Migration[8.1]
  class MigrationSponsor < ActiveRecord::Base
    self.table_name = "sponsors"
  end

  CANONICAL_TIER_MAP = {
    "diamond" => "diamond",
    "diamond sponsor" => "diamond",
    "diamond partner" => "diamond",
    "title" => "diamond",
    "title sponsor" => "diamond",
    "title partner" => "diamond",
    "presenting" => "diamond",
    "presenting sponsor" => "diamond",
    "presenting partner" => "diamond",
    "platinum" => "platinum",
    "platinum sponsor" => "platinum",
    "platinum partner" => "platinum",
    "gold" => "gold",
    "gold sponsor" => "gold",
    "gold partner" => "gold",
    "silver" => "silver",
    "silver sponsor" => "silver",
    "silver partner" => "silver",
    "community" => "community",
    "community sponsor" => "community",
    "community partner" => "community",
    "bronze" => "community",
    "bronze sponsor" => "community",
    "bronze partner" => "community"
  }.freeze

  def up
    add_column :sponsors, :description, :text unless column_exists?(:sponsors, :description)

    MigrationSponsor.reset_column_information

    MigrationSponsor.find_each do |sponsor|
      normalized_tier = normalize_tier(sponsor.tier, sponsor_id: sponsor.id, sponsor_name: sponsor.name)
      normalized_logo = normalize_legacy_https_url(sponsor.logo_url, field: "logo_url", sponsor_id: sponsor.id)
      normalized_target = normalize_legacy_https_url(sponsor.target_url, field: "target_url", sponsor_id: sponsor.id)

      updates = {}
      updates[:tier] = normalized_tier if sponsor.tier != normalized_tier
      updates[:logo_url] = normalized_logo if sponsor.logo_url != normalized_logo
      updates[:target_url] = normalized_target if sponsor.target_url != normalized_target

      sponsor.update_columns(updates) if updates.any?
    end

    change_column_default :sponsors, :tier, from: nil, to: "community"
    change_column_null :sponsors, :tier, false, "community"

    unless check_constraint_exists?(:sponsors, name: "chk_sponsors_tier")
      add_check_constraint :sponsors,
        "tier IN ('diamond', 'platinum', 'gold', 'silver', 'community')",
        name: "chk_sponsors_tier"
    end

    unless index_exists?(:sponsors, [ :tournament_id, :active, :tier, :position ], name: "index_sponsors_on_tournament_active_tier_position")
      add_index :sponsors, [ :tournament_id, :active, :tier, :position ], name: "index_sponsors_on_tournament_active_tier_position"
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "StandardizeSponsorTiers normalizes legacy tier names and URLs and cannot be safely reversed"
  end

  private

  def normalize_tier(raw_tier, sponsor_id: nil, sponsor_name: nil)
    cleaned = raw_tier.to_s.strip.downcase.gsub(/\s+/, " ")
    return "community" if cleaned.empty?

    mapped = CANONICAL_TIER_MAP[cleaned]
    return mapped if mapped

    puts "StandardizeSponsorTiers: mapped unknown tier #{raw_tier.inspect} to 'community' for sponsor id=#{sponsor_id} name=#{sponsor_name.inspect}"
    "community"
  end

  def normalize_legacy_https_url(raw_value, field: nil, sponsor_id: nil)
    value = raw_value.to_s.strip
    return nil if value.empty?

    if value.length > 2048 || value.match?(/[\r\n\t\0]/)
      log_cleared_url(sponsor_id, field, raw_value)
      return nil
    end

    candidate =
      if value.start_with?("//")
        "https:#{value}"
      elsif value.match?(/\Ahttp:\/\//i)
        "https://#{value.sub(/\Ahttp:\/\//i, "")}"
      elsif !value.match?(/\A[a-z][a-z0-9+.-]*:/i)
        "https://#{value}"
      else
        value
      end

    uri = URI.parse(candidate)
    if uri.is_a?(URI::HTTPS) && uri.host.present? && uri.userinfo.blank?
      uri.to_s
    else
      log_cleared_url(sponsor_id, field, raw_value)
      nil
    end
  rescue URI::InvalidURIError
    log_cleared_url(sponsor_id, field, raw_value)
    nil
  end

  def log_cleared_url(sponsor_id, field, raw_value)
    return if sponsor_id.nil?

    puts "StandardizeSponsorTiers: cleared invalid #{field} #{raw_value.inspect} for sponsor id=#{sponsor_id}"
  end
end
