class TournamentAlert < ApplicationRecord
  SEVERITIES = %w[info warning urgent].freeze
  SEVERITY_ORDER_SQL = "CASE severity WHEN 'urgent' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END".freeze

  belongs_to :tournament, optional: true
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true

  before_validation :normalize_fields

  validates :severity, presence: true, inclusion: { in: SEVERITIES }
  validates :title, presence: true, length: { maximum: 140 }
  validates :message, presence: true, length: { maximum: 1000 }
  validate :tournament_exists
  validate :expires_after_starts

  scope :active_now, lambda { |at = Time.current|
    where(active: true)
      .where("starts_at IS NULL OR starts_at <= ?", at)
      .where("expires_at IS NULL OR expires_at > ?", at)
  }

  scope :for_public_tournament, lambda { |tournament|
    if tournament
      where(tournament_id: [ nil, tournament.id ])
    else
      where(tournament_id: nil)
    end
  }

  scope :ordered_for_display, -> { order(Arel.sql(SEVERITY_ORDER_SQL), updated_at: :desc, id: :desc) }

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id&.to_s,
      severity: severity,
      title: title,
      message: message,
      active: active,
      startsAt: starts_at&.iso8601,
      expiresAt: expires_at&.iso8601,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  private

  def normalize_fields
    self.severity = severity.to_s.strip.downcase.presence || "warning"
    self.title = title.to_s.strip if title.present?
    self.message = message.to_s.strip if message.present?
  end

  def tournament_exists
    return if tournament_id.blank?
    return if Tournament.exists?(id: tournament_id)

    errors.add(:tournament_id, "does not exist")
  end

  def expires_after_starts
    return if starts_at.blank? || expires_at.blank?
    return if expires_at > starts_at

    errors.add(:expires_at, "must be after starts_at")
  end
end
