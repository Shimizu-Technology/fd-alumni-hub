class CampaignEvent < ApplicationRecord
  include SafeUrlValidation

  KINDS = %w[fundraiser host_night golf merch_drop meeting other].freeze
  STATUSES = %w[planned open sold_out completed cancelled].freeze
  HAFAPASS_ID_FORMAT = /\A[a-zA-Z0-9_-]{1,64}\z/
  HAFAPASS_CODE_FORMAT = /\A[a-z0-9_-]{1,64}\z/

  belongs_to :host_campaign

  before_validation :normalize_fields

  validates :kind, inclusion: { in: KINDS }
  validates :title, presence: true, length: { maximum: 180 }
  validates :status, inclusion: { in: STATUSES }
  validates :position, numericality: { only_integer: true }
  validates :goal_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :hafapass_event_id, format: { with: HAFAPASS_ID_FORMAT }, allow_nil: true
  validates :hafapass_event_slug, :hafapass_distribution_code, format: { with: HAFAPASS_CODE_FORMAT }, allow_nil: true
  validates_https_url :image_url, :external_url
  validate :ends_at_not_before_starts_at

  scope :not_archived, -> { where(archived_at: nil) }
  scope :public_listing, -> { not_archived.where(public_visible: true) }
  scope :upcoming_or_tba, -> {
    where.not(status: %w[completed cancelled])
      .where("starts_at IS NULL OR starts_at >= ?", Time.current)
  }
  scope :ordered, -> { order(Arel.sql("starts_at IS NULL, starts_at ASC, position ASC, id ASC")) }

  def archived?
    archived_at.present?
  end

  def public_json
    {
      id: id.to_s,
      kind: kind,
      title: title,
      startsAt: starts_at&.iso8601,
      endsAt: ends_at&.iso8601,
      dateLabel: date_label,
      venue: venue,
      description: description,
      imageUrl: image_url,
      hafapassEventId: hafapass_event_id,
      hafapassEventSlug: hafapass_event_slug,
      hafapassDistributionCode: hafapass_distribution_code,
      externalUrl: external_url,
      ctaLabel: cta_label,
      status: status,
      position: position
    }
  end

  private

  def normalize_fields
    self.title = title.to_s.strip if title.present?
    self.date_label = date_label.to_s.strip.presence
    self.venue = venue.to_s.strip.presence
    self.description = description.to_s.strip.presence
    self.image_url = image_url.to_s.strip.presence
    self.external_url = external_url.to_s.strip.presence
    self.cta_label = cta_label.to_s.strip.presence
    self.hafapass_event_id = hafapass_event_id.to_s.strip.presence
    self.hafapass_event_slug = hafapass_event_slug.to_s.strip.downcase.presence
    self.hafapass_distribution_code = hafapass_distribution_code.to_s.strip.downcase.presence
  end

  def ends_at_not_before_starts_at
    return if starts_at.blank? || ends_at.blank?
    return if ends_at >= starts_at

    errors.add(:ends_at, "must be on or after starts_at")
  end
end
