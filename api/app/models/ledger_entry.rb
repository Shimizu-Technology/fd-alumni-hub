class LedgerEntry < ApplicationRecord
  ENTRY_TYPES = %w[income expense].freeze
  MAX_CENTS = 100_000_000_000 # $1,000,000,000 cap (well within bigint)
  INCOME_SOURCES = %w[
    fundraiser_gross
    fundraiser_net
    sponsorship
    donation
    fdaa_allocation
    ticket_share
    merch
    golf_net
    other_income
  ].freeze
  EXPENSE_SOURCES = %w[
    event_expense
    merch_cost
    venue_ops
    refund
    other_expense
  ].freeze
  FDAA_SOURCES = %w[fdaa_allocation ticket_share].freeze
  PAYMENT_METHODS = %w[
    cash
    paypal
    check
    bank_transfer
    fdaa
    hafapass_payout
    golf_payout
    card
    other
  ].freeze
  REIMBURSEMENT_STATUSES = %w[not_applicable requested approved reimbursed].freeze
  IMMUTABLE_ATTRIBUTES = %w[
    host_campaign_id
    entry_type
    amount_cents
    entry_date
    source
    payment_method
    counterparty
    paid_by
    paid_by_user_id
    pledge_id
    recorded_by_id
  ].freeze

  belongs_to :host_campaign
  belongs_to :budget_line, optional: true
  belongs_to :campaign_event, optional: true
  belongs_to :sponsor, optional: true
  belongs_to :pledge, optional: true
  belongs_to :paid_by_user, class_name: "User", optional: true
  belongs_to :reimbursement_approved_by, class_name: "User", optional: true
  belongs_to :recorded_by, class_name: "User"
  belongs_to :voided_by, class_name: "User", optional: true

  before_validation :apply_defaults_and_normalize
  before_destroy :prevent_destroy

  validates :entry_type, presence: true, inclusion: { in: ENTRY_TYPES }
  validates :amount_cents, presence: true, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: MAX_CENTS }
  validates :entry_date, presence: true
  validates :source, presence: true
  validates :payment_method, presence: true, inclusion: { in: PAYMENT_METHODS }
  validates :counterparty, presence: true, length: { maximum: 180 }
  validates :reimbursement_status, presence: true, inclusion: { in: REIMBURSEMENT_STATUSES }
  validate :source_matches_entry_type
  validate :income_reimbursement_constraints
  validate :reimbursement_consistency
  validate :void_consistency
  validate :receipt_columns_consistency
  validate :associations_belong_to_campaign
  validate :pledge_eligibility, on: :create
  validate :enforce_immutability, on: :update

  scope :live, -> { where(voided_at: nil) }
  scope :voided, -> { where.not(voided_at: nil) }
  scope :ordered, -> { order(entry_date: :desc, created_at: :desc, id: :desc) }

  def self.guam_today
    ActiveSupport::TimeZone[HostCampaign::GUAM_ZONE].today
  end

  def voided?
    voided_at.present?
  end

  def has_receipt?
    receipt_key.present?
  end

  def api_json
    {
      id: id.to_s,
      hostCampaignId: host_campaign_id.to_s,
      entryType: entry_type,
      amountCents: amount_cents,
      entryDate: entry_date&.iso8601,
      budgetLineId: budget_line_id&.to_s,
      budgetLineCategory: budget_line&.category,
      campaignEventId: campaign_event_id&.to_s,
      campaignEventTitle: campaign_event&.title,
      sponsorId: sponsor_id&.to_s,
      sponsorName: sponsor&.name,
      pledgeId: pledge_id&.to_s,
      pledgeDonorName: pledge&.donor_name,
      source: source,
      paymentMethod: payment_method,
      counterparty: counterparty,
      description: description,
      referenceNumber: reference_number,
      paidBy: paid_by,
      paidByUserId: paid_by_user_id&.to_s,
      paidByUserName: paid_by_user&.full_name,
      reimbursementStatus: reimbursement_status,
      reimbursementApprovedById: reimbursement_approved_by_id&.to_s,
      reimbursementApprovedByName: reimbursement_approved_by&.full_name,
      reimbursedAt: reimbursed_at&.iso8601,
      reimbursementReference: reimbursement_reference,
      hasReceipt: has_receipt?,
      receiptFilename: receipt_filename,
      receiptContentType: receipt_content_type,
      receiptByteSize: receipt_byte_size,
      recordedById: recorded_by_id.to_s,
      recordedByName: recorded_by&.full_name,
      voided: voided?,
      voidedAt: voided_at&.iso8601,
      voidedById: voided_by_id&.to_s,
      voidedByName: voided_by&.full_name,
      voidReason: void_reason,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  private

  def apply_defaults_and_normalize
    self.entry_date ||= self.class.guam_today
    self.entry_type = entry_type.to_s.strip.downcase if entry_type.present?
    self.source = source.to_s.strip.downcase if source.present?
    self.payment_method = payment_method.to_s.strip.downcase if payment_method.present?
    self.reimbursement_status = (reimbursement_status.presence || "not_applicable").to_s.strip.downcase
    self.counterparty = counterparty.to_s.strip if counterparty.present?
    self.description = description.to_s.strip.presence
    self.reference_number = reference_number.to_s.strip.presence
    self.paid_by = paid_by.to_s.strip.presence
    self.reimbursement_reference = reimbursement_reference.to_s.strip.presence
    self.void_reason = void_reason.to_s.strip.presence
  end

  def prevent_destroy
    errors.add(:base, "Ledger entries cannot be hard-deleted; void them instead")
    throw(:abort)
  end

  def source_matches_entry_type
    allowed = entry_type == "income" ? INCOME_SOURCES : EXPENSE_SOURCES
    return if allowed.include?(source)

    errors.add(:source, "is not valid for #{entry_type} entries")
  end

  def income_reimbursement_constraints
    return unless entry_type == "income"

    errors.add(:reimbursement_status, "must be not_applicable for income entries") unless reimbursement_status == "not_applicable"
    errors.add(:paid_by_user_id, "must be blank for income entries") if paid_by_user_id.present?
  end

  def reimbursement_consistency
    if reimbursed_at.present? && reimbursement_status != "reimbursed"
      errors.add(:reimbursed_at, "can only be set when reimbursement_status is reimbursed")
    end

    if reimbursement_approved_by_id.present? && paid_by_user_id.present? && reimbursement_approved_by_id == paid_by_user_id
      errors.add(:reimbursement_approved_by_id, "cannot be the same user who paid out of pocket")
    end
  end

  def void_consistency
    states = [ voided_at.present?, voided_by_id.present?, void_reason.present? ]
    return if states.uniq.length == 1

    errors.add(:base, "voided_at, voided_by_id, and void_reason must all be set together")
  end

  def receipt_columns_consistency
    states = [ receipt_key.present?, receipt_filename.present?, receipt_content_type.present?, receipt_byte_size.present? ]
    if states.uniq.length > 1
      errors.add(:base, "receipt columns must all be present or all be blank")
    end
    if receipt_byte_size.present? && receipt_byte_size <= 0
      errors.add(:receipt_byte_size, "must be greater than 0")
    end
  end

  def associations_belong_to_campaign
    return if host_campaign.blank?

    if budget_line_id.present?
      if budget_line.nil? || budget_line.host_campaign_id != host_campaign_id
        errors.add(:budget_line_id, "must belong to this campaign")
      elsif budget_line.kind != entry_type
        errors.add(:budget_line_id, "kind must match entry_type (#{entry_type})")
      elsif (new_record? || will_save_change_to_budget_line_id?) && budget_line.archived?
        errors.add(:budget_line_id, "cannot link to an archived budget line")
      end
    end

    if campaign_event_id.present?
      if campaign_event.nil? || campaign_event.host_campaign_id != host_campaign_id
        errors.add(:campaign_event_id, "must belong to this campaign")
      elsif (new_record? || will_save_change_to_campaign_event_id?) && campaign_event.archived?
        errors.add(:campaign_event_id, "cannot link to an archived campaign event")
      end
    end

    if pledge_id.present? && (pledge.nil? || pledge.host_campaign_id != host_campaign_id)
      errors.add(:pledge_id, "must belong to this campaign")
    end

    if sponsor_id.present? && (sponsor.nil? || sponsor.tournament_id != host_campaign.tournament_id)
      errors.add(:sponsor_id, "must belong to this campaign's tournament")
    end

    if paid_by_user_id.present? && (new_record? || will_save_change_to_paid_by_user_id?)
      payer = User.active.find_by(id: paid_by_user_id)
      unless payer && (payer.admin? || host_campaign.campaign_memberships.active.where(user_id: payer.id).exists?)
        errors.add(:paid_by_user_id, "must be an active campaign member or administrator")
      end
    end
  end

  def pledge_eligibility
    return if pledge.blank?

    if entry_type != "income"
      errors.add(:pledge_id, "can only be linked to income entries")
    elsif pledge.cancelled?
      errors.add(:pledge_id, "cannot link income to a cancelled pledge")
    elsif pledge.is_in_kind?
      errors.add(:pledge_id, "cannot link cash income to an in-kind pledge")
    end
  end

  def enforce_immutability
    if voided_at_was.present?
      errors.add(:base, "Voided ledger entries are immutable")
      return
    end

    changed_immutable = changed & IMMUTABLE_ATTRIBUTES
    return if changed_immutable.empty?

    errors.add(:base, "Core monetary fields are immutable (#{changed_immutable.join(', ')}); void and re-enter instead")
  end
end
