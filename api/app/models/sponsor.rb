class Sponsor < ApplicationRecord
  include SafeUrlValidation

  TIERS = %w[diamond platinum gold silver community].freeze
  TIER_LABELS = {
    "diamond" => "Diamond Sponsors",
    "platinum" => "Platinum Sponsors",
    "gold" => "Gold Sponsors",
    "silver" => "Silver Sponsors",
    "community" => "Community Partners"
  }.freeze
  LEGACY_TIER_ALIASES = {
    "diamond" => "diamond",
    "title" => "diamond",
    "presenting" => "diamond",
    "presenting sponsor" => "diamond",
    "title sponsor" => "diamond",
    "platinum" => "platinum",
    "gold" => "gold",
    "silver" => "silver",
    "community" => "community",
    "community partner" => "community",
    "bronze" => "community"
  }.freeze
  TIER_ORDER_SQL = "CASE tier WHEN 'diamond' THEN 1 WHEN 'platinum' THEN 2 WHEN 'gold' THEN 3 WHEN 'silver' THEN 4 ELSE 5 END".freeze

  belongs_to :tournament
  has_many :pledges, dependent: :restrict_with_error
  has_many :ledger_entries, dependent: :restrict_with_error

  before_validation :normalize_fields

  validates :name, presence: true, length: { maximum: 160 }
  validates :tier, presence: true, inclusion: { in: TIERS }
  validates :description, length: { maximum: 600 }, allow_nil: true
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates_https_url :logo_url, :target_url, if_changed: true

  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:position, :name) }
  scope :ordered_by_tier, -> { order(Arel.sql(TIER_ORDER_SQL), :position, :name) }

  def self.normalize_legacy_tier(raw_tier)
    cleaned = raw_tier.to_s.strip.downcase.gsub(/\s+/, " ")
    return "community" if cleaned.empty?

    LEGACY_TIER_ALIASES.fetch(cleaned, "community")
  end

  def tier_label
    TIER_LABELS.fetch(tier, "Community Partners")
  end

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      name: name,
      logoUrl: safe_public_url(logo_url),
      targetUrl: safe_public_url(target_url),
      tier: tier,
      tierLabel: tier_label,
      description: description,
      active: active,
      position: position,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  private

  def normalize_fields
    self.name = name.to_s.strip if name.present?
    self.description = description.to_s.strip.presence
    self.logo_url = logo_url.to_s.strip.presence
    self.target_url = target_url.to_s.strip.presence

    cleaned_tier = tier.to_s.strip.downcase.gsub(/\s+/, " ")
    self.tier = cleaned_tier.empty? ? "community" : cleaned_tier
  end

  def safe_public_url(raw_value)
    return nil if raw_value.blank?

    parse_safe_https_uri(raw_value)&.to_s
  end
end
