class SitePublication < ApplicationRecord
  MODES = %w[fundraising schedule_ready tournament_live tournament_recap].freeze
  SECTIONS = %w[fundraisers tonight schedule teams standings bracket tickets sponsors coverage recap].freeze
  OVERRIDES = %w[auto show hide].freeze
  SETTINGS = %w[mode tournament_id host_campaign_id section_overrides recap_headline recap_summary handoff_banner_enabled].freeze

  belongs_to :tournament, optional: true
  belongs_to :host_campaign, optional: true
  belongs_to :published_by, class_name: "User", optional: true
  belongs_to :restored_from, class_name: "SitePublication", optional: true

  validates :mode, inclusion: { in: MODES }
  validates :version_number, :published_at, presence: true, unless: -> { validation_context == :preview }
  validate :valid_section_overrides

  def self.current
    find_by(current: true)
  end

  def api_json
    {
      id: id.to_s, mode: mode, versionNumber: version_number,
      tournamentId: tournament_id&.to_s, hostCampaignId: host_campaign_id&.to_s,
      sectionOverrides: section_overrides, recapHeadline: recap_headline, recapSummary: recap_summary,
      handoffBannerEnabled: handoff_banner_enabled, publishedAt: published_at.iso8601,
      publishedByName: published_by&.full_name, restoredFromId: restored_from_id&.to_s
    }
  end

  private

  def valid_section_overrides
    return if section_overrides.is_a?(Hash) && section_overrides.all? { |key, value| SECTIONS.include?(key) && OVERRIDES.include?(value) }

    errors.add(:section_overrides, "must map known sections to auto, show, or hide")
  end
end
