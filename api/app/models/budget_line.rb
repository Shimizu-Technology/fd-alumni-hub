class BudgetLine < ApplicationRecord
  KINDS = %w[income expense].freeze

  belongs_to :host_campaign
  has_many :ledger_entries, dependent: :restrict_with_error

  before_validation :normalize_fields

  validates :kind, presence: true, inclusion: { in: KINDS }
  validates :category, presence: true, length: { maximum: 120 }
  validates :budget_cents, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :position, numericality: { only_integer: true }
  validate :unique_active_category

  scope :active, -> { where(archived_at: nil) }
  scope :ordered, -> { order(:kind, :position, :category, :id) }

  def archived?
    archived_at.present?
  end

  def api_json(actual_cents: nil)
    payload = {
      id: id.to_s,
      hostCampaignId: host_campaign_id.to_s,
      kind: kind,
      category: category,
      budgetCents: budget_cents,
      position: position,
      notes: notes,
      archivedAt: archived_at&.iso8601,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
    payload[:actualCents] = actual_cents unless actual_cents.nil?
    payload
  end

  private

  def normalize_fields
    self.kind = kind.to_s.strip.downcase if kind.present?
    self.category = category.to_s.strip if category.present?
    self.notes = notes.to_s.strip.presence
  end

  def unique_active_category
    return if archived? || host_campaign_id.blank? || kind.blank? || category.blank?

    scope = self.class.active
      .where(host_campaign_id: host_campaign_id, kind: kind)
      .where("LOWER(category) = ?", category.downcase)
    scope = scope.where.not(id: id) if persisted?
    return unless scope.exists?

    errors.add(:category, "already exists as an active #{kind} budget line")
  end
end
