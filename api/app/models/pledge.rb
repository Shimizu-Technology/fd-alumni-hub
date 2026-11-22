class Pledge < ApplicationRecord
  STATUSES = %w[promised partial fulfilled cancelled].freeze

  belongs_to :host_campaign
  belongs_to :sponsor, optional: true
  belongs_to :recorded_by, class_name: "User"
  has_many :ledger_entries, dependent: :restrict_with_error

  before_validation :normalize_fields

  validates :donor_name, presence: true, length: { maximum: 180 }
  validates :promised_cents, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validate :sponsor_matches_campaign_tournament
  validate :cannot_cancel_with_live_income

  scope :active_cash, -> { where(is_in_kind: false).where.not(status: "cancelled") }
  scope :ordered, -> { order(Arel.sql("CASE status WHEN 'promised' THEN 0 WHEN 'partial' THEN 1 WHEN 'fulfilled' THEN 2 ELSE 3 END, due_on IS NULL, due_on ASC, id DESC")) }

  def cancelled?
    status == "cancelled"
  end

  def received_cents_total
    ledger_entries.live.where(entry_type: "income").sum(:amount_cents).to_i
  end

  def sync_fulfillment_status!
    return if cancelled?

    received = received_cents_total
    next_status = if received >= promised_cents
      "fulfilled"
    elsif received.positive?
      "partial"
    else
      "promised"
    end

    update!(status: next_status) if status != next_status
  end

  def api_json(received_cents: nil)
    received = received_cents.nil? ? received_cents_total : received_cents.to_i
    outstanding = cancelled? ? 0 : [ promised_cents - received, 0 ].max
    overpayment = [ received - promised_cents, 0 ].max

    {
      id: id.to_s,
      hostCampaignId: host_campaign_id.to_s,
      sponsorId: sponsor_id&.to_s,
      sponsorName: sponsor&.name,
      donorName: donor_name,
      contactInfo: contact_info,
      tier: tier,
      isInKind: is_in_kind,
      promisedCents: promised_cents,
      receivedCents: received,
      outstandingCents: outstanding,
      overpaymentCents: overpayment,
      dueOn: due_on&.iso8601,
      status: status,
      notes: notes,
      recordedById: recorded_by_id.to_s,
      recordedByName: recorded_by&.full_name,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  private

  def normalize_fields
    self.donor_name = donor_name.to_s.strip if donor_name.present?
    self.contact_info = contact_info.to_s.strip.presence
    self.tier = tier.to_s.strip.presence
    self.notes = notes.to_s.strip.presence
    self.status = status.to_s.strip.downcase if status.present?
  end

  def sponsor_matches_campaign_tournament
    return if sponsor_id.blank? || host_campaign.blank?
    return if sponsor&.tournament_id == host_campaign.tournament_id

    errors.add(:sponsor_id, "must belong to the campaign tournament")
  end

  def cannot_cancel_with_live_income
    return unless will_save_change_to_status? && status == "cancelled" && persisted?
    return unless received_cents_total.positive?

    errors.add(:status, "cannot cancel a pledge that has live income entries; void those entries first")
  end
end
