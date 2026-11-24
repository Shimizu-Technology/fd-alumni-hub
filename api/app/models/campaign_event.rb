class CampaignEvent < ApplicationRecord
  include SafeUrlValidation

  KINDS = %w[fundraiser host_night golf merch_drop meeting other].freeze
  STATUSES = %w[planned open sold_out completed cancelled].freeze
  HAFAPASS_ID_FORMAT = /\A[a-zA-Z0-9_-]{1,64}\z/
  HAFAPASS_CODE_FORMAT = /\A[a-z0-9_-]{1,64}\z/

  belongs_to :host_campaign
  has_many :ledger_entries, dependent: :restrict_with_error

  before_validation :normalize_fields

  validates :kind, inclusion: { in: KINDS }
  validates :title, presence: true, length: { maximum: 180 }
  validates :status, inclusion: { in: STATUSES }
  validates :position, numericality: { only_integer: true }
  validates :goal_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :hafapass_event_id, format: { with: HAFAPASS_ID_FORMAT }, allow_nil: true
  validates :hafapass_event_slug, :hafapass_distribution_code, format: { with: HAFAPASS_CODE_FORMAT }, allow_nil: true
  validates :recap_notes, length: { maximum: 5000 }
  validates :recap_highlights, length: { maximum: 1000 }
  validates :raised_display, length: { maximum: 80 }
  validate :validate_recap_photos
  validates_https_url :image_url, :external_url
  validate :ends_at_not_before_starts_at

  scope :not_archived, -> { where(archived_at: nil) }
  scope :public_listing, -> { not_archived.where(public_visible: true) }
  scope :upcoming_or_tba, ->(now = Time.current) {
    where.not(status: %w[completed cancelled])
      .where("COALESCE(ends_at, starts_at) IS NULL OR COALESCE(ends_at, starts_at) >= ?", now)
  }
  scope :ordered, -> { order(Arel.sql("starts_at IS NULL, starts_at ASC, position ASC, id ASC")) }

  def archived?
    archived_at.present?
  end

  def effective_status(now = Time.current)
    return "cancelled" if status == "cancelled"
    boundary = ends_at || starts_at
    return "completed" if status == "completed" || (boundary && boundary < now)

    status
  end

  def past?(now = Time.current)
    effective_status(now).in?(%w[completed cancelled])
  end

  def public_json(now = Time.current)
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
      status: effective_status(now),
      recapNotes: recap_notes,
      recapHighlights: recap_highlights,
      raisedDisplay: raised_display,
      recapPhotos: recap_photos,
      position: position
    }
  end

  def admin_json
    payload = public_json
    payload.merge(
      storedStatus: status,
      autoCompleted: status != "completed" && payload[:status] == "completed",
      hostCampaignId: host_campaign_id.to_s,
      publicVisible: public_visible,
      goalCents: goal_cents,
      archivedAt: archived_at&.iso8601,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    )
  end

  private

  def normalize_fields
    self.recap_notes = recap_notes&.strip.presence
    self.recap_highlights = recap_highlights&.strip.presence
    self.raised_display = raised_display&.squish.presence
    self.recap_photos = recap_photos.map { |photo| normalize_photo(photo) } if recap_photos.is_a?(Array)
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

  def normalize_photo(photo)
    return photo unless photo.is_a?(Hash)

    url = photo["url"]
    caption = photo["caption"]
    normalized = { "url" => url.is_a?(String) ? url.strip : url }
    caption = caption.squish.presence if caption.is_a?(String)
    normalized["caption"] = caption unless caption.nil?
    normalized
  end

  def validate_recap_photos
    unless recap_photos.is_a?(Array) && recap_photos.size <= 24
      return errors.add(:recap_photos, "must be an array with at most 24 photos")
    end

    recap_photos.each_with_index do |photo, index|
      unless photo.is_a?(Hash) && photo["url"].is_a?(String) && parse_safe_https_uri(photo["url"])
        errors.add(:recap_photos, "photo #{index + 1} must have a valid https:// URL")
        next
      end

      caption = photo["caption"]
      if !caption.nil? && (!caption.is_a?(String) || caption.length > 240)
        errors.add(:recap_photos, "photo #{index + 1} caption must be text with at most 240 characters")
      end
    end
  end

  def ends_at_not_before_starts_at
    return if starts_at.blank? || ends_at.blank?
    return if ends_at >= starts_at

    errors.add(:ends_at, "must be on or after starts_at")
  end
end
