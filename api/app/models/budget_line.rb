class BudgetLine < ApplicationRecord
  KINDS = %w[income expense].freeze
  MAX_CENTS = 100_000_000_000 # $1,000,000,000 cap (well within bigint)

  belongs_to :host_campaign
  has_many :ledger_entries, dependent: :restrict_with_error

  before_validation :normalize_fields
  before_destroy :prevent_destroy

  validates :kind, presence: true, inclusion: { in: KINDS }
  validates :category, presence: true, length: { maximum: 120 }
  validates :budget_cents, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: MAX_CENTS }
  validates :position, numericality: { only_integer: true }
  validate :unique_active_category
  validate :kind_immutable_when_referenced, on: :update

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

  def prevent_destroy
    errors.add(:base, "Budget lines cannot be hard-deleted; archive them instead")
    throw(:abort)
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

  def kind_immutable_when_referenced
    return unless will_save_change_to_kind? && ledger_entries.exists?

    errors.add(:kind, "cannot be changed after ledger entries are linked to this budget line")
  end
end
