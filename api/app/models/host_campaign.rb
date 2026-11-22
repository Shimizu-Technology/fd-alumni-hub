class HostCampaign < ApplicationRecord
  include SafeUrlValidation

  STATUSES = %w[draft active closing archived].freeze
  PUBLIC_STATUSES = %w[active closing archived].freeze
  FEATUREABLE_STATUSES = %w[active closing].freeze
  SLUG_FORMAT = /\A[a-z0-9](?:[a-z0-9-]{1,62})[a-z0-9]\z/
  HAFAPASS_CODE_FORMAT = /\A[a-z0-9_-]{1,64}\z/
  GUAM_ZONE = "Pacific/Guam".freeze

  belongs_to :tournament
  belongs_to :class_cohort

  has_many :campaign_events, dependent: :restrict_with_error
  has_many :campaign_posts, dependent: :restrict_with_error
  has_many :campaign_memberships, dependent: :restrict_with_error
  has_many :campaign_invitations, dependent: :restrict_with_error
  has_many :budget_lines, dependent: :restrict_with_error
  has_many :pledges, dependent: :restrict_with_error
  has_many :ledger_entries, dependent: :restrict_with_error
  has_many :pending_receipt_uploads, dependent: :restrict_with_error
  has_many :finance_audit_events, dependent: :restrict_with_error

  before_validation :normalize_fields

  validates :tournament_id, uniqueness: true
  validates :slug, presence: true, uniqueness: true, format: { with: SLUG_FORMAT }
  validates :title, presence: true, length: { maximum: 160 }
  validates :status, inclusion: { in: STATUSES }
  validates :goal_cents, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :fdaa_upfront_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :fdaa_ticket_share_bps, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 10_000 }
  validates :hafapass_organizer_slug, :hafapass_tournament_organizer_slug, :hafapass_distribution_code,
    format: { with: HAFAPASS_CODE_FORMAT }, allow_nil: true
  validates_https_url :hero_image_url, :golf_url
  validates_https_url :donation_url, allowed_hosts_env: "DONATION_URL_ALLOWED_HOSTS"
  validate :featured_requires_active_or_closing
  validate :single_featured_campaign

  scope :publicly_visible, -> { where(status: PUBLIC_STATUSES) }
  scope :featured_public, -> { where(featured: true, status: FEATUREABLE_STATUSES) }

  def self.resolve_active_for_home
    base = where(status: FEATUREABLE_STATUSES).includes(:tournament, :class_cohort)
    base.where(featured: true).first || base.order(updated_at: :desc, id: :desc).first
  end

  def self.resolve_public(slug: nil, year: nil)
    base = publicly_visible.includes(:tournament, :class_cohort)

    if slug.present?
      return base.find_by(slug: slug.to_s.strip.downcase)
    end

    if year.present?
      numeric_year = Integer(year.to_s.strip, 10, exception: false)
      return nil unless numeric_year&.positive?

      return base.joins(:tournament)
        .where(tournaments: { year: numeric_year })
        .order(featured: :desc, updated_at: :desc, id: :desc)
        .first
    end

    base.where(featured: true, status: FEATUREABLE_STATUSES).first ||
      base.where(status: FEATUREABLE_STATUSES).order(updated_at: :desc, id: :desc).first ||
      base.where(status: "archived").order(updated_at: :desc, id: :desc).first
  end

  def archived?
    status == "archived"
  end

  def draft?
    status == "draft"
  end

  def finance_writable?
    FEATUREABLE_STATUSES.include?(status)
  end

  def effective_countdown_target_at
    return countdown_target_at if countdown_target_at.present?
    return nil unless tournament&.start_date

    ActiveSupport::TimeZone[GUAM_ZONE].local(
      tournament.start_date.year,
      tournament.start_date.month,
      tournament.start_date.day,
      18, 0, 0
    )
  end

  def public_meter_json(raised_cents: 0, updated_at: self.updated_at)
    return { enabled: false } unless public_meter_enabled?

    safe_raised = [ raised_cents.to_i, 0 ].max
    raw_percent = goal_cents.positive? ? ((safe_raised.to_f / goal_cents) * 100.0) : 0.0

    {
      enabled: true,
      goalCents: goal_cents,
      raisedCents: safe_raised,
      percent: raw_percent.clamp(0.0, 100.0).round(1),
      goalReached: safe_raised >= goal_cents,
      updatedAt: updated_at&.iso8601
    }
  end

  def public_json(meter_raised_cents: nil, meter_updated_at: nil)
    if public_meter_enabled? && meter_raised_cents.nil?
      totals = HostCampaigns::FinanceSummary.public_meter_totals(self)
      meter_raised_cents = totals[:raised_cents]
      meter_updated_at ||= totals[:updated_at]
    end

    {
      id: id.to_s,
      slug: slug,
      title: title,
      tagline: tagline,
      description: description,
      status: status,
      featured: featured,
      tournament: tournament&.api_json,
      hostClass: class_cohort&.api_json,
      countdownTargetAt: effective_countdown_target_at&.in_time_zone(GUAM_ZONE)&.iso8601,
      countdownLabel: countdown_label,
      heroImageUrl: hero_image_url,
      donationUrl: donation_url,
      donationInstructions: donation_instructions,
      golfUrl: golf_url,
      meter: public_meter_json(raised_cents: meter_raised_cents.to_i, updated_at: meter_updated_at || updated_at)
    }
  end

  def admin_json
    public_json.merge(
      tournamentId: tournament_id.to_s,
      classCohortId: class_cohort_id.to_s,
      goalCents: goal_cents,
      hafapassOrganizerSlug: hafapass_organizer_slug,
      hafapassTournamentOrganizerSlug: hafapass_tournament_organizer_slug,
      hafapassDistributionCode: hafapass_distribution_code,
      fdaaUpfrontCents: fdaa_upfront_cents,
      fdaaTicketShareBps: fdaa_ticket_share_bps,
      publicMeterEnabled: public_meter_enabled,
      includeFdaaInPublicMeter: include_fdaa_in_public_meter,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    )
  end

  def home_summary_json(meter_raised_cents: nil, meter_updated_at: nil, include_meter: true)
    if include_meter && public_meter_enabled? && meter_raised_cents.nil?
      totals = HostCampaigns::FinanceSummary.public_meter_totals(self)
      meter_raised_cents = totals[:raised_cents]
      meter_updated_at ||= totals[:updated_at]
    end
    next_event = campaign_events.public_listing.upcoming_or_tba.ordered.first

    summary = {
      slug: slug,
      title: title,
      tagline: tagline,
      status: status,
      hostClass: class_cohort&.api_json,
      countdownTargetAt: effective_countdown_target_at&.in_time_zone(GUAM_ZONE)&.iso8601,
      countdownLabel: countdown_label,
      donationUrl: donation_url,
      golfUrl: golf_url,
      nextEvent: next_event&.public_json
    }
    summary[:meter] = public_meter_json(raised_cents: meter_raised_cents.to_i, updated_at: meter_updated_at || updated_at) if include_meter
    summary
  end

  private

  def normalize_fields
    self.slug = slug.to_s.strip.downcase if slug.present?
    self.title = title.to_s.strip if title.present?
    self.tagline = tagline.to_s.strip.presence
    self.description = description.to_s.strip.presence
    self.countdown_label = countdown_label.to_s.strip.presence
    self.hero_image_url = hero_image_url.to_s.strip.presence
    self.donation_url = donation_url.to_s.strip.presence
    self.donation_instructions = donation_instructions.to_s.strip.presence
    self.golf_url = golf_url.to_s.strip.presence
    self.hafapass_organizer_slug = hafapass_organizer_slug.to_s.strip.downcase.presence
    self.hafapass_tournament_organizer_slug = hafapass_tournament_organizer_slug.to_s.strip.downcase.presence
    self.hafapass_distribution_code = hafapass_distribution_code.to_s.strip.downcase.presence
  end

  def featured_requires_active_or_closing
    return unless featured?
    return if FEATUREABLE_STATUSES.include?(status)

    errors.add(:featured, "can only be enabled when campaign status is active or closing")
  end

  def single_featured_campaign
    return unless featured?

    conflict = HostCampaign.where(featured: true)
    conflict = conflict.where.not(id: id) if persisted?
    return unless conflict.exists?

    errors.add(:featured, "another campaign is already featured")
  end
end
